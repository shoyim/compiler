import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { RefreshCw } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { StatsBar } from '@/components/StatsBar';
import { PackageGrid } from '@/components/PackageGrid';
import { Button } from '@/components/ui/button';
import { apiGet, ApiError, type PackageInfo } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';
import { useDocumentTitle } from '@/lib/useDocumentTitle';

export default function Dashboard() {
  useDocumentTitle('Dashboard — Compiler');
  const { ready, role } = useAuth(true);
  const [packages, setPackages] = useState<PackageInfo[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      setPackages(await apiGet('/api/v2/packages'));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Server bilan bog'lanib bo'lmadi");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  const total = packages?.length ?? 0;
  const installed = packages?.filter(p => p.installed).length ?? 0;

  return (
    <AppShell
      ready={ready}
      role={role}
      actions={
        <Button variant="ghost" size="icon" onClick={load} title="Yangilash">
          <RefreshCw className={'h-4 w-4' + (refreshing ? ' animate-spin' : '')} />
        </Button>
      }
    >
      <StatsBar total={total} installed={installed} />
      {packages === null ? (
        <div className="py-20 text-center text-muted-foreground">
          <RefreshCw className="mx-auto mb-3 h-8 w-8 animate-spin text-primary" />
          <p className="text-sm">Yuklanmoqda...</p>
        </div>
      ) : (
        <PackageGrid packages={packages} onChanged={load} />
      )}
    </AppShell>
  );
}
