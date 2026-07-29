import { useEffect, useState } from 'react';
import { Code2, User, Lock, Eye, EyeOff, LogIn, UserPlus, CircleAlert, CircleCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getToken, fetchMe } from '@/lib/api';
import { useDocumentTitle } from '@/lib/useDocumentTitle';

type Tab = 'login' | 'register';

export default function Login() {
  useDocumentTitle('Kirish — Compiler');
  const [tab, setTab] = useState<Tab>('login');
  const [alert, setAlert] = useState<{ msg: string; type: 'error' | 'success' } | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');

  const [regUser, setRegUser] = useState('');
  const [regPass, setRegPass] = useState('');
  const [regConfirm, setRegConfirm] = useState('');

  useEffect(() => {
    if (getToken()) {
      fetchMe()
        .then(() => (window.location.href = '/dashboard'))
        .catch(() => {});
    }
  }, []);

  function switchTab(t: Tab) {
    setTab(t);
    setAlert(null);
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setAlert(null);
    setBusy(true);
    try {
      const res = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUser, password: loginPass }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      localStorage.setItem('auth_token', data.token);
      localStorage.setItem('auth_user', data.username);
      localStorage.setItem('auth_role', data.role || 'user');
      window.location.href = '/dashboard';
    } catch (e) {
      setAlert({ msg: e instanceof Error ? e.message : 'Xatolik', type: 'error' });
      setBusy(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setAlert(null);
    if (regPass !== regConfirm) {
      setAlert({ msg: 'Parollar mos kelmadi', type: 'error' });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: regUser, password: regPass }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setAlert({ msg: data.message + ". Endi tizimga kiring.", type: 'success' });
      setRegUser('');
      setRegPass('');
      setRegConfirm('');
      setTimeout(() => switchTab('login'), 1500);
    } catch (e) {
      setAlert({ msg: e instanceof Error ? e.message : 'Xatolik', type: 'error' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-500 shadow-lg shadow-sky-500/30">
            <Code2 className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Compiler Dashboard</h1>
          <p className="mt-1 text-sm text-slate-400">{tab === 'login' ? "Kirish uchun ma'lumot kiriting" : 'Yangi hisob yarating'}</p>
        </div>

        <div className="rounded-2xl border border-slate-700 bg-slate-800 p-6 shadow-2xl">
          <div className="mb-5 flex rounded-lg bg-slate-700/50 p-1">
            <button
              onClick={() => switchTab('login')}
              className={
                'flex-1 rounded-md py-1.5 text-sm font-medium transition-all ' +
                (tab === 'login' ? 'bg-sky-500 text-white shadow' : 'text-slate-400 hover:text-white')
              }
            >
              <LogIn className="mr-1.5 inline h-3.5 w-3.5" />
              Kirish
            </button>
            <button
              onClick={() => switchTab('register')}
              className={
                'flex-1 rounded-md py-1.5 text-sm font-medium transition-all ' +
                (tab === 'register' ? 'bg-sky-500 text-white shadow' : 'text-slate-400 hover:text-white')
              }
            >
              <UserPlus className="mr-1.5 inline h-3.5 w-3.5" />
              Ro'yxatdan o'tish
            </button>
          </div>

          {alert && (
            <div
              className={
                'mb-4 flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm ' +
                (alert.type === 'error'
                  ? 'border-red-500/20 bg-red-500/10 text-red-400'
                  : 'border-green-500/20 bg-green-500/10 text-green-400')
              }
            >
              {alert.type === 'error' ? <CircleAlert className="h-4 w-4 shrink-0" /> : <CircleCheck className="h-4 w-4 shrink-0" />}
              <span>{alert.msg}</span>
            </div>
          )}

          {tab === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="mb-1.5 flex items-center text-sm font-medium text-slate-300">
                  <User className="mr-1.5 h-3.5 w-3.5 text-slate-400" />
                  Foydalanuvchi nomi
                </label>
                <Input
                  className="border-slate-600 bg-slate-700 text-white placeholder-slate-500"
                  value={loginUser}
                  onChange={e => setLoginUser(e.target.value)}
                  placeholder="admin"
                  autoComplete="username"
                  required
                />
              </div>
              <div>
                <label className="mb-1.5 flex items-center text-sm font-medium text-slate-300">
                  <Lock className="mr-1.5 h-3.5 w-3.5 text-slate-400" />
                  Parol
                </label>
                <div className="relative">
                  <Input
                    className="border-slate-600 bg-slate-700 pr-10 text-white placeholder-slate-500"
                    type={showPass ? 'text' : 'password'}
                    value={loginPass}
                    onChange={e => setLoginPass(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  >
                    {showPass ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
              <Button type="submit" disabled={busy} className="w-full gap-2 bg-sky-500 hover:bg-sky-400">
                <LogIn className="h-4 w-4" />
                {busy ? 'Kirilmoqda...' : 'Kirish'}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="mb-1.5 flex items-center text-sm font-medium text-slate-300">
                  <User className="mr-1.5 h-3.5 w-3.5 text-slate-400" />
                  Foydalanuvchi nomi
                </label>
                <Input
                  className="border-slate-600 bg-slate-700 text-white placeholder-slate-500"
                  value={regUser}
                  onChange={e => setRegUser(e.target.value)}
                  placeholder="username"
                  autoComplete="username"
                  required
                />
              </div>
              <div>
                <label className="mb-1.5 flex items-center text-sm font-medium text-slate-300">
                  <Lock className="mr-1.5 h-3.5 w-3.5 text-slate-400" />
                  Parol
                </label>
                <Input
                  className="border-slate-600 bg-slate-700 text-white placeholder-slate-500"
                  type="password"
                  value={regPass}
                  onChange={e => setRegPass(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  required
                />
              </div>
              <div>
                <label className="mb-1.5 flex items-center text-sm font-medium text-slate-300">
                  <Lock className="mr-1.5 h-3.5 w-3.5 text-slate-400" />
                  Parolni tasdiqlang
                </label>
                <Input
                  className="border-slate-600 bg-slate-700 text-white placeholder-slate-500"
                  type="password"
                  value={regConfirm}
                  onChange={e => setRegConfirm(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  required
                />
              </div>
              <Button type="submit" disabled={busy} className="w-full gap-2 bg-sky-500 hover:bg-sky-400">
                <UserPlus className="h-4 w-4" />
                {busy ? "Ro'yxatdan o'tilmoqda..." : "Ro'yxatdan o'tish"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
