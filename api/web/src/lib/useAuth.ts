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
      let r = localStorage.getItem('auth_role');
      if (!r) {
        try {
          const me = await fetchMe();
          r = me.role;
          localStorage.setItem('auth_role', r);
        } catch {
          window.location.href = '/login';
          return;
        }
      }
      if (requireAdmin && r !== 'admin') {
        window.location.href = redirectIfUnauthorized;
        return;
      }
      setRole(r);
      setReady(true);
    })();
  }, [requireAdmin, redirectIfUnauthorized]);

  return { ready, role, username };
}
