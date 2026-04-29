-- ============================================================
-- CLEANUP DATI DI TEST
-- Cancella tutti i dati transazionali mantenendo:
--   - restaurant_settings, restaurants, menu_items, room_zones
--   - profiles, user_roles (owner/staff)
--   - email_send_state, suppressed_emails, email_unsubscribe_tokens
-- ============================================================

-- Ordine: prima le tabelle dipendenti, poi quelle padre
-- (TRUNCATE CASCADE gestisce le FK automaticamente ma siamo espliciti)

TRUNCATE TABLE
  public.staff_tasks,
  public.waiter_calls,
  public.preorders,
  public.reservations,
  public.waitlist,
  public.clients,
  public.reviews,
  public.campaigns,
  public.email_send_log,
  public.social_posts
RESTART IDENTITY CASCADE;

-- Svuota anche le code pgmq (messaggi email in attesa)
DO $$
BEGIN
  PERFORM pgmq.purge_queue('transactional_emails');
  PERFORM pgmq.purge_queue('transactional_emails_dlq');
  PERFORM pgmq.purge_queue('auth_emails');
  PERFORM pgmq.purge_queue('auth_emails_dlq');
EXCEPTION WHEN OTHERS THEN
  NULL; -- ignora se le code non esistono
END $$;
