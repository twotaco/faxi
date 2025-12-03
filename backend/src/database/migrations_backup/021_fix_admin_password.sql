-- Migration 021: Fix admin user password hash
-- The previous hash was incorrect. This updates it to the correct bcrypt hash for 'admin123'

UPDATE admin_users
SET password_hash = '$2b$12$OK./5bbAPbj49xUEPBcoqOkwvfNq0U/v1jfxyyoRubb1mQ9kz4A5i'
WHERE email = 'admin@faxi.jp';
