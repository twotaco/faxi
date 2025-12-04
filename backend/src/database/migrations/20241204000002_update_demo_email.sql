-- Migration: Update demo user email
-- Updates the demo user email from demo@faxi.jp to demo@me.faxi.jp

UPDATE users
SET
  email_address = 'demo@me.faxi.jp',
  updated_at = CURRENT_TIMESTAMP
WHERE id = '00000000-0000-0000-0000-000000000001';
