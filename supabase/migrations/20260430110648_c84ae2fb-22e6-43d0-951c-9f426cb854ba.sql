-- Repoint email queue dispatcher cron from preview URL to stable production URL.
-- The preview URL requires a short-lived token that may be rejected; the stable
-- per-project Lovable URL serves the latest published deployment without auth gates.
DO $$
DECLARE
  _job_id bigint;
BEGIN
  SELECT jobid INTO _job_id FROM cron.job WHERE jobname = 'process-email-queue';
  IF _job_id IS NULL THEN
    RAISE NOTICE 'process-email-queue cron job not found';
    RETURN;
  END IF;

  PERFORM cron.alter_job(
    job_id := _job_id,
    command := $cmd$
  SELECT CASE
    WHEN (SELECT retry_after_until FROM public.email_send_state WHERE id = 1) > now()
      THEN NULL
    WHEN EXISTS (SELECT 1 FROM pgmq.q_auth_emails LIMIT 1)
      OR EXISTS (SELECT 1 FROM pgmq.q_transactional_emails LIMIT 1)
      THEN net.http_post(
        url := 'https://project--fb68cda5-5b80-4347-a8c8-9eecc42469b7.lovable.app/lovable/email/queue/process',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (
            SELECT decrypted_secret FROM vault.decrypted_secrets
            WHERE name = 'email_queue_service_role_key'
          )
        ),
        body := '{}'::jsonb
      )
    ELSE NULL
  END;
$cmd$
  );
END $$;