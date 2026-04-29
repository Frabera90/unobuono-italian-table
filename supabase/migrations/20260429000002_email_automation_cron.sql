-- pg_cron job: ogni ora chiama l'endpoint di automazione email (reminder 24h + follow-up).
-- Il job usa lo stesso pattern del processo-email-queue: Bearer = service_role_key da vault.

DO $$
BEGIN
  PERFORM cron.unschedule('email-automation');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'email-automation',
  '0 * * * *',  -- ogni ora al minuto 0
  $$
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
  $$
);
