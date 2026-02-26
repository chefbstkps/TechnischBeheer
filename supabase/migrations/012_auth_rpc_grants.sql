-- Allow anon to call auth RPCs (app uses anon key for all requests)
GRANT EXECUTE ON FUNCTION login_user(TEXT, TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_user_by_id(UUID) TO anon;
GRANT EXECUTE ON FUNCTION change_password(UUID, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_user_page_visibility(UUID) TO anon;
GRANT EXECUTE ON FUNCTION set_user_page_visibility(UUID, TEXT, BOOLEAN) TO anon;
GRANT EXECUTE ON FUNCTION set_user_session_timeout(UUID, INTEGER, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION log_activity(UUID, TEXT, BOOLEAN, TEXT, TEXT, TEXT) TO anon;
