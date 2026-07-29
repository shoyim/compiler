import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Search, RefreshCw, ChevronLeft, ChevronRight, ChevronRight as ChevronRightIcon, Trash2, X, Inbox, Loader2 } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/StatusBadge';
import { JobDetailPanel } from '@/components/JobDetailPanel';
import { apiGet, apiSend, ApiError, type JobRow } from '@/lib/api';
import { getLangMeta } from '@/lib/lang-meta';
import { useAuth } from '@/lib/useAuth';
import { useDocumentTitle } from '@/lib/useDocumentTitle';

const PAGE_SIZE = 50;

export default function Jobs() {
  useDocumentTitle('Joblar — Compiler');
  const { ready, role } = useAuth(true);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [langs, setLangs] = useState<string[]>([]);
  const [langFilter, setLangFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detailId, setDetailId] = useState<string | null>(null);

  const loadJobs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
      if (langFilter) params.set('language', langFilter);
      const data = await apiGet('/api/v2/jobs?' + params);
      setJobs(data.jobs);
      setTotal(data.total);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Server bilan bog'lanib bo'lmadi");
    } finally {
      setLoading(false);
    }
  }, [offset, langFilter]);

  useEffect(() => {
    if (ready) loadJobs();
  }, [ready, loadJobs]);

  useEffect(() => {
    if (!ready) return;
    apiGet('/api/v2/runtimes')
      .then((rts: { language: string }[]) => setLangs([...new Set(rts.map(r => r.language))].sort()))
      .catch(() => {});
  }, [ready]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return jobs.filter(j => {
      const matchQ = !q || j.language.toLowerCase().includes(q) || (j.username || '').toLowerCase().includes(q);
      let matchS = true;
      if (statusFilter === 'ok') matchS = j.run_exit === 0;
      else if (statusFilter === 'error') matchS = j.run_exit !== 0 && j.run_status !== 'timed_out' && j.run_status !== 'memory_limit';
      else if (statusFilter === 'timed_out') matchS = j.run_status === 'timed_out';
      else if (statusFilter === 'memory_limit') matchS = j.run_status === 'memory_limit';
      return matchQ && matchS;
    });
  }, [jobs, search, statusFilter]);

  function toggleRow(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(filtered.map(j => j.id)) : new Set());
  }

  async function deleteSelected() {
    if (!selected.size) return;
    if (!confirm(`${selected.size} ta jobni o'chirishni tasdiqlaysizmi?`)) return;
    try {
      const d = await apiSend('/api/v2/jobs', 'DELETE', { ids: [...selected] });
      toast.success(d.message);
      setSelected(new Set());
      loadJobs();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Xatolik');
    }
  }

  async function deleteOne(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Bu jobni o'chirishni tasdiqlaysizmi?")) return;
    try {
      const d = await apiSend(`/api/v2/jobs/${id}`, 'DELETE');
      toast.success(d.message);
      selected.delete(id);
      loadJobs();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Xatolik');
    }
  }

  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const showPagination = !(offset === 0 && jobs.length < PAGE_SIZE);

  return (
    <AppShell
      ready={ready}
      role={role}
      actions={
        <Button variant="ghost" size="icon" onClick={loadJobs} title="Yangilash">
          <RefreshCw className={'h-4 w-4' + (loading ? ' animate-spin' : '')} />
        </Button>
      }
    >
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="mb-5 flex flex-wrap gap-2.5">
          <div className="relative min-w-[180px] max-w-xs flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Username yoki til..." className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select
            value={langFilter}
            onChange={e => {
              setOffset(0);
              setLangFilter(e.target.value);
            }}
            className="rounded-xl border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Barcha tillar</option>
            {langs.map(l => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="rounded-xl border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Barcha holatlar</option>
            <option value="ok">OK</option>
            <option value="error">Xato</option>
            <option value="timed_out">TLE</option>
            <option value="memory_limit">MLE</option>
          </select>
          <div className="ml-auto flex items-center gap-1.5 rounded-xl border bg-card px-3 py-2 text-xs text-muted-foreground">
            Jami: <span className="ml-1 font-bold text-foreground">{total}</span>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 cursor-pointer rounded border-input"
                      checked={filtered.length > 0 && filtered.every(j => selected.has(j.id))}
                      onChange={e => toggleAll(e.target.checked)}
                    />
                  </th>
                  <th className="px-4 py-3">Til</th>
                  <th className="hidden px-4 py-3 md:table-cell">Foydalanuvchi</th>
                  <th className="px-4 py-3">Compile</th>
                  <th className="px-4 py-3">Run</th>
                  <th className="hidden px-4 py-3 sm:table-cell">Vaqt</th>
                  <th className="hidden px-4 py-3 sm:table-cell">Xotira</th>
                  <th className="px-4 py-3">Sana</th>
                  <th className="w-12 px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading && jobs.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-20 text-center text-sm text-muted-foreground">
                      <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-primary" />
                      Yuklanmoqda...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-20 text-center text-sm text-muted-foreground">
                      <Inbox className="mx-auto mb-3 h-8 w-8 opacity-30" />
                      Joblar topilmadi
                    </td>
                  </tr>
                ) : (
                  filtered.map(j => {
                    const m = getLangMeta(j.language);
                    const dt = new Date(j.created_at);
                    const timeStr = dt.toLocaleString('uz', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                    const isSel = selected.has(j.id);
                    return (
                      <tr
                        key={j.id}
                        className={'group cursor-pointer transition-colors hover:bg-muted/40' + (isSel ? ' bg-accent/40' : '')}
                      >
                        <td className="w-10 px-4 py-3.5" onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            className="h-3.5 w-3.5 cursor-pointer rounded border-input"
                            checked={isSel}
                            onChange={() => toggleRow(j.id)}
                          />
                        </td>
                        <td className="px-4 py-3.5" onClick={() => setDetailId(j.id)}>
                          <div className="flex items-center gap-2.5">
                            <div
                              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-[10px] font-bold"
                              style={{ color: m.color }}
                            >
                              {j.language.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="text-xs font-semibold capitalize">{j.language}</div>
                              <div className="font-mono text-[10px] text-muted-foreground">v{j.version}</div>
                            </div>
                          </div>
                        </td>
                        <td className="hidden px-4 py-3.5 text-xs text-muted-foreground md:table-cell" onClick={() => setDetailId(j.id)}>
                          {j.username || '—'}
                        </td>
                        <td className="px-4 py-3.5" onClick={() => setDetailId(j.id)}>
                          {j.compile_exit !== null && j.compile_exit !== undefined ? (
                            <StatusBadge exit={j.compile_exit} status={j.compile_status} />
                          ) : (
                            <span className="text-[10px] text-muted-foreground/50">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5" onClick={() => setDetailId(j.id)}>
                          <StatusBadge exit={j.run_exit} status={j.run_status} />
                        </td>
                        <td className="hidden px-4 py-3.5 font-mono text-xs text-muted-foreground sm:table-cell" onClick={() => setDetailId(j.id)}>
                          {j.run_time != null ? `${j.run_time} ms` : '—'}
                        </td>
                        <td className="hidden px-4 py-3.5 font-mono text-xs text-muted-foreground sm:table-cell" onClick={() => setDetailId(j.id)}>
                          {j.run_memory != null ? `${(j.run_memory / 1024).toFixed(0)} KB` : '—'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-[11px] text-muted-foreground" onClick={() => setDetailId(j.id)}>
                          {timeStr}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
                              onClick={e => deleteOne(j.id, e)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                            <ChevronRightIcon className="h-3.5 w-3.5 text-muted-foreground/40" />
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {showPagination && (
            <div className="flex items-center justify-between gap-3 border-t px-5 py-3">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={offset === 0}
                onClick={() => {
                  setOffset(o => Math.max(0, o - PAGE_SIZE));
                  setSelected(new Set());
                }}
              >
                <ChevronLeft className="h-3 w-3" /> Oldingi
              </Button>
              <span className="text-xs text-muted-foreground">
                Sahifa {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={offset + jobs.length >= total}
                onClick={() => {
                  setOffset(o => o + PAGE_SIZE);
                  setSelected(new Set());
                }}
              >
                Keyingi <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
      </main>

      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-2xl border bg-slate-900 px-5 py-3 text-white shadow-2xl dark:bg-white dark:text-slate-800">
          <span className="text-sm font-semibold">{selected.size} ta tanlandi</span>
          <div className="h-4 w-px bg-slate-600 dark:bg-slate-300" />
          <Button size="sm" variant="destructive" className="gap-2" onClick={deleteSelected}>
            <Trash2 className="h-3.5 w-3.5" /> O'chirish
          </Button>
          <button
            onClick={() => setSelected(new Set())}
            className="flex items-center gap-1.5 text-xs text-slate-400 transition-colors hover:text-white dark:hover:text-slate-800"
          >
            <X className="h-3.5 w-3.5" /> Bekor
          </button>
        </div>
      )}

      <JobDetailPanel jobId={detailId} onClose={() => setDetailId(null)} onDeleted={loadJobs} />
    </AppShell>
  );
}
