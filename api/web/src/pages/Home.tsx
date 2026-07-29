import { useEffect, useRef, useState } from 'react';
import {
  Code2,
  LogIn,
  Gauge,
  Zap,
  ShieldHalf,
  GitBranch,
  Gavel,
  Terminal,
  Plug,
  Github,
  Send,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getToken } from '@/lib/api';
import { useDocumentTitle } from '@/lib/useDocumentTitle';

const FEATURES = [
  {
    icon: Zap,
    color: 'text-sky-400',
    bg: 'bg-sky-500/15',
    title: 'Real vaqtda bajarish',
    desc: 'Kod yuborilishi bilanoq izolyatsiyalangan muhitda ishga tushiriladi va natija soniyalar ichida qaytariladi.',
  },
  {
    icon: ShieldHalf,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/15',
    title: 'Xavfsiz sandbox',
    desc: 'Har bir bajarish isolate sandboxi orqali to\'liq izolyatsiyada amalga oshiriladi. CPU va xotira cheklovlari qo\'llaniladi.',
  },
  {
    icon: GitBranch,
    color: 'text-violet-400',
    bg: 'bg-violet-500/15',
    title: "Ko'p tilli qo'llab-quvvatlash",
    desc: "Python, C++, Java, Rust, Go va boshqa o'nlab tillarda ishlaydi. Har bir til uchun bir necha versiya mavjud.",
  },
  {
    icon: Gavel,
    color: 'text-amber-400',
    bg: 'bg-amber-500/15',
    title: 'Avtomatik tekshirish',
    desc: 'AC, WA, PE, TL, RE, CE — barcha judge verdiktlarini qo\'llab-quvvatlaydi. Maxsus checker ham yozish mumkin.',
  },
  {
    icon: Terminal,
    color: 'text-sky-400',
    bg: 'bg-sky-500/15',
    title: 'stdin / stdout',
    desc: "Standart kiritish-chiqarish hamda fayl orqali ishlash ikkalasi ham to'liq qo'llab-quvvatlanadi.",
  },
  {
    icon: Plug,
    color: 'text-rose-400',
    bg: 'bg-rose-500/15',
    title: 'REST API',
    desc: "To'liq hujjatlashtirilgan REST API orqali istalgan platformaga integratsiya qilish mumkin. Token asosida autentifikatsiya.",
  },
];

function useAnimatedCount(target: number | null, active: boolean) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!active || target === null) return;
    const duration = 1200;
    const start = performance.now();
    let raf: number;
    const step = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(ease * target));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, active]);
  return value;
}

