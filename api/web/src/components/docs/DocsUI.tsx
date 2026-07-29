import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Copy, Check, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

export type Method = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'WS';

const METHOD_STYLES: Record<Method, string> = {
  GET: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
  POST: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
  PUT: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400',
  DELETE: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
  WS: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400',
};

export function MethodBadge({ m }: { m: Method }) {
  return <span className={cn('rounded-lg px-2.5 py-1 text-xs font-bold', METHOD_STYLES[m])}>{m}</span>;
}

export function Section({ id, title, children }: { id: string; title?: string; children: ReactNode }) {
  return (
    <section id={id} data-docsection className="mb-10 scroll-mt-[130px] lg:scroll-mt-20">
      {title && <h2 className="mb-4 border-b pb-2 text-lg font-bold">{title}</h2>}
      {children}
    </section>
  );
}

export function EndpointHeader({ method, path, auth }: { method: Method; path: string; auth: 'token' | 'open' }) {
  return (
    <div className="mb-4 flex items-center gap-3 border-b pb-2">
      <MethodBadge m={method} />
      <code className="font-mono text-base">{path}</code>
      <span className="ml-auto flex items-center gap-1 rounded-lg bg-muted px-2 py-1 text-xs text-muted-foreground">
        {auth === 'token' && <Lock className="h-3 w-3" />}
        {auth === 'token' ? 'Token kerak' : 'Ochiq'}
      </span>
    </div>
  );
}

export function H3({ children }: { children: ReactNode }) {
  return <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{children}</h3>;
}

export function P({ children }: { children: ReactNode }) {
  return <p className="mb-4 text-sm text-muted-foreground">{children}</p>;
}

export function C({ children }: { children: ReactNode }) {
  return <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs text-foreground">{children}</code>;
}

export function DocsTable({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) {
  return (
    <div className="mb-6 overflow-x-auto rounded-lg border">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="bg-muted">
            {headers.map((h, i) => (
              <th key={i} className="px-3 py-2 text-left font-semibold text-muted-foreground">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r, i) => (
            <tr key={i} className="hover:bg-muted/50">
              {r.map((cell, j) => (
                <td key={j} className="px-3 py-2 align-top text-muted-foreground">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CopyBtn({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(code.trim()).then(() => {
      setCopied(true);
      toast.success('Nusxalandi');
      setTimeout(() => setCopied(false), 1500);
    });
  }
  return (
    <button
      onClick={copy}
      className="absolute right-3 top-3 flex items-center gap-1 rounded-md bg-slate-800 px-2 py-1 text-xs text-slate-400 transition-colors hover:text-slate-200"
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

export function CodeBlock({ code, response }: { code: string; response?: boolean }) {
  return (
    <div className="relative mb-6 rounded-xl bg-slate-950">
      <CopyBtn code={code} />
      <pre className={cn('overflow-x-auto whitespace-pre-wrap break-all p-5 font-mono text-xs', response ? 'text-green-400' : 'text-slate-200')}>
        {code.trim()}
      </pre>
    </div>
  );
}

export interface CodeTab {
  key: string;
  label: string;
  code: string;
  response?: boolean;
}

export function CodeTabs({ tabs }: { tabs: CodeTab[] }) {
  const [active, setActive] = useState(tabs[0].key);
  const activeTab = tabs.find(t => t.key === active)!;
  return (
    <div className="mb-6">
      <div className="flex flex-wrap gap-1 border-b">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setActive(t.key)}
            className={cn(
              'border-b-2 px-3 py-2 text-xs font-medium transition-colors',
              active === t.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="relative rounded-b-xl rounded-tr-xl bg-slate-950">
        <CopyBtn code={activeTab.code} />
        <pre
          className={cn(
            'overflow-x-auto whitespace-pre-wrap break-all p-5 font-mono text-xs',
            activeTab.response ? 'text-green-400' : 'text-slate-200'
          )}
        >
          {activeTab.code.trim()}
        </pre>
      </div>
    </div>
  );
}

export function InfoBox({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-4 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
      <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
      <div>
        <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">{title}</p>
        <div className="mt-1 text-xs text-amber-700 dark:text-amber-400">{children}</div>
      </div>
    </div>
  );
}
