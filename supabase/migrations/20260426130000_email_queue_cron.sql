-- Wire up pg_cron to call the email queue processor every minute.
-- The processor lives at /lovable/email/queue/process (TanStack server route).
-- pg_net and pg_cron are already enabled by the email_infra migration.

-- Remove any existing job (idempotent re-run)
DO $$
BEGIN
  PERFORM cron.unschedule('process-email-queue');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Store the app's production URL in vault so the cron job can reference it.
-- Update if already exists.
DO $$
DECLARE
  existing_id UUID;
BEGIN
  SELECT id INTO existing_id FROM vault.secrets WHERE name = 'app_base_url' LIMIT 1;
  IF existing_id IS NULL THEN
    PERFORM vault.create_secret(
      'https://www.unobuono.xyz',
      'app_base_url',
      'Production app base URL'
    );
  ELSE
    PERFORM vault.update_secret(
      existing_id,
      'https://www.unobuono.xyz',
      'app_base_url',
      'Production app base URL'
    );
  END IF;
END $$;

-- pg_cron job: every minute, POST to the email queue processor.
-- Uses vault secrets: app_base_url + email_queue_service_role_key.
-- NOTE: email_queue_service_role_key must be added via Supabase Dashboard → Vault
-- (Settings → Vault → New secret: name=email_queue_service_role_key, value=<service_role_key>).
SELECT cron.schedule(
  'process-email-queue',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := (
      SELECT decrypted_secret FROM vault.decrypted_secrets
      WHERE name = 'app_base_url' LIMIT 1
    ) || '/lovable/email/queue/process',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'email_queue_service_role_key' LIMIT 1
      )
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
