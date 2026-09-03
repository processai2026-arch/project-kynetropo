-- Set the admin login to admin@project.com / Admin@123
--
-- Run ONCE against the live database (phpMyAdmin → SQL tab, or the mysql CLI).
-- Safe to re-run: it rewrites the same row to the same values.
--
-- Targets the primary admin of the founding tenant (lowest user_id, user_type
-- 'admin', tenant_id 1) so a database holding several admins only has that one
-- account renamed. If the database has no admin row at all, import
-- auth_tables.sql instead — its seed now carries these same credentials.
--
-- password_hash below is bcrypt cost 12 (BCRYPT_COST in api/config/app.php) for
-- the password Admin@123. Never store the plaintext here.
--
-- After running, log in at https://project.kynetropo.com with:
--   email    admin@project.com
--   password Admin@123
-- and change the password from Settings → Security.

UPDATE `users`
   SET `email`           = 'admin@project.com',
       `password_hash`   = '$2y$12$JZHn1DRTKj0lPw275vBtKON.DUQGRozNaOjAKnIWUeFeHWL.myHay',
       `is_active`       = 1,
       `approval_status` = 'approved'
 WHERE `user_id` = (
   SELECT `user_id` FROM (
     SELECT MIN(`user_id`) AS `user_id`
       FROM `users`
      WHERE `user_type` = 'admin' AND `tenant_id` = 1
   ) AS `primary_admin`
 );

-- Verify (should return exactly one row, email admin@project.com):
-- SELECT user_id, name, email, user_type, is_active, approval_status, tenant_id
--   FROM users WHERE user_type = 'admin' AND tenant_id = 1;
