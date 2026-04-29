-- Ensure required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Ensure vault secrets exist (insert only if missing). 
-- app_base_url -> dominio pubblico per costruire URL del cron endpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'app_base_url') THEN
    PERFORM vault.create_secret('https://www.unobuono.xyz', 'app_base_url', 'Base URL pubblico per cron jobs');
  END IF;
END $$;

-- (Re)schedule the email-automation cron job idempotently
DO $$
BEGIN
  PERFORM cron.unschedule('email-automation');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'email-automation',
  '0 * * * *',
  $job$
  SELECT net.http_post(
    url := (
      SELECT decrypted_secret FROM vault.decrypted_secrets
      WHERE name = 'app_base_url' LIMIT 1
    ) || '/api/cron/email-automation',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'email_queue_service_role_key' LIMIT 1
      )
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $job$
);