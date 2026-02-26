-- Seed default admin user. Default password: Admin#123 (case-sensitive)
INSERT INTO app_users (
  username,
  email,
  password_hash,
  first_name,
  last_name,
  role,
  is_active,
  must_change_password
)
VALUES (
  'Admin',
  'admin@localhost',
  hash_password('Admin#123'),
  'Admin',
  'Admin',
  'admin',
  true,
  true
)
ON CONFLICT (username) DO NOTHING;
