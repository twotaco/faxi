-- Migration: Fix audit_logs foreign key constraint
-- The user_id column was referencing only the users table, but admin actions
-- use admin_users IDs. Remove the constraint to allow both.

-- Drop the existing foreign key constraint
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_user_id_fkey;

-- The column remains as UUID, but now accepts any UUID (user or admin)
-- Application code is responsible for passing valid IDs
