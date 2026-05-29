
REVOKE EXECUTE ON FUNCTION public.is_guest(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_guest(uuid) TO authenticated;
