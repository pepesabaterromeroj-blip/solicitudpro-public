drop index public.attachments_business_id_idx;

create index attachments_business_uploaded_by_fk_idx
  on public.attachments (business_id, uploaded_by);
