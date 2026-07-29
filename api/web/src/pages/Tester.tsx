import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Play, Loader2, Clock, Cpu, Eraser, Copy, Terminal, Settings2, CircleCheck, CircleX, Hourglass } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { CodeMirrorEditor, type CodeMirrorHandle } from '@/components/CodeMirrorEditor';
import { authHeaders, type ExecResult, type RuntimeInfo } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';
import { useIsDark } from '@/lib/useIsDark';
import { getExample, getLangTheme, LANG_MODES } from '@/lib/tester-langs';
import { useDocumentTitle } from '@/lib/useDocumentTitle';

export default function Tester() {
  useDocumentTitle('Tester — Compiler');
  const { ready, role } = useAuth(false);
  const isDark = useIsDark();
  const editorRef = useRef<CodeMirrorHandle>(null);
  const currentEditorLang = useRef('');

  const [runtimes, setRuntimes] = useState<RuntimeInfo[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [lang, setLang] = useState('');
  const [version, setVersion] = useState('');
  const [stdin, setStdin] = useState('');
  const [fileName, setFileName] = useState('main');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ExecResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [clientMs, setClientMs] = useState<number | null>(null);
  const [outputTab, setOutputTab] = useState<'output' | 'compile'>('output');
  const [mobilePanel, setMobilePanel] = useState<'editor' | 'output'>('editor');

  useEffect(() => {
    if (!ready) return;
    fetch('/api/v2/runtimes')
      .then(r => r.json())
      .then((rts: RuntimeInfo[]) => {
        setRuntimes(rts);
        const langs = [...new Set(rts.map(r => r.language))].sort();
        setLanguages(langs);
        if (langs.length) setLang(langs[0]);
      })
      .catch(() => toast.error("Runtime'larni yuklab bo'lmadi"));
  }, [ready]);

  const versions = runtimes.filter(r => r.language === lang).map(r => r.version);

  useEffect(() => {
    if (!lang) return;
    if (!versions.includes(version)) setVersion(versions[0] || '');

    const ex = getExample(lang);
    if (!editorRef.current) return;
    if (editorRef.current.getValue().trim() === '' || currentEditorLang.current !== lang) {
      editorRef.current.setValue(ex.code);
      if (!stdin.trim()) setStdin(ex.stdin);
    }
    currentEditorLang.current = lang;
    setFileName('main.' + ex.ext);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  const theme = lang ? (isDark ? getLangTheme(lang).dark : getLangTheme(lang).light) : isDark ? 'monokai' : 'idea';
  const mode = LANG_MODES[lang] || 'text/plain';
  const accentColor = lang ? getLangTheme(lang).color : '#6B7280';

  const runCode = useCallback(async () => {
    if (running) return;
    const code = editorRef.current?.getValue().trim();
    if (!code) return toast.error("Kod bo'sh");
    if (!lang) return toast.error('Tilni tanlang');

    setRunning(true);
    setErrorMsg(null);
    setResult(null);
    const start = Date.now();
    try {
      const res = await fetch('/api/v2/execute', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          language: lang,
          version,
          files: [{ name: fileName, content: editorRef.current?.getValue() ?? '' }],
          stdin,
        }),
      });
      const elapsed = Date.now() - start;
      if (res.status === 401) {
        localStorage.clear();
        window.location.href = '/login';
        return;
      }
      if (!res.ok) {
        const e = await res.json().catch(() => ({ message: 'Server xatosi' }));
        setErrorMsg(e.message);
        return;
      }
      const data: ExecResult = await res.json();
      setResult(data);
      setClientMs(elapsed);
      setOutputTab('output');
      if (window.innerWidth < 1024) setMobilePanel('output');
    } catch (e) {
      setErrorMsg('Serverga ulanib bo\'lmadi: ' + (e instanceof Error ? e.message : ''));
    } finally {
      setRunning(false);
    }
  }, [running, lang, version, fileName, stdin]);

  function clearCode() {
    editorRef.current?.setValue('');
    currentEditorLang.current = '';
  }
  function clearOutput() {
    setResult(null);
    setErrorMsg(null);
  }
  function copyCode() {
    navigator.clipboard.writeText(editorRef.current?.getValue() ?? '').then(() => toast.success('Kod nusxalandi'));
  }

  const hasCompile = !!(result?.compile && result.compile.code !== null && result.compile.code !== undefined);

  return (
    <AppShell
      ready={ready}
      role={role}
      actions={
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <select
            value={lang}
            onChange={e => setLang(e.target.value)}
            className="min-w-[110px] rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {languages.length === 0 && <option>Yuklanmoqda...</option>}
            {languages.map(l => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
          <select
            value={version}
            onChange={e => setVersion(e.target.value)}
            className="rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {versions.map(v => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
          <button
            onClick={runCode}
            disabled={running}
            className="flex shrink-0 items-center gap-2 rounded-lg bg-green-600 px-4 py-1.5 text-xs font-bold text-white shadow-[0_0_20px_rgba(34,197,94,0.4)] transition-colors hover:bg-green-500 disabled:opacity-60"
          >
            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            {running ? 'Bajarilmoqda...' : 'Ishga tushirish'}
          </button>
          {result && (
            <div className="hidden shrink-0 items-center gap-2 text-xs text-muted-foreground sm:flex">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {result.run.time || '—'}ms
              </span>
              <span className="flex items-center gap-1">
                <Cpu className="h-3 w-3" />
                {result.run.memory || '—'}KB
              </span>
            </div>
          )}
        </div>
      }
    >
      <div className="flex shrink-0 border-b bg-card lg:hidden">
        <button
          onClick={() => setMobilePanel('editor')}
          className={
            'flex-1 py-2.5 text-center text-xs font-semibold transition-colors ' +
            (mobilePanel === 'editor' ? 'bg-green-600 text-white' : 'text-muted-foreground')
          }
        >
          Kod
        </button>
        <button
          onClick={() => setMobilePanel('output')}
          className={
            'flex-1 py-2.5 text-center text-xs font-semibold transition-colors ' +
            (mobilePanel === 'output' ? 'bg-green-600 text-white' : 'text-muted-foreground')
          }
        >
          Natija
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className={'min-h-0 flex-col border-r lg:flex lg:w-1/2 xl:w-3/5 ' + (mobilePanel === 'editor' ? 'flex' : 'hidden lg:flex')}>
          <div
            className="flex shrink-0 items-center gap-1 border-b bg-card px-3 py-1.5"
            style={{ borderLeft: `3px solid ${accentColor}` }}
          >
            <div className="flex items-center gap-1.5 rounded-md bg-muted px-3 py-1 text-xs">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: accentColor }} />
              <span className="font-mono">{fileName}</span>
            </div>
            <div className="ml-auto flex items-center gap-1">
              <button onClick={clearCode} title="Tozalash" className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground">
                <Eraser className="h-3 w-3" />
              </button>
              <button onClick={copyCode} title="Nusxalash" className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground">
                <Copy className="h-3 w-3" />
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1">
            <CodeMirrorEditor ref={editorRef} mode={mode} theme={theme} onRun={runCode} />
          </div>
          <div className="shrink-0 border-t">
            <div className="flex items-center gap-2 bg-card px-3 py-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">stdin</span>
              <span className="text-[10px] text-muted-foreground">— dasturga beriladigan kirish</span>
            </div>
            <textarea
              rows={3}
              value={stdin}
              onChange={e => setStdin(e.target.value)}
              placeholder="Kirish ma'lumotlari (stdin)..."
              className="w-full resize-none border-t bg-background px-4 py-3 font-mono text-xs outline-none"
            />
          </div>
        </div>

        <div className={'min-h-0 flex-col lg:flex lg:w-1/2 xl:w-2/5 ' + (mobilePanel === 'output' ? 'flex' : 'hidden lg:flex')}>
          <div className="flex shrink-0 items-center gap-1 border-b bg-card px-3 py-1.5">
            <button
              onClick={() => setOutputTab('output')}
              className={
                'flex items-center gap-1 rounded-md px-3 py-1 text-xs font-medium transition-colors ' +
                (outputTab === 'output' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground')
              }
            >
              <Terminal className="h-3 w-3" /> Natija
            </button>
            {hasCompile && (
              <button
                onClick={() => setOutputTab('compile')}
                className={
                  'flex items-center gap-1 rounded-md px-3 py-1 text-xs font-medium transition-colors ' +
                  (outputTab === 'compile' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground')
                }
              >
                <Settings2 className="h-3 w-3" /> Compile
              </button>
            )}
            <button onClick={clearOutput} title="Tozalash" className="ml-auto flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground">
              <Eraser className="h-3 w-3" />
            </button>
          </div>

          {result && (
            <div className="flex shrink-0 flex-wrap items-center gap-3 border-b px-4 py-2">
              <RunBadge result={result} />
              <div className="flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
                {result.run.time && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-2.5 w-2.5" />
                    {result.run.time}ms
                  </span>
                )}
                {result.run.memory && (
                  <span className="flex items-center gap-1">
                    <Cpu className="h-2.5 w-2.5" />
                    {result.run.memory}KB
                  </span>
                )}
                {clientMs !== null && (
                  <span className="flex items-center gap-1">
                    <Hourglass className="h-2.5 w-2.5" />~{clientMs}ms
                  </span>
                )}
                <span>
                  {result.language} {result.version}
                </span>
              </div>
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-auto">
            <div className="p-4">
              {errorMsg ? (
                <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-4">
                  <p className="mb-1 flex items-center gap-1.5 text-xs font-bold text-destructive">
                    <CircleX className="h-3.5 w-3.5" /> Xato
                  </p>
                  <p className="text-xs text-destructive/90">{errorMsg}</p>
                </div>
              ) : running ? (
                <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin text-green-500" />
                  Kod bajarilmoqda...
                </div>
              ) : !result ? (
                <div className="py-16 text-center text-muted-foreground">
                  <Terminal className="mx-auto mb-4 h-10 w-10 opacity-30" />
                  <p className="text-sm">Kodni ishga tushiring</p>
                  <p className="mt-1 text-xs opacity-60">Ctrl+Enter yoki "Ishga tushirish" tugmasi</p>
                </div>
              ) : outputTab === 'output' ? (
                <StageOutput stage={result.run} />
              ) : (
                result.compile && <StageOutput stage={result.compile} />
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function RunBadge({ result }: { result: ExecResult }) {
  const run = result.run;
  if (run.status === 'timed_out')
    return (
      <span className="flex items-center gap-1.5 text-xs font-bold text-amber-500">
        <Clock className="h-3.5 w-3.5" />
        Timeout
      </span>
    );
  if (run.status === 'memory_limit')
    return (
      <span className="flex items-center gap-1.5 text-xs font-bold text-orange-500">
        <Cpu className="h-3.5 w-3.5" />
        Memory Limit
      </span>
    );
  if (run.code === 0)
    return (
      <span className="flex items-center gap-1.5 text-xs font-bold text-green-500">
        <CircleCheck className="h-3.5 w-3.5" />
        OK · exit 0
      </span>
    );
  return (
    <span className="flex items-center gap-1.5 text-xs font-bold text-destructive">
      <CircleX className="h-3.5 w-3.5" />
      Xato · exit {run.code}
    </span>
  );
}

function StageOutput({ stage }: { stage: ExecResult['run'] }) {
  const hasOut = stage.stdout && stage.stdout.length > 0;
  const hasErr = stage.stderr && stage.stderr.length > 0;
  if (!hasOut && !hasErr) return <p className="py-4 text-xs italic text-muted-foreground">Chiqish yo'q</p>;
  return (
    <>
      {hasOut && (
        <div className="mb-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-green-600/70 dark:text-green-500/70">stdout</p>
          <pre className="overflow-auto whitespace-pre-wrap break-all rounded-xl bg-slate-950 p-4 font-mono text-xs text-slate-100">
            {stage.stdout}
          </pre>
        </div>
      )}
      {hasErr && (
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-red-600/70 dark:text-red-500/70">stderr</p>
          <pre className="overflow-auto whitespace-pre-wrap break-all rounded-xl bg-slate-950 p-4 font-mono text-xs text-red-300">
            {stage.stderr}
          </pre>
        </div>
      )}
    </>
  );
}
