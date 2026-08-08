revoke all on function public.create_business(text,text,text,text,jsonb,text) from public;
revoke all on function public.create_business(text,text,text,text,jsonb,text) from anon;
grant execute on function public.create_business(text,text,text,text,jsonb,text) to authenticated;

comment on function public.create_business(text,text,text,text,jsonb,text) is
  'Creates a business and its owner membership atomically. Ownership is taken from auth.uid(), never from a parameter.';
