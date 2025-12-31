create extension if not exists pg_cron;

select cron.schedule(
  'ledgerly_recurring_rules',
  '*/5 * * * *',
  $$select public.process_recurring_rules();$$
);

select cron.schedule(
  'ledgerly_categorization_rules',
  '*/15 * * * *',
  $$select public.apply_categorization_rules();$$
);

select cron.schedule(
  'ledgerly_subscription_detection',
  '0 * * * *',
  $$select public.detect_subscription_candidates();$$
);
