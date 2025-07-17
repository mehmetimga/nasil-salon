-- IMPORTANT: First create the admin user in Supabase Auth dashboard
-- Then run this SQL to give them admin privileges

-- Replace 'admin@yourdomain.com' with your admin user's email
INSERT INTO user_roles (user_id, role)
SELECT id, 'admin'
FROM auth.users
WHERE email = 'admin@yourdomain.com'
ON CONFLICT (user_id) 
DO UPDATE SET role = 'admin';

-- Verify the admin was created
SELECT 
  u.email,
  ur.role,
  ur.created_at
FROM auth.users u
JOIN user_roles ur ON u.id = ur.user_id
WHERE ur.role = 'admin';