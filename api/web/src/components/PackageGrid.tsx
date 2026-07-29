import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Search, Check, Download, RotateCw, Trash2, PackageOpen, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiSend, ApiError, type PackageInfo } from '@/lib/api';
import { langColor, langInitial } from '@/lib/lang-color';

type Filter = 'all' | 'installed' | 'available';

export function PackageGrid({ packages, onChanged }: { packages: PackageInfo[]; onChanged: () => Promise<void> }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [pending, setPending] = useState<Set<string>>(new Set());

  const key = (l: string, v: string) => `${l}@${v}`;

  const list = useMemo(() => {
    const q = query.toLowerCase();
    return packages.filter(p => {
      const matches = p.language.toLowerCase().includes(q) || p.language_version.includes(q);
      const f = filter === 'all' ? true : filter === 'installed' ? p.installed : !p.installed;
      return matches && f;
    });
  }, [packages, query, filter]);

  async function run(action: 'install' | 'uninstall' | 'reinstall', lang: string, ver: string) {
    const k = key(lang, ver);
    setPending(prev => new Set(prev).add(k));
    try {
      if (action === 'install') await apiSend('/api/v2/packages', 'POST', { language: lang, version: ver });
      if (action === 'uninstall') await apiSend('/api/v2/packages', 'DELETE', { language: lang, version: ver });
      if (action === 'reinstall') {
        await apiSend('/api/v2/packages', 'DELETE', { language: lang, version: ver });
        await apiSend('/api/v2/packages', 'POST', { language: lang, version: ver });
      }
      const labels = { install: "o'rnatildi", uninstall: "o'chirildi", reinstall: "qayta o'rnatildi" };
      toast.success(`${lang} v${ver} ${labels[action]}`);
      await onChanged();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Xatolik');
    } finally {
      setPending(prev => {
        const next = new Set(prev);
        next.delete(k);
        return next;
      });
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 pb-12 sm:px-6">
      <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Til qidirish..." className="pl-8" value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        <Tabs value={filter} onValueChange={v => setFilter(v as Filter)}>
          <TabsList>
            <TabsTrigger value="all">Hammasi</TabsTrigger>
            <TabsTrigger value="installed">O'rnatilgan</TabsTrigger>
            <TabsTrigger value="available">Mavjud</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {list.length === 0 ? (
        <div className="py-20 text-center text-muted-foreground">
          <PackageOpen className="mx-auto mb-3 h-10 w-10 opacity-40" />
          <p className="text-sm font-medium">Hech narsa topilmadi</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {list.map(p => {
            const k = key(p.language, p.language_version);
            const busy = pending.has(k);
            const color = langColor(p.language);
            return (
              <Card key={k} className="animate-fade-up transition-all hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex items-start gap-3 p-4">
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold"
                    style={{ background: `${color}1a`, color }}
                  >
                    {langInitial(p.language)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-semibold capitalize">{p.language}</span>
                      {p.installed && (
                        <Badge variant="success">
                          <Check className="h-2.5 w-2.5" /> Faol
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 font-mono text-xs text-muted-foreground">v{p.language_version}</p>
                  </div>
                </div>
                <div className="flex gap-2 px-4 pb-4">
                  {p.installed ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 gap-1.5"
                        disabled={busy}
                        onClick={() => run('reinstall', p.language, p.language_version)}
                      >
                        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCw className="h-3.5 w-3.5" />}
                        {busy ? 'Kutilmoqda...' : "Qayta o'rnatish"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        disabled={busy}
                        onClick={() => run('uninstall', p.language, p.language_version)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      className="flex-1 gap-1.5"
                      disabled={busy}
                      onClick={() => run('install', p.language, p.language_version)}
                    >
                      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                      {busy ? "O'rnatilmoqda..." : "O'rnatish"}
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