export default function Home() {
  useDocumentTitle("Tekshirish Tizimi — Onlayn kod bajarish va tekshirish platformasi");
  const loggedIn = !!getToken();
  const username = localStorage.getItem('auth_user');
  const statsRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [langs, setLangs] = useState<number | null>(null);
  const [jobs, setJobs] = useState<number | null>(null);
  const [jobsInfinite, setJobsInfinite] = useState(false);
  const [langCounts, setLangCounts] = useState<{ language: string; count: number }[] | null>(null);

  useEffect(() => {
    const el = statsRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    fetch('/api/v2/runtimes')
      .then(r => (r.ok ? r.json() : []))
      .then((rts: { language: string }[]) => {
        setLangs(new Set(rts.map(r => r.language)).size);
        const counts = new Map<string, number>();
        rts.forEach(r => counts.set(r.language, (counts.get(r.language) || 0) + 1));
        setLangCounts(
          [...counts.entries()]
            .map(([language, count]) => ({ language, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 8)
        );
      })
      .catch(() => {});
    fetch('/api/v2/jobs?page=1&limit=1', { headers: { Authorization: `Bearer ${getToken() || ''}` } })
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        const total = data?.total ?? data?.length;
        if (total != null && total > 0) setJobs(total);
        else setJobsInfinite(true);
      })
      .catch(() => setJobsInfinite(true));
  }, [visible]);

  const langCount = useAnimatedCount(langs, visible);
  const jobCount = useAnimatedCount(jobs, visible);

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-50 border-b border-slate-800/60 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-sky-600 shadow-lg shadow-sky-500/30">
              <Code2 className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold tracking-tight text-white">Tekshirish Tizimi</span>
          </div>
          {loggedIn ? (
            <div className="flex items-center gap-2">
              <span className="hidden text-xs text-slate-400 sm:block">{username}</span>
              <Button asChild className="gap-2 bg-sky-500 hover:bg-sky-400">
                <a href="/dashboard">
                  <Gauge className="h-3.5 w-3.5" />
                  Dashboard
                </a>
              </Button>
            </div>
          ) : (
            <Button asChild className="gap-2 bg-sky-500 hover:bg-sky-400">
              <a href="/login">
                <LogIn className="h-3.5 w-3.5" />
                Kirish
              </a>
            </Button>
          )}
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-0 h-[400px] w-[600px] -translate-x-1/2 rounded-full bg-sky-500/10 blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-20 text-center sm:px-6">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-sky-500/20 bg-sky-500/10 px-4 py-1.5 text-xs font-medium text-sky-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-400" />
            Onlayn dasturlash masalalari tekshiruv tizimi
          </div>
          <h1 className="mb-5 text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
            Kodingizni yuboring —
            <br />
            <span className="bg-gradient-to-r from-sky-400 to-blue-400 bg-clip-text text-transparent">tizim tekshirsin</span>
          </h1>
          <p className="mx-auto mb-9 max-w-xl text-base leading-relaxed text-slate-400 sm:text-lg">
            Ko'p sonli dasturlash tillarini qo'llab-quvvatlovchi online judge tizimi. Kodingizni yuboring, natijani real
            vaqtda oling.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="gap-2 bg-sky-500 shadow-xl shadow-sky-500/25 hover:-translate-y-0.5 hover:bg-sky-400 hover:shadow-sky-500/40">
              <a href="/login">
                <LogIn className="h-4 w-4" />
                Tizimga kirish
              </a>
            </Button>
            <Button asChild size="lg" variant="outline" className="gap-2 border-slate-700 bg-slate-800 text-slate-300 hover:-translate-y-0.5 hover:border-slate-600 hover:bg-slate-700 hover:text-white">
              <a href="/api-docs">
                <Code2 className="h-4 w-4" />
                API hujjatlari
              </a>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(f => (
            <div
              key={f.title}
              className="rounded-2xl border border-slate-800 bg-slate-900 p-6 transition-all hover:-translate-y-0.5 hover:border-sky-500/40"
            >
              <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl ${f.bg}`}>
                <f.icon className={`h-4 w-4 ${f.color}`} />
              </div>
              <h3 className="mb-2 font-bold text-white">{f.title}</h3>
              <p className="text-sm leading-relaxed text-slate-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section ref={statsRef} className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50 p-8 shadow-[0_0_80px_-20px_rgba(14,165,233,0.35)] sm:p-10">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-500/50 to-transparent" />
          <div className="mb-8 text-center">
            <h2 className="mb-2 text-2xl font-bold text-white sm:text-3xl">Tizim ko'rsatkichlari</h2>
            <p className="text-sm text-slate-500">Real vaqtda yangilanadigan statistika</p>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
            <StatCard value={langs === null ? '—' : `${langCount}+`} color="text-sky-400" label="Dasturlash tillari" sub="versiyalar bilan" />
            <StatCard
              value={jobsInfinite ? '∞' : jobs === null ? '—' : `${jobCount}+`}
              color="text-emerald-400"
              label="Jami tekshirishlar"
              sub="hozircha"
            />
            <StatCard value="10s" color="text-violet-400" label="Maks. vaqt limiti" sub="har bir masala uchun" />
            <StatCard value="256MB" color="text-amber-400" label="Maks. xotira" sub="har bir bajarish uchun" />
          </div>

          {langCounts && langCounts.length > 0 && (
            <div className="mt-8 border-t border-slate-800 pt-8">
              <h3 className="mb-5 text-sm font-semibold text-slate-300">Eng ko'p versiyali tillar</h3>
              <LanguageBarChart data={langCounts} />
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/15">
                <Terminal className="h-3.5 w-3.5 text-sky-400" />
              </div>
              <div>
                <div className="text-sm font-semibold text-white">Matnli oqim</div>
                <div className="text-xs text-slate-500">stdin / stdout</div>
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs leading-relaxed text-emerald-400">
              print(sum(map(int, input().split())))
            </div>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15">
                <Code2 className="h-3.5 w-3.5 text-amber-400" />
              </div>
              <div>
                <div className="text-sm font-semibold text-white">Faylli oqim</div>
                <div className="text-xs text-slate-500">input.txt / output.txt</div>
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs leading-relaxed text-emerald-400">
              fin&nbsp;&nbsp;= open("input.txt",&nbsp;&nbsp;"r")
              <br />
              fout = open("output.txt", "w")
              <br />
              a, b = map(int, fin.readline().split())
              <br />
              fout.write(str(a + b) + "\n")
            </div>
          </div>
        </div>
      </section>

      <footer className="mt-auto border-t border-slate-800 py-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-xs text-slate-600 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded bg-sky-500/20">
              <Code2 className="h-2.5 w-2.5 text-sky-500" />
            </div>
            <span>Tekshirish tizimi &copy; 2025</span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="https://t.me/shoyimobloqulov"
              target="_blank"
              rel="noopener"
              className="flex items-center gap-1.5 text-slate-500 transition-colors hover:text-sky-400"
            >
              <Send className="h-3.5 w-3.5" />
              Shoyim Obloqulov
            </a>
            <a
              href="https://github.com/shoyim/compiler"
              target="_blank"
              rel="noopener"
              className="flex items-center gap-1.5 text-slate-500 transition-colors hover:text-slate-300"
            >
              <Github className="h-3.5 w-3.5" />
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function LanguageBarChart({ data }: { data: { language: string; count: number }[] }) {
  const max = Math.max(...data.map(d => d.count), 1);
  return (
    <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
      {data.map(d => (
        <div key={d.language}>
          <div className="mb-1.5 flex items-baseline justify-between gap-2">
            <span className="truncate text-xs font-medium capitalize text-slate-300">{d.language}</span>
            <span className="shrink-0 font-mono text-[11px] text-slate-500">{d.count} versiya</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-2 rounded-r-full bg-gradient-to-r from-sky-500 to-sky-400 transition-[width] duration-700 ease-out"
              style={{ width: `${Math.max((d.count / max) * 100, 4)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function StatCard({ value, color, label, sub }: { value: string; color: string; label: string; sub: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 text-center">
      <div className={`mb-1 text-3xl font-extrabold sm:text-4xl ${color}`}>{value}</div>
      <div className="text-xs font-medium text-slate-400 sm:text-sm">{label}</div>
      <div className="mt-1 text-xs text-slate-600">{sub}</div>
    </div>
  );
}
