alter table reservations
  add column if not exists followup_sent boolean not null default false;
