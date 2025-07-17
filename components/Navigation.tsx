'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function Navigation() {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    checkAdminRole();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const checkAdminRole = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();
      
      setIsAdmin(roleData?.role === 'admin');
    }
  };

  const navItems = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/dashboard/appointments', label: 'Appointments' },
    { href: '/dashboard/bookings', label: 'Online Bookings' },
    { href: '/dashboard/services', label: 'Services' },
    { href: '/dashboard/inventory', label: 'Inventory' },
    { href: '/dashboard/analytics', label: 'Analytics' },
    ...(isAdmin ? [{ href: '/dashboard/admin', label: 'Admin' }] : []),
  ];

  return (
    <nav className="border-b">
      <div className="container mx-auto px-4">
        <ul className="flex space-x-8">
          {navItems.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  'inline-block py-4 px-2 text-sm font-medium transition-colors',
                  'hover:text-primary',
                  pathname === item.href
                    ? 'text-primary border-b-2 border-primary'
                    : 'text-muted-foreground'
                )}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}