-- Add customer_email to waitlist so we can send confirmation emails
ALTER TABLE public.waitlist
  ADD COLUMN IF NOT EXISTS customer_email text;
