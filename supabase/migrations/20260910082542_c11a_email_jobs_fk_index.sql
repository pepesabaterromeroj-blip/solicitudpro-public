drop index public.email_jobs_business_request_idx;

create index email_jobs_request_business_fk_idx
  on public.email_jobs (request_id, business_id);
