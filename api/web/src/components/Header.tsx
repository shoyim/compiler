import { useEffect, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Code2,
  Gauge,
  Play,
  ListChecks,
  KeyRound,
  BookOpen,
  Users,
  Moon,
  Sun,
  ChevronDown,
  Lock,
  LogOut,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { authHeaders } from '@/lib/api';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: Gauge, adminOnly: true },
  { href: '/tester', label: 'Tester', icon: Play, adminOnly: false },
  { href: '/jobs', label: 'Joblar', icon: ListChecks, adminOnly: true },
  { href: '/tokens', label: 'Tokenlar', icon: KeyRound, adminOnly: true },
  { href: '/users', label: 'Foydalanuvchilar', icon: Users, adminOnly: true },
  { href: '/api-docs', label: 'API', icon: BookOpen, adminOnly: true },
];

export function Header({
  role,
  actions,
  onOpenProfile,
}: {
  role: string | null;
  actions?: ReactNode;
  onOpenProfile: () => void;
}) {
  const location = useLocation();
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  const username = localStorage.getItem('auth_user') || '?';

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  async function logout() {
    await fetch('/auth/logout', { method: 'POST', headers: authHeaders() }).catch(() => {});
    localStorage.clear();
    window.location.href = '/login';
  }

  const items = NAV.filter(n => !n.adminOnly || role === 'admin');

  return (
    <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur shadow-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-4">
          <a href="/dashboard" className="flex shrink-0 items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Code2 className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="hidden text-sm font-bold sm:block">Compiler</span>
          </a>
          <nav className="flex items-center gap-0.5 overflow-x-auto">
            {items.map(n => {
              const active = location.pathname === n.href;
              return (
                <a
                  key={n.href}
                  href={n.href}
                  className={
                    'flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ' +
                    (active
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground')
                  }
                >
                  <n.icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{n.label}</span>
                </a>
              );
            })}
          </nav>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {actions}
          <Button variant="ghost" size="icon" onClick={() => setDark(d => !d)} title="Mavzu">
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="gap-2 border-primary/20 bg-accent px-2.5 text-accent-foreground hover:bg-accent/80"
              >
                <span className="text-xs font-semibold">{username}</span>
                <ChevronDown className="h-3 w-3 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onOpenProfile}>
                <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                Parolni o'zgartirish
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive onClick={logout}>
                <LogOut className="h-3.5 w-3.5" />
                Chiqish
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
