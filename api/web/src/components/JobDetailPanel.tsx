import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ChevronLeft, Trash2, Copy, FileX, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/StatusBadge';
import { apiGet, apiSend, ApiError, type JobDetail } from '@/lib/api';
import { getLangMeta } from '@/lib/lang-meta';

export function JobDetailPanel({
  jobId,
  onClose,
  onDeleted,
}: {
  jobId: string | null;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [job, setJob] = useState<JobDetail | null>(null);
  const [tab, setTab] = useState<'kod' | 'natija'>('kod');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!jobId) return;
    setJob(null);
    setTab('kod');
    apiGet(`/api/v2/jobs/${jobId}`)
      .then(setJob)
      .catch(e => toast.error(e instanceof ApiError ? e.message : 'Xatolik'));
  }, [jobId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function deleteJob() {
    if (!jobId) return;
    if (!confirm("Bu jobni o'chirishni tasdiqlaysizmi?")) return;
    try {
      const d = await apiSend(`/api/v2/jobs/${jobId}`, 'DELETE');
      toast.success(d.message);
      onDeleted();
      onClose();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Xatolik');
    }
  }

  function copyCode() {
    if (!job?.code) return;
    navigator.clipboard.writeText(job.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (!jobId) return null;
  const m = job ? getLangMeta(job.language) : null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="flex w-full flex-col overflow-hidden border-l bg-card shadow-2xl sm:max-w-2xl">
        <div className="flex flex-shrink-0 items-center gap-3 border-b px-5 py-3.5">
          <button onClick={onClose} className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground">
            <ChevronLeft className="h-3.5 w-3.5" /> Orqaga
          </button>
          <div className="min-w-0 flex-1">
            {job && (
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-muted text-[10px] font-bold" style={{ color: m!.color }}>
                  {job.language.slice(0, 2).toUpperCase()}
                </div>
                <span className="text-sm font-bold capitalize">{job.language}</span>
                <span className="font-mono text-xs text-muted-foreground">v{job.version}</span>
                {job.username && <span className="text-xs text-muted-foreground">· {job.username}</span>}
                <span className="hidden font-mono text-xs text-muted-foreground/60 sm:inline">
                  {new Date(job.created_at).toLocaleString()}
                </span>
              </div>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={deleteJob}
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">O'chirish</span>
          </Button>
        </div>

        <div className="flex flex-shrink-0 border-b">
          {(['kod', 'natija'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={
                'flex items-center gap-2 border-b-2 px-5 py-2.5 text-xs font-semibold transition-colors ' +
                (tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground')
              }
            >
              {t === 'kod' ? 'Kod' : 'Natija'}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {!job ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : tab === 'kod' ? (
            <div className="p-4">
              {job.code && job.code.trim() ? (
                <div>
                  <div className="flex items-center justify-between rounded-t-xl border border-b-0 bg-slate-800 px-4 py-2.5 dark:bg-slate-950">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1.5">
                        <div className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
                        <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/70" />
                        <div className="h-2.5 w-2.5 rounded-full bg-green-500/70" />
                      </div>
                      <span className="ml-1 font-mono text-xs capitalize text-slate-400">{job.language}</span>
                    </div>
                    <button
                      onClick={copyCode}
                      className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-slate-400 transition-colors hover:bg-slate-700 hover:text-slate-200"
                    >
                      <Copy className="h-3 w-3" />
                      {copied ? 'Nusxalandi!' : 'Nusxa'}
                    </button>
                  </div>
                  <pre className="max-h-[calc(100vh-220px)] overflow-auto rounded-b-xl border border-t-0 bg-slate-900 p-4 font-mono text-xs leading-relaxed text-slate-100 dark:bg-slate-950">
                    {job.code}
                  </pre>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <FileX className="mb-3 h-8 w-8 opacity-50" />
                  <p className="text-sm">Kod saqlanmagan</p>
                  <p className="mt-1 text-xs opacity-70">Eski joblar uchun kod mavjud emas</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4 p-5">
              {job.compile_exit !== null && job.compile_exit !== undefined && (
                <StageBlock
                  label="Compile"
                  exit={job.compile_exit}
                  status={job.compile_status}
                  time={job.compile_time}
                  memory={job.compile_memory}
                  stdout={job.compile_stdout}
                  stderr={job.compile_stderr}
                />
              )}
              <StageBlock
                label="Run"
                exit={job.run_exit}
                status={job.run_status}
                time={job.run_time}
                memory={job.run_memory}
                stdout={job.run_stdout}
                stderr={job.run_stderr}
              />
              <div className="border-t pt-2 font-mono text-[10px] text-muted-foreground">ID: {job.id}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StageBlock({
  label,
  exit,
  status,
  time,
  memory,
  stdout,
  stderr,
}: {
  label: string;
  exit: number | null;
  status: string | null;
  time: number | null;
  memory: number | null;
  stdout: string | null;
  stderr: string | null;
}) {
  const ok = exit === 0 && !status;
  return (
    <div className={'overflow-hidden rounded-xl border ' + (ok ? 'border-success/30' : '')}>
      <div className={'flex flex-wrap items-center gap-3 px-4 py-2.5 ' + (ok ? 'bg-success/10' : 'bg-muted/60')}>
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
        <StatusBadge exit={exit} status={status} />
        {time != null && <span className="ml-auto font-mono text-xs text-muted-foreground">{time}ms</span>}
        {memory != null && <span className="font-mono text-xs text-muted-foreground">{(memory / 1024).toFixed(0)}KB</span>}
      </div>
      <div className="space-y-2 p-3">
        <OutputBlock label="stdout" content={stdout} />
        <OutputBlock label="stderr" content={stderr} />
      </div>
    </div>
  );
}

function OutputBlock({ label, content }: { label: string; content: string | null }) {
  if (!content || !content.trim()) return <p className="text-xs italic text-muted-foreground">{label}: bo'sh</p>;
  return (
    <div>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-slate-950 p-3 font-mono text-xs text-emerald-400">
        {content}
      </pre>
    </div>
  );
}
