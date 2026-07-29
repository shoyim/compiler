import { useEffect, useState } from 'react';
import { fetchMe, getToken } from '@/lib/api';

export function useAuth(requireAdmin: boolean, redirectIfUnauthorized = '/tester') {
  const [ready, setReady] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const username = localStorage.getItem('auth_user') || '?';

  useEffect(() => {
    if (!getToken()) {
      window.location.href = '/login';
      return;
    }
    (async () => {
      try {
        const me = await fetchMe();
        localStorage.setItem('auth_role', me.role);
        localStorage.setItem('auth_user', me.username);
        if (requireAdmin && me.role !== 'admin') {
          window.location.href = redirectIfUnauthorized;
          return;
        }
        setRole(me.role);
        setReady(true);
      } catch {
        localStorage.clear();
        window.location.href = '/login';
      }
    })();
  }, [requireAdmin, redirectIfUnauthorized]);

  return { ready, role, username };
}
