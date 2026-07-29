import { useEffect, useRef, useState } from 'react';
import { Zap, Satellite, ShieldHalf } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { useAuth } from '@/lib/useAuth';
import { DOCS_NAV } from '@/components/docs/nav';
import { Section, EndpointHeader, H3, P, C, DocsTable, CodeBlock, CodeTabs, InfoBox } from '@/components/docs/DocsUI';
import { useDocumentTitle } from '@/lib/useDocumentTitle';

export default function ApiDocs() {
  useDocumentTitle('API Hujjatlari — Compiler');
  const { ready, role } = useAuth(true);
  const [active, setActive] = useState('intro');
  const mainRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ready) return;
    const sections = document.querySelectorAll('[data-docsection]');
    const obs = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) setActive(entry.target.id);
        });
      },
      { rootMargin: '-20% 0px -70% 0px' }
    );
    sections.forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, [ready]);

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://your-server:2000';

  return (
    <AppShell ready={ready} role={role}>
      <div className="sticky top-[61px] z-30 border-b bg-card px-4 py-2.5 shadow-sm lg:hidden">
        <select
          onChange={e => {
            if (e.target.value) {
              window.location.hash = e.target.value;
              e.target.value = '';
            }
          }}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">— Bo'limga o'tish —</option>
          {DOCS_NAV.map(group => (
            <optgroup key={group.label} label={group.label}>
              {group.items.map(item => (
                <option key={item.id} value={'#' + item.id}>
                  {item.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <div className="mx-auto flex w-full max-w-7xl flex-1">
        <aside className="sticky top-[61px] hidden h-[calc(100vh-61px)] w-64 shrink-0 overflow-y-auto border-r bg-card/60 px-3 py-6 lg:block">
          {DOCS_NAV.map(group => (
            <div key={group.label} className="mb-6">
              <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">{group.label}</p>
              <nav className="space-y-0.5 text-sm">
                {group.items.map(item => (
                  <a
                    key={item.id}
                    href={'#' + item.id}
                    className={
                      'relative block rounded-lg py-1.5 pl-3.5 pr-3 text-xs transition-colors ' +
                      (active === item.id
                        ? 'bg-primary/10 font-semibold text-primary'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground')
                    }
                  >
                    {active === item.id && (
                      <span className="absolute bottom-1.5 left-0 top-1.5 w-0.5 rounded-full bg-primary" />
                    )}
                    {item.label}
                  </a>
                ))}
              </nav>
            </div>
          ))}
        </aside>

        <main ref={mainRef} className="min-w-0 flex-1 px-4 py-8 sm:px-8" style={{ maxWidth: '56rem' }}>
          <Section id="intro">
            <h1 className="mb-2 text-2xl font-bold">Compiler API Hujjatlari</h1>
            <p className="mb-6 text-muted-foreground">
              Bu API orqali 20+ dasturlash tilida kodni bajarish mumkin. Barcha so'rovlar uchun Bearer token talab qilinadi.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-sky-100 bg-sky-50 p-4 dark:border-sky-800 dark:bg-sky-900/20">
                <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-sky-100 dark:bg-sky-900/40">
                  <Zap className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                </div>
                <p className="text-sm font-semibold text-sky-900 dark:text-sky-300">Tez bajarish</p>
                <p className="mt-1 text-xs text-sky-600 dark:text-sky-400">HTTP POST bilan bir necha millisekund ichida natija</p>
              </div>
              <div className="rounded-xl border border-purple-100 bg-purple-50 p-4 dark:border-purple-800 dark:bg-purple-900/20">
                <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/40">
                  <Satellite className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                </div>
                <p className="text-sm font-semibold text-purple-900 dark:text-purple-300">Real-time WebSocket</p>
                <p className="mt-1 text-xs text-purple-600 dark:text-purple-400">stdout/stderr oqimini jonli kuzating</p>
              </div>
              <div className="rounded-xl border border-green-100 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
                <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/40">
                  <ShieldHalf className="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
                <p className="text-sm font-semibold text-green-900 dark:text-green-300">Xavfsiz sandbox</p>
                <p className="mt-1 text-xs text-green-600 dark:text-green-400">Har bir kod alohida izolyatsiyada ishlaydi</p>
              </div>
            </div>
          </Section>

          <Section id="auth-section" title="Autentifikatsiya">
            <P>
              Barcha himoyalangan endpointlar uchun <C>Authorization</C> yoki <C>X-Auth-Token</C> sarlavhasi talab qilinadi.
            </P>
            <div className="mb-4 rounded-xl bg-slate-950 p-4">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">HTTP sarlavha</p>
              <code className="font-mono text-sm text-green-400">Authorization: Bearer &lt;token&gt;</code>
              <br />
              <code className="mt-1 block font-mono text-sm text-slate-500">X-Auth-Token: &lt;token&gt;</code>
            </div>
            <InfoBox title="Token olish">
              Token olish uchun <C>POST /auth/login</C> ga username va password yuboring, yoki Dashboard →{' '}
              <a href="/tokens" className="underline">
                Tokenlar
              </a>{' '}
              sahifasidan admin sizga yangi API token yaratib bersin.
            </InfoBox>
          </Section>

          <Section id="base-url" title="Base URL">
            <div className="rounded-xl bg-slate-950 p-4">
              <code className="font-mono text-sm text-sky-300">{baseUrl}</code>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Barcha endpoint'lar shu manzilga nisbatan ko'rsatilgan.</p>
          </Section>

          <Section id="execute">
            <EndpointHeader method="POST" path="/api/v2/execute" auth="token" />
            <P>Kodni serverda izolyatsiyalangan muhitda bajaradi va natijani qaytaradi.</P>

            <H3>So'rov tanasi (Request Body)</H3>
            <DocsTable
              headers={['Maydon', 'Tur', 'Majburiy', 'Tavsif']}
              rows={[
                [<C>language</C>, 'string', <b className="text-red-500">Ha</b>, 'Dasturlash tili nomi (masalan: "python", "javascript")'],
                [<C>version</C>, 'string', <b className="text-red-500">Ha</b>, 'Til versiyasi (masalan: "3.12.0"). Wildcard: "*"'],
                [<C>files</C>, 'array', <b className="text-red-500">Ha</b>, "Fayl ob'ektlari ro'yxati (kamida bitta, content maydoni bilan)"],
                [<C>files[].name</C>, 'string', "Yo'q", 'Fayl nomi (ko\'rsatilmasa default nom ishlatiladi)'],
                [<C>files[].content</C>, 'string', <b className="text-red-500">Ha</b>, 'Fayl tarkibi (kod matni)'],
                [<C>files[].encoding</C>, 'string', "Yo'q", '"utf8" (default) yoki "base64"'],
                [<C>stdin</C>, 'string', "Yo'q", "Dasturga beriluvchi standart kirish ma'lumoti"],
                [<C>args</C>, 'array', "Yo'q", 'Buyruq qatori argumentlari (string ro\'yxat)'],
                [<C>run_timeout</C>, 'number', "Yo'q", 'Bajarish vaqt chegarasi (millisekund)'],
                [<C>run_memory_limit</C>, 'number', "Yo'q", 'Xotira chegarasi (bayt)'],
                [<C>compile_timeout</C>, 'number', "Yo'q", 'Kompilyatsiya vaqt chegarasi (millisekund)'],
              ]}
            />

            <H3>Javob (Response)</H3>
            <DocsTable
              headers={['Maydon', 'Tavsif']}
              rows={[
                [<C>language</C>, 'Bajarilgan tilning nomi'],
                [<C>version</C>, 'Bajarilgan versiya'],
                [<C>run.stdout</C>, 'Dastur chiqargan matn (stdout)'],
                [<C>run.stderr</C>, 'Xato chiqishi (stderr)'],
                [<C>run.code</C>, 'Chiqish kodi (0 = muvaffaqiyat)'],
                [<C>run.time</C>, 'Bajarish vaqti (millisekund, string)'],
                [<C>run.memory</C>, 'Ishlatilgan xotira (KB, string)'],
                [<C>run.status</C>, '"ok", "timed_out", "memory_limit"'],
                [<C>compile</C>, "Kompilyatsiya bosqichi ma'lumotlari (agar mavjud bo'lsa)"],
              ]}
            />

            <CodeTabs
              tabs={[
                {
                  key: 'curl',
                  label: 'cURL',
                  code: `curl -X POST https://your-server:2000/api/v2/execute \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "language": "python",
    "version": "*",
    "files": [
      {
        "name": "main.py",
        "content": "name = input()\\nprint(f\\"Salom, {name}!\\")"
      }
    ],
    "stdin": "Dunyo"
  }'`,
                },
                {
                  key: 'js',
                  label: 'JavaScript',
                  code: `const response = await fetch('https://your-server:2000/api/v2/execute', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    language: 'python',
    version: '*',
    files: [
      {
        name: 'main.py',
        content: 'name = input()\\nprint(f"Salom, {name}!")',
      },
    ],
    stdin: 'Dunyo',
  }),
});

const result = await response.json();
console.log(result.run.stdout);`,
                },
                {
                  key: 'python',
                  label: 'Python',
                  code: `import requests

response = requests.post(
    'https://your-server:2000/api/v2/execute',
    headers={
        'Authorization': 'Bearer YOUR_TOKEN',
        'Content-Type': 'application/json',
    },
    json={
        'language': 'python',
        'version': '*',
        'files': [
            {
                'name': 'main.py',
                'content': 'name = input()\\nprint(f"Salom, {name}!")',
            }
        ],
        'stdin': 'Dunyo',
    }
)

result = response.json()
print(result['run']['stdout'])`,
                },
                {
                  key: 'response',
                  label: 'Javob namunasi',
                  response: true,
                  code: `{
  "language": "python",
  "version": "3.12.0",
  "run": {
    "stdout": "Salom, Dunyo!\\n",
    "stderr": "",
    "output": "Salom, Dunyo!\\n",
    "code": 0,
    "signal": null,
    "message": null,
    "status": "ok",
    "time": "38",
    "cpu_time": "18",
    "memory": "9"
  }
}`,
                },
              ]}
            />
          </Section>

          <Section id="ws-connect">
            <EndpointHeader method="WS" path="/api/v2/connect" auth="token" />
            <P>WebSocket orqali kodni real-time rejimda bajaradi. stdout/stderr oqimini darhol ko'rish imkonini beradi.</P>

            <H3>Ulanish URL</H3>
            <div className="mb-6 rounded-xl bg-slate-950 p-4 font-mono text-sm text-sky-300">
              ws://your-server:2000/api/v2/connect?authorization=Bearer%20YOUR_TOKEN
            </div>

            <H3>Xabar turlari (Client → Server)</H3>
            <div className="mb-6 space-y-3">
              <MsgExample title='type: "init" — Kodni boshlash'>
                {`{
  "type": "init",
  "language": "python",
  "version": "*",
  "files": [{ "content": "print(input())" }],
  "stdin": "",
  "run_timeout": 10000
}`}
              </MsgExample>
              <MsgExample title="type: &quot;data&quot; — stdin ma'lumoti yuborish">{`{ "type": "data", "stream": "stdin", "data": "Salom\\n" }`}</MsgExample>
              <MsgExample title='type: "signal" — Signal yuborish'>{`{ "type": "signal", "signal": "SIGKILL" }`}</MsgExample>
            </div>

            <H3>Xabar turlari (Server → Client)</H3>
            <div className="mb-6 space-y-3">
              <MsgExample title='type: "runtime" — Runtime tayyor'>{`{ "type": "runtime", "language": "python", "version": "3.12.0" }`}</MsgExample>
              <MsgExample title='type: "data" — stdout/stderr oqimi'>{`{ "type": "data", "stream": "stdout", "data": "Chiqish matni\\n" }`}</MsgExample>
              <MsgExample title="type: &quot;stage&quot; — Bosqich o'zgardi (compile → run)">{`{ "type": "stage", "stage": "run" }`}</MsgExample>
              <MsgExample title='type: "exit" — Bajarilish tugadi'>{`{ "type": "exit", "stage": "run", "code": 0, "signal": null, "status": "ok" }`}</MsgExample>
            </div>

            <CodeTabs
              tabs={[
                {
                  key: 'js',
                  label: 'JavaScript',
                  code: `const token = 'YOUR_TOKEN';
const ws = new WebSocket(
  \`ws://your-server:2000/api/v2/connect\`,
  [],
);

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'init',
    language: 'python',
    version: '*',
    files: [{ content: 'print(input("Ism: "))' }],
  }));
};

ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.type === 'runtime') {
    ws.send(JSON.stringify({ type: 'data', stream: 'stdin', data: 'Ali\\n' }));
  }
  if (msg.type === 'data') {
    process.stdout.write(msg.data);
  }
  if (msg.type === 'exit') {
    console.log('Tugadi, kod:', msg.code);
  }
};

ws.onerror = (e) => console.error('WS xato:', e.message);`,
                },
                {
                  key: 'python',
                  label: 'Python',
                  code: `import json
import websocket

def on_open(ws):
    ws.send(json.dumps({
        'type': 'init',
        'language': 'python',
        'version': '*',
        'files': [{'content': 'print(input("Ism: "))'}],
    }))

def on_message(ws, message):
    msg = json.loads(message)
    if msg['type'] == 'runtime':
        ws.send(json.dumps({'type': 'data', 'stream': 'stdin', 'data': 'Ali\\n'}))
    elif msg['type'] == 'data':
        print(msg['data'], end='', flush=True)
    elif msg['type'] == 'exit':
        print(f"\\nTugadi, kod: {msg['code']}")
        ws.close()

ws = websocket.WebSocketApp(
    'ws://your-server:2000/api/v2/connect',
    header={'Authorization': 'Bearer YOUR_TOKEN'},
    on_open=on_open,
    on_message=on_message,
)
ws.run_forever()`,
                },
              ]}
            />
          </Section>

          <Section id="runtimes">
            <EndpointHeader method="GET" path="/api/v2/runtimes" auth="open" />
            <P>O'rnatilgan runtimelar ro'yxatini qaytaradi. Token talab qilinmaydi.</P>
            <CodeTabs
              tabs={[
                { key: 'curl', label: 'cURL', code: `curl https://your-server:2000/api/v2/runtimes` },
                {
                  key: 'response',
                  label: 'Javob namunasi',
                  response: true,
                  code: `[
  {
    "language": "python",
    "version": "3.12.0",
    "aliases": ["py", "py3", "python3"],
    "runtime": null
  },
  {
    "language": "javascript",
    "version": "20.11.1",
    "aliases": ["node", "nodejs", "js"],
    "runtime": "node"
  }
]`,
                },
              ]}
            />
          </Section>

          <Section id="check">
            <EndpointHeader method="POST" path="/api/v2/check" auth="token" />
            <P>
              Kodni bajaradi, natijani checker orqali tekshiradi va hukm (verdict) qaytaradi. Online Judge tizimlarida test caseni
              baholash uchun ishlatiladi.
            </P>

            <H3>So'rov tanasi (Request Body)</H3>
            <DocsTable
              headers={['Maydon', 'Tur', 'Majburiy', 'Tavsif']}
              rows={[
                [<C>language</C>, 'string', <b className="text-red-500">Ha</b>, 'Tekshiriladigan koding dasturlash tili'],
                [
                  <C>version</C>,
                  'string',
                  <b className="text-red-500">Ha</b>,
                  <>
                    Til versiyasi. Wildcard: <C>"*"</C>
                  </>,
                ],
                [
                  <C>files</C>,
                  'array',
                  <b className="text-red-500">Ha</b>,
                  <>
                    Foydalanuvchi kodi (kamida bitta fayl, <C>content</C> maydoni bilan)
                  </>,
                ],
                [
                  <C>expected_output</C>,
                  'string',
                  <b className="text-red-500">Ha</b>,
                  <>
                    Muallif javobi — checker <C>answer.txt</C> sifatida o'qiydi
                  </>,
                ],
                [
                  <C>stdin</C>,
                  'string',
                  "Yo'q",
                  <>
                    Kiruvchi ma'lumot (stdin). Checker <C>input.txt</C> sifatida o'qiydi
                  </>,
                ],
                [
                  <C>comparator</C>,
                  'string',
                  "Yo'q",
                  <>
                    Taqqoslash usuli: <C>case_insensitive</C> (default) · <C>default</C> · <C>any_of</C> · <C>program</C>
                  </>,
                ],
                [
                  <C>checker_type</C>,
                  'string',
                  "Yo'q",
                  <>
                    Checker turi: <C>default</C> (oddiy) · <C>interactive</C> (real vaqtli suhbat)
                  </>,
                ],
                [
                  <C>checker</C>,
                  'string',
                  "Yo'q",
                  <>
                    Python checker kodi (<C>comparator=program</C> yoki <C>checker_type=interactive</C> bilan)
                  </>,
                ],
                [
                  <C>validator</C>,
                  'object',
                  "Yo'q",
                  <>
                    Kod matni tahlili: <C>ban_loops</C>, <C>ban_keywords</C>, <C>max_chars</C>, <C>max_lines</C>, <C>ban_operators</C>,{' '}
                    <C>require_operators</C>, <C>custom_code</C>
                  </>,
                ],
                [<C>run_timeout</C>, 'number', "Yo'q", 'Bajarish vaqt chegarasi (millisekund)'],
                [<C>run_memory_limit</C>, 'number', "Yo'q", 'Xotira chegarasi (bayt)'],
                [<C>compile_timeout</C>, 'number', "Yo'q", 'Kompilyatsiya vaqt chegarasi (millisekund)'],
              ]}
            />

            <H3>Javob (Response)</H3>
            <DocsTable
              headers={['Maydon', 'Tavsif']}
              rows={[
                [<C>language</C>, 'Bajarilgan til'],
                [<C>version</C>, 'Bajarilgan versiya'],
                [
                  <C>verdict</C>,
                  <>
                    <C>AC</C> · <C>WA</C> · <C>PE</C> · <C>TL</C> · <C>ML</C> · <C>CE</C> · <C>RE</C> · <C>OL</C>
                  </>,
                ],
                [<C>checker_exit</C>, <>Checker dasturining chiqish kodi (raqam); CE/TL/RE holatda <C>null</C></>],
                [<C>validator_failed</C>, <>Validator shartlari bajarilmasa <C>true</C>; aks holda mavjud emas</>],
                [<C>run</C>, "Foydalanuvchi kodining bajarilish ma'lumotlari (stdout, stderr, time, memory…)"],
                [<C>compile</C>, 'Kompilyatsiya bosqichi (agar til kompilyatsiya talab qilsa)'],
              ]}
            />

            <H3>Verdict qiymatlari</H3>
            <DocsTable
              headers={['Verdict', "To'liq nomi", 'Sabab']}
              rows={[
                [
                  <b className="font-mono text-green-600 dark:text-green-400">AC</b>,
                  'Accepted',
                  <>
                    Checker <C>exit(0xAC)</C> (172) qaytardi — javob to'g'ri
                  </>,
                ],
                [
                  <b className="font-mono text-red-500 dark:text-red-400">WA</b>,
                  'Wrong Answer',
                  <>
                    Checker <C>exit(0xAD)</C> (173) qaytardi yoki noma'lum kod
                  </>,
                ],
                [
                  <b className="font-mono text-amber-500 dark:text-amber-400">PE</b>,
                  'Presentation Error',
                  <>
                    Checker <C>exit(0xAE)</C> (174) qaytardi — format xatosi
                  </>,
                ],
                [
                  <b className="font-mono text-orange-500 dark:text-orange-400">TL</b>,
                  'Time Limit',
                  <>
                    Kod vaqt limitidan oshdi <i>yoki</i> checker <C>exit(0xAF)</C> (175) qaytardi
                  </>,
                ],
                [
                  <b className="font-mono text-blue-500 dark:text-blue-400">ML</b>,
                  'Memory Limit',
                  <>
                    Checker <C>exit(0xB0)</C> (176) qaytardi — xotira chegarasi
                  </>,
                ],
                [<b className="font-mono text-red-600 dark:text-red-400">CE</b>, 'Compile Error', 'Kompilyatsiya muvaffaqiyatsiz tugadi'],
                [
                  <b className="font-mono text-red-500 dark:text-red-400">RE</b>,
                  'Runtime Error',
                  "Kod bajarilishda xatolik (segfault, exception, nol bo'lmagan chiqish kodi)",
                ],
                [<b className="font-mono text-purple-500 dark:text-purple-400">OL</b>, 'Output Limit', 'Chiqish hajmi limitidan oshdi'],
              ]}
            />

            <CodeTabs
              tabs={[
                {
                  key: 'curl',
                  label: 'cURL',
                  code: `curl -X POST https://your-server:2000/api/v2/check \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "language": "python",
    "version": "*",
    "files": [
      { "content": "a, b = map(int, input().split())\\nprint(a + b)" }
    ],
    "stdin": "3 5",
    "expected_output": "8\\n"
  }'`,
                },
                {
                  key: 'js',
                  label: 'JavaScript',
                  code: `const response = await fetch('https://your-server:2000/api/v2/check', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    language: 'python',
    version: '*',
    files: [{ content: 'a, b = map(int, input().split())\\nprint(a + b)' }],
    stdin: '3 5',
    expected_output: '8\\n',
  }),
});

const result = await response.json();
console.log(result.verdict); // "AC"`,
                },
                {
                  key: 'python',
                  label: 'Python',
                  code: `import requests

response = requests.post(
    'https://your-server:2000/api/v2/check',
    headers={
        'Authorization': 'Bearer YOUR_TOKEN',
        'Content-Type': 'application/json',
    },
    json={
        'language': 'python',
        'version': '*',
        'files': [{'content': 'a, b = map(int, input().split())\\nprint(a + b)'}],
        'stdin': '3 5',
        'expected_output': '8\\n',
    }
)

result = response.json()
print(result['verdict'])  # AC`,
                },
                {
                  key: 'response',
                  label: 'Javob namunasi',
                  response: true,
                  code: `{
  "language": "python",
  "version": "3.12.0",
  "verdict": "AC",
  "checker_exit": 172,
  "run": {
    "stdout": "8\\n",
    "stderr": "",
    "code": 0,
    "signal": null,
    "status": null,
    "time": "42",
    "memory": "9"
  }
}`,
                },
              ]}
            />
          </Section>

          <Section id="check-demo">
            <EndpointHeader method="POST" path="/api/v2/check/demo" auth="open" />
            <P>
              <C>/check</C> bilan bir xil, lekin token talab qilinmaydi. Resurs cheklovi avtomatik qo'llanadi:
            </P>
            <div className="mb-4 space-y-1 rounded-xl border bg-muted/40 px-4 py-3 font-mono text-xs text-muted-foreground">
              <div>
                <span className="text-muted-foreground/60">run_timeout</span> ≤ <span className="text-amber-500">5 000</span> ms
              </div>
              <div>
                <span className="text-muted-foreground/60">compile_timeout</span> ≤ <span className="text-amber-500">8 000</span> ms
              </div>
              <div>
                <span className="text-muted-foreground/60">run_memory_limit</span> ≤{' '}
                <span className="text-amber-500">67 108 864</span> bayt (64 MB)
              </div>
            </div>
            <CodeBlock
              code={`curl -X POST https://your-server:2000/api/v2/check/demo \\
  -H "Content-Type: application/json" \\
  -d '{
    "language": "cpp",
    "version": "*",
    "files": [
      { "content": "#include<bits/stdc++.h>\\nusing namespace std;\\nint main(){int a,b;cin>>a>>b;cout<<a+b;}" }
    ],
    "stdin": "3 5",
    "expected_output": "8"
  }'`}
            />
          </Section>

          <Section id="checker-guide" title="Checker yozish qo'llanmasi">
            <P>Checker yoki validator kodi bajarilganda quyidagi fayllar avtomatik taqdim etiladi:</P>
            <DocsTable
              headers={['Fayl', 'Tarkibi']}
              rows={[
                [<C>input.txt</C>, <>So'rovdagi <C>stdin</C> maydoni (masalaning kiruvchi ma'lumoti)</>],
                [<C>answer.txt</C>, <>So'rovdagi <C>expected_output</C> maydoni (muallif to'g'ri javobi)</>],
                [<C>user.txt</C>, 'Foydalanuvchi dasturining stdout chiqishi'],
                [<C>solution.txt</C>, <>Foydalanuvchi yuborgan manba kodi (<C>files[0].content</C>)</>],
              ]}
            />

            <H3>Chiqish kodlari (Exit codes)</H3>
            <DocsTable
              headers={['Konstanta', 'Hex / Dec', 'Verdict', "Ma'nosi"]}
              rows={[
                [
                  <span className="font-mono text-green-600 dark:text-green-400">exit(0xAC)</span>,
                  '172',
                  <b className="text-green-600 dark:text-green-400">AC</b>,
                  "Accepted — javob to'g'ri",
                ],
                [
                  <span className="font-mono text-red-500 dark:text-red-400">exit(0xAD)</span>,
                  '173',
                  <b className="text-red-500 dark:text-red-400">WA</b>,
                  "Wrong Answer — natija noto'g'ri",
                ],
                [
                  <span className="font-mono text-amber-500 dark:text-amber-400">exit(0xAE)</span>,
                  '174',
                  <b className="text-amber-500 dark:text-amber-400">PE</b>,
                  "Presentation Error — format xatosi (ortiqcha bo'sh joy)",
                ],
                [
                  <span className="font-mono text-orange-500 dark:text-orange-400">exit(0xAF)</span>,
                  '175',
                  <b className="text-orange-500 dark:text-orange-400">TL</b>,
                  'Time Limit — checker vaqt chegarasini belgiladi',
                ],
                [
                  <span className="font-mono text-blue-500 dark:text-blue-400">exit(0xB0)</span>,
                  '176',
                  <b className="text-blue-500 dark:text-blue-400">ML</b>,
                  'Memory Limit — checker xotira chegarasini belgiladi',
                ],
              ]}
            />

            <H3>
              Comparator turlari (<span className="normal-case">comparator</span> parametri)
            </H3>
            <DocsTable
              headers={['Qiymat', 'Tavsif']}
              rows={[
                [<C>case_insensitive</C>, <><b>Default.</b> Harf katta-kichikligini hisobga olmay solishtiradi (YES = yes = Yes)</>],
                [<C>default</C>, "Aynan solishtirish — trailing whitespace normallanadi, katta-kichik muhim"],
                [
                  <C>any_of</C>,
                  <>
                    Ko'p to'g'ri javob — <C>expected_output</C> da javoblar <C>{'\\n---\\n'}</C> bilan ajratiladi
                  </>,
                ],
                [
                  <C>program</C>,
                  <>
                    Maxsus Python checker kodi (<C>checker</C> maydonida beriladi)
                  </>,
                ],
              ]}
            />

            <H3>case_insensitive comparator kodi (default)</H3>
            <CodeBlock
              code={`ac = 0xAC
wa = 0xAD

a_in  = open("input.txt",   "r", encoding="utf-8").read()
a_out = open("answer.txt",  "r", encoding="utf-8").read()
u_out = open("user.txt",    "r", encoding="utf-8").read()
u_code= open("solution.txt","r", encoding="utf-8").read()

if a_out == u_out:
    exit(ac)
a = a_out.replace("\\r", "").split("\\n")
b = u_out.replace("\\r", "").split("\\n")
while a and a[-1] == "": a.pop()
while b and b[-1] == "": b.pop()
if len(a) != len(b):
    exit(wa)
for x, y in zip(a, b):
    if x.lower() != y.lower():
        exit(wa)
exit(ac)`}
            />

            <H3>Program comparator misollari</H3>
            <CodeTabs
              tabs={[
                {
                  key: 'exact',
                  label: 'Aynan solishtirish',
                  code: `# comparator=program, case-sensitive aynan solishtirish
a_out = open("answer.txt", "r").read().strip()
u_out = open("user.txt",   "r").read().strip()

if a_out == u_out:
    exit(0xAC)  # AC
exit(0xAD)      # WA`,
                },
                {
                  key: 'float',
                  label: 'Float (±1e-6)',
                  code: `# Haqiqiy son — absolyut yoki nisbiy xato 1e-6 dan oshmasin
a_out = open("answer.txt", "r").read().strip()
u_out = open("user.txt",   "r").read().strip()

try:
    expected = float(a_out)
    got      = float(u_out)
except ValueError:
    exit(0xAD)  # WA — raqam emas

eps = 1e-6
if abs(expected - got) <= eps * max(1.0, abs(expected)):
    exit(0xAC)  # AC
exit(0xAD)      # WA`,
                },
                {
                  key: 'anyof',
                  label: 'AnyOf (program)',
                  code: `# comparator=any_of: expected_output da '\\n---\\n' bilan ajratilgan javoblar
# Misol expected_output: "YES\\n---\\nYes\\n---\\nDA"
# Built-in any_of comparatorida bu avtomatik ishlaydi.
# Quyida program comparator bilan xuddi shu mantiq:

a_out = open("answer.txt", "r", encoding="utf-8").read()
u_out = open("user.txt",   "r", encoding="utf-8").read().replace("\\r", "").rstrip()

for ans in a_out.split("\\n---\\n"):
    if ans.replace("\\r", "").rstrip() == u_out:
        exit(0xAC)  # AC
exit(0xAD)          # WA`,
                },
                {
                  key: 'interactive',
                  label: 'Interactive',
                  code: `# checker_type=interactive uchun checker kodi misoli
# proc.stdin — foydalanuvchi dasturining kirishi
# proc.stdout — foydalanuvchi dasturining chiqishi
# AC, WA, PE, TL, ML — verdikt konstantalari

import random

n = random.randint(1, 100)

# Foydalanuvchi dasturiga birinchi so'rov
proc.stdin.write(f"100\\n")
proc.stdin.flush()

for attempt in range(7):
    line = proc.stdout.readline().strip()
    guess = int(line)
    if guess == n:
        proc.stdin.write("correct\\n")
        proc.stdin.flush()
        exit(AC)
    elif guess < n:
        proc.stdin.write("too_small\\n")
    else:
        proc.stdin.write("too_big\\n")
    proc.stdin.flush()

exit(WA)  # 7 urinishda topmadi`,
                },
              ]}
            />

            <H3>
              Validator — kod tahlili (<span className="normal-case">validator</span> parametri)
            </H3>
            <P>
              Validator foydalanuvchi manba kodini (<C>solution.txt</C>) bajarishdan OLDIN tekshiradi. Shartlar bajarilmasa{' '}
              <C>verdict: "WA", validator_failed: true</C> qaytariladi.
            </P>
            <DocsTable
              headers={['Maydon', 'Tur', 'Tavsif']}
              rows={[
                [<C>ban_loops</C>, 'boolean', <><C>for</C>, <C>while</C>, <C>do</C>, <C>goto</C> kalit so'zlarini taqiqlash</>],
                [<C>ban_keywords</C>, 'string[]', "Qo'shimcha taqiqlangan kalit so'zlar ro'yxati (so'z chegarasi bilan tekshiriladi)"],
                [<C>max_chars</C>, 'number', 'Manba kodidagi maksimal belgilar soni'],
                [<C>max_lines</C>, 'number', 'Manba kodidagi maksimal qatorlar soni'],
                [<C>ban_operators</C>, 'string[]', <>Taqiqlangan operatorlar yoki satr parchalar (masalan: <C>{'["*", "/", "%"]'}</C>)</>],
                [<C>require_operators</C>, 'string[]', "Majburiy bo'lishi kerak bo'lgan operatorlar yoki satr parchalar"],
                [
                  <C>custom_code</C>,
                  'string',
                  <>
                    Maxsus Python kodi (<C>solution</C>, <C>wa</C>, <C>ac</C> o'zgaruvchilariga kirish mumkin)
                  </>,
                ],
              ]}
            />

            <CodeTabs
              tabs={[
                {
                  key: 'loops',
                  label: 'Sikl taqiqi',
                  code: `// So'rov tanasi — sikl kalit so'zlarini taqiqlash
{
  "language": "python", "version": "*",
  "files": [{ "content": "print(sum(range(101)))" }],
  "stdin": "", "expected_output": "5050",
  "validator": {
    "ban_loops": true
  }
}`,
                },
                {
                  key: 'ops',
                  label: 'Arifmetik cheklov',
                  code: `// Ko'paytirish va bo'lishni taqiqlash, qo'shishni majburlash
{
  "validator": {
    "ban_operators": ["*", "/", "%"],
    "require_operators": ["+"],
    "max_chars": 500,
    "max_lines": 20
  }
}`,
                },
                {
                  key: 'custom',
                  label: 'Custom tahlil',
                  code: `// Maxsus tahlil: "import" so'zi bo'lmasligi kerak (Python uchun)
{
  "validator": {
    "custom_code": "if 'import' in solution: exit(wa)"
  }
}

// custom_code ichida mavjud o'zgaruvchilar:
//   solution — manba kodi matni (string)
//   wa = 0xAD — WA chiqish kodi
//   ac = 0xAC — AC chiqish kodi`,
                },
              ]}
            />
          </Section>

          <Section id="pkg-list">
            <EndpointHeader method="GET" path="/api/v2/packages" auth="open" />
            <P>Barcha mavjud paketlar va ularning o'rnatilgan/o'rnatilmagan holati.</P>
            <CodeBlock
              code={`curl https://your-server:2000/api/v2/packages

# Javob:
[
  { "language": "python", "language_version": "3.12.0", "installed": true },
  { "language": "gcc",    "language_version": "15.2.0", "installed": false }
]`}
            />
          </Section>

          <Section id="pkg-install">
            <EndpointHeader method="POST" path="/api/v2/packages" auth="token" />
            <P>
              Ko'rsatilgan tilni o'rnatadi. <C>language</C> va <C>version</C> majburiy.
            </P>
            <CodeBlock
              code={`curl -X POST https://your-server:2000/api/v2/packages \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{ "language": "python", "version": "3.12.0" }'`}
            />
          </Section>

          <Section id="pkg-uninstall">
            <EndpointHeader method="DELETE" path="/api/v2/packages" auth="token" />
            <P>Ko'rsatilgan tilni o'chiradi.</P>
            <CodeBlock
              code={`curl -X DELETE https://your-server:2000/api/v2/packages \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{ "language": "python", "version": "3.12.0" }'`}
            />
          </Section>

          <Section id="jobs-list">
            <EndpointHeader method="GET" path="/api/v2/jobs" auth="token" />
            <P>Bajarilgan joblar tarixini ko'rsatadi.</P>
            <DocsTable
              headers={['Query param', 'Default', 'Tavsif']}
              rows={[
                [<C>limit</C>, '100', 'Qaytariladigan yozuvlar soni (max 500)'],
                [<C>offset</C>, '0', "Sahifalash uchun boshlang'ich pozitsiya"],
                [<C>language</C>, '—', "Tilga ko'ra filtrlash"],
              ]}
            />
            <CodeBlock
              code={`curl "https://your-server:2000/api/v2/jobs?limit=10&language=python" \\
  -H "Authorization: Bearer YOUR_TOKEN"`}
            />
          </Section>

          <Section id="jobs-detail">
            <EndpointHeader method="GET" path="/api/v2/jobs/:id" auth="token" />
            <P>Bitta jobning to'liq ma'lumotlari (stdin, stdout, stderr, vaqt, xotira).</P>
            <CodeBlock
              code={`curl "https://your-server:2000/api/v2/jobs/JOB_UUID" \\
  -H "Authorization: Bearer YOUR_TOKEN"`}
            />
          </Section>

          <Section id="jobs-delete">
            <EndpointHeader method="DELETE" path="/api/v2/jobs/:id" auth="token" />
            <P>Bitta jobni ID bo'yicha o'chiradi.</P>
            <CodeBlock
              code={`curl -X DELETE "https://your-server:2000/api/v2/jobs/JOB_UUID" \\
  -H "Authorization: Bearer YOUR_TOKEN"

# Javob:
{ "message": "Job o'chirildi" }`}
            />
          </Section>

          <Section id="jobs-delete-bulk">
            <EndpointHeader method="DELETE" path="/api/v2/jobs" auth="token" />
            <P>
              Bir nechta jobni bir so'rovda o'chiradi. So'rov tanasida <C>ids</C> massivi (UUID ro'yxat) talab qilinadi.
            </P>
            <CodeBlock
              code={`curl -X DELETE "https://your-server:2000/api/v2/jobs" \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{ "ids": ["uuid-1", "uuid-2", "uuid-3"] }'

# Javob:
{ "message": "3 ta job o'chirildi", "deleted": 3 }`}
            />
          </Section>

          <Section id="auth-login">
            <EndpointHeader method="POST" path="/auth/login" auth="open" />
            <P>Username va parol orqali tizimga kiradi va token qaytaradi.</P>
            <CodeBlock
              code={`curl -X POST https://your-server:2000/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{ "username": "admin", "password": "admin123" }'

# Javob:
{
  "token": "a1b2c3d4e5f6...",
  "username": "admin",
  "role": "admin",
  "expires_at": "2026-05-23T10:00:00.000Z"
}`}
            />
          </Section>

          <Section id="auth-logout">
            <EndpointHeader method="POST" path="/auth/logout" auth="token" />
            <P>Joriy tokenni bekor qiladi (o'chiradi).</P>
            <CodeBlock code={`curl -X POST https://your-server:2000/auth/logout \\
  -H "Authorization: Bearer YOUR_TOKEN"`} />
          </Section>

          <Section id="auth-me">
            <EndpointHeader method="GET" path="/auth/me" auth="token" />
            <P>Token haqiqiy ekanini tekshiradi va foydalanuvchi ma'lumotlarini qaytaradi.</P>
            <CodeBlock
              code={`curl https://your-server:2000/auth/me \\
  -H "Authorization: Bearer YOUR_TOKEN"

# Javob:
{ "username": "admin", "role": "admin", "expires_at": "2026-05-23T10:00:00.000Z" }`}
            />
          </Section>

          <Section id="tokens-create">
            <EndpointHeader method="POST" path="/auth/tokens" auth="token" />
            <P>
              Faqat <b>admin</b> ishlata oladi — ko'rsatilgan foydalanuvchi uchun yangi API token yaratadi va shu userga API'dan
              foydalanish ruxsatini beradi.
            </P>
            <CodeBlock
              code={`curl -X POST https://your-server:2000/auth/tokens \\
  -H "Authorization: Bearer ADMIN_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{ "username": "someuser", "label": "Mening ilovam", "expires_days": 90 }'

# Javob:
{
  "token": "newtoken...",
  "username": "someuser",
  "label": "Mening ilovam",
  "expires_at": "2026-07-21T10:00:00.000Z",
  "expires_days": 90
}`}
            />
          </Section>

          <Section id="tokens-list">
            <EndpointHeader method="GET" path="/auth/tokens" auth="token" />
            <P>
              Admin — barcha (yoki <C>?username=</C> bilan filtrlangan) faol tokenlarni ko'radi. Oddiy user — faqat o'ziga tegishli
              tokenlarni ko'radi.
            </P>
            <CodeBlock code={`curl https://your-server:2000/auth/tokens \\
  -H "Authorization: Bearer YOUR_TOKEN"`} />
          </Section>

          <Section id="tokens-delete">
            <EndpointHeader method="DELETE" path="/auth/tokens/:token" auth="token" />
            <P>Berilgan tokenni o'chiradi (bekor qiladi). Admin istalgan tokenni, oddiy user faqat o'zinikini o'chira oladi.</P>
            <CodeBlock
              code={`curl -X DELETE https://your-server:2000/auth/tokens/TOKEN_VALUE \\
  -H "Authorization: Bearer YOUR_TOKEN"`}
            />
          </Section>

          <Section id="users-list">
            <EndpointHeader method="GET" path="/auth/users" auth="token" />
            <P>Barcha foydalanuvchilar ro'yxatini qaytaradi.</P>
            <CodeBlock code={`curl https://your-server:2000/auth/users \\
  -H "Authorization: Bearer YOUR_TOKEN"`} />
          </Section>

          <Section id="users-create">
            <EndpointHeader method="POST" path="/auth/users" auth="token" />
            <P>Yangi foydalanuvchi qo'shadi.</P>
            <CodeBlock
              code={`curl -X POST https://your-server:2000/auth/users \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{ "username": "yangi_user", "password": "maxfiyparol" }'`}
            />
          </Section>

          <Section id="users-update">
            <EndpointHeader method="PUT" path="/auth/users/:username" auth="token" />
            <P>
              Boshqa foydalanuvchining parolini o'zgartiradi (admin funksiyasi). O'zingizning parolni o'zgartirish uchun{' '}
              <C>PUT /auth/profile</C> ishlatganingiz ma'qul.
            </P>
            <CodeBlock
              code={`curl -X PUT https://your-server:2000/auth/users/yangi_user \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{ "password": "yangiparol123" }'`}
            />
          </Section>

          <Section id="users-delete">
            <EndpointHeader method="DELETE" path="/auth/users/:username" auth="token" />
            <P>Foydalanuvchini va uning barcha tokenlarini o'chiradi. O'zingizni o'chira olmaysiz.</P>
            <CodeBlock
              code={`curl -X DELETE https://your-server:2000/auth/users/yangi_user \\
  -H "Authorization: Bearer YOUR_TOKEN"`}
            />
          </Section>

          <Section id="profile">
            <EndpointHeader method="PUT" path="/auth/profile" auth="token" />
            <P>O'zingizning parolini o'zgartiradi. Joriy parolni tasdiqlash talab etiladi.</P>
            <CodeBlock
              code={`curl -X PUT https://your-server:2000/auth/profile \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "current_password": "joriy_parol",
    "new_password": "yangi_parol123"
  }'

# Muvaffaqiyatli javob:
{ "message": "Parol muvaffaqiyatli o'zgartirildi" }`}
            />
          </Section>

          <Section id="errors" title="HTTP Xato Kodlar">
            <DocsTable
              headers={['Kod', "Ma'nosi", 'Sabab']}
              rows={[
                [<span className="font-mono font-bold text-green-600 dark:text-green-400">200</span>, 'OK', "So'rov muvaffaqiyatli bajarildi"],
                [
                  <span className="font-mono font-bold text-amber-600 dark:text-amber-400">400</span>,
                  'Bad Request',
                  "Noto'g'ri so'rov (majburiy maydon yetishmaydi yoki noto'g'ri tur)",
                ],
                [
                  <span className="font-mono font-bold text-red-600 dark:text-red-400">401</span>,
                  'Unauthorized',
                  "Token yo'q, noto'g'ri, yoki muddati tugagan",
                ],
                [
                  <span className="font-mono font-bold text-red-600 dark:text-red-400">402</span>,
                  'Payment Required',
                  "Faol tarif yo'q (tarif tizimi yoqilgan bo'lsa)",
                ],
                [
                  <span className="font-mono font-bold text-red-600 dark:text-red-400">404</span>,
                  'Not Found',
                  "So'ralgan resurs topilmadi (paket, job, foydalanuvchi)",
                ],
                [<span className="font-mono font-bold text-amber-600 dark:text-amber-400">409</span>, 'Conflict', 'Username allaqachon mavjud'],
                [
                  <span className="font-mono font-bold text-orange-600 dark:text-orange-400">413</span>,
                  'Payload Too Large',
                  "Yuborilgan ma'lumot hajmi juda katta",
                ],
                [
                  <span className="font-mono font-bold text-orange-600 dark:text-orange-400">415</span>,
                  'Unsupported Media Type',
                  'Content-Type application/json bo\'lishi shart',
                ],
                [
                  <span className="font-mono font-bold text-orange-600 dark:text-orange-400">429</span>,
                  'Too Many Requests',
                  "Oylik so'rovlar limiti yoki bir vaqtdagi so'rovlar chegarasi oshdi (tarif tizimi yoqilgan bo'lsa)",
                ],
                [
                  <span className="font-mono font-bold text-red-700 dark:text-red-400">500</span>,
                  'Internal Server Error',
                  'Server ichki xatosi (log tekshiring)',
                ],
              ]}
            />

            <h3 className="mb-3 mt-6 text-sm font-semibold">WebSocket yopilish kodlari</h3>
            <DocsTable
              headers={['Kod', "Ma'nosi"]}
              rows={[
                ['4000', 'Ikkinchi marta "init" yuborildi'],
                ['4001', '1 sekund ichida "init" yuborilmadi (timeout)'],
                ['4002', "So'rov qayta ishlashda xato"],
                ['4003', 'Hali "init" yuborilmagan'],
                ['4004', "Faqat stdin'ga yozish mumkin"],
                ['4005', "Noto'g'ri signal"],
                ['4999', 'Job muvaffaqiyatli yakunlandi'],
              ]}
            />
          </Section>
        </main>
      </div>
    </AppShell>
  );
}

function MsgExample({ title, children }: { title: string; children: string }) {
  return (
    <div className="rounded-xl border bg-muted/40 p-4">
      <p className="mb-2 font-mono text-xs font-bold">{title}</p>
      <pre className="whitespace-pre-wrap break-all font-mono text-xs text-muted-foreground">{children}</pre>
    </div>
  );
}
