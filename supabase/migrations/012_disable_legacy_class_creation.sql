-- Student Hub v1.0.6 final self-service class workflow lock.
-- The original schema had an older create_class(text,text,integer,text,text)
-- overload that was granted to authenticated users. Revoke it so there is
-- no remaining normal-user path to create a class.

REVOKE ALL ON FUNCTION public.create_class(text, text, integer, text, text) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_class(text, public.class_delivery_mode, text, integer, text, text) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.join_class_by_code(text) FROM public, anon, authenticated;

-- The application intentionally provisions classes and memberships outside
-- the student client. Operators may still execute SQL directly as database
-- owners/service-role processes where appropriate.
