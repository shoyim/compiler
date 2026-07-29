import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { KeyRound, Copy, Trash2, Plus, CircleCheck } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { apiGet, apiSend, ApiError, type UserInfo } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';
import { useDocumentTitle } from '@/lib/useDocumentTitle';

interface TokenInfo {
  id: string;
  preview: string;
  username: string;
  label: string | null;
  created_at: string;
  expires_at: string;
  is_current: boolean;
}

const EXPIRY_OPTIONS = [7, 30, 90, 180, 365];

export default function Tokens() {
  useDocumentTitle('API Tokenlar — Compiler');
  const { ready, role } = useAuth(true);
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [tokens, setTokens] = useState<TokenInfo[] | null>(null);
  const [targetUser, setTargetUser] = useState('');
  const [label, setLabel] = useState('');
  const [expiryDays, setExpiryDays] = useState(30);
  const [newToken, setNewToken] = useState<string | null>(null);

  async function loadUsers() {
    try {
      const u: UserInfo[] = await apiGet('/auth/users');
      setUsers(u);
      if (!targetUser && u.length) setTargetUser(u[0].username);
    } catch {
      /* ignore */
    }
  }

  async function loadTokens() {
    try {
      setTokens(await apiGet('/auth/tokens'));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Server bilan bog'lanib bo'lmadi");
    }
  }

  useEffect(() => {
    if (ready) {
      loadUsers();
      loadTokens();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  async function createToken() {
    if (!targetUser) return toast.error('Foydalanuvchini tanlang');
    try {
      const data = await apiSend('/auth/tokens', 'POST', {
        username: targetUser,
        label: label || undefined,
        expires_days: expiryDays,
      });
      setNewToken(data.token);
      setLabel('');
      loadTokens();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Xatolik');
    }
  }

  async function deleteToken(id: string) {
    if (!confirm("Tokenni o'chirishni tasdiqlaysizmi?")) return;
    try {
      const d = await apiSend(`/auth/tokens/${id}`, 'DELETE');
      toast.info(d.message);
      loadTokens();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Xatolik');
    }
  }

  function copy(t: string) {
    navigator.clipboard.writeText(t).then(() => toast.success('Token nusxalandi'));
  }

  return (
    <AppShell ready={ready} role={role}>
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <h1 className="text-xl font-bold">API Tokenlar</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Foydalanuvchilarga API'dan foydalanish uchun token yarating va boshqaring
          </p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-muted-foreground" />
              Yangi token yaratish
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Foydalanuvchi</label>
                <select
                  value={targetUser}
                  onChange={e => setTargetUser(e.target.value)}
                  className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {users.map(u => (
                    <option key={u.username} value={u.username}>
                      {u.username}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Token nomi (ixtiyoriy)</label>
                <Input placeholder="Masalan: Ilova, Test..." value={label} onChange={e => setLabel(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Amal qilish muddati</label>
                <select
                  value={expiryDays}
                  onChange={e => setExpiryDays(Number(e.target.value))}
                  className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {EXPIRY_OPTIONS.map(d => (
                    <option key={d} value={d}>
                      {d} kun
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <Button className="gap-2" onClick={createToken}>
              <Plus className="h-4 w-4" />
              Token yaratish
            </Button>
          </CardContent>
        </Card>

        {newToken && (
          <Card className="mb-6 border-success/30 bg-success/5">
            <CardContent className="flex items-start gap-3 pt-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-success/15">
                <CircleCheck className="h-4 w-4 text-success" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="mb-1 text-sm font-semibold text-success">Token muvaffaqiyatli yaratildi!</p>
                <p className="mb-3 text-xs text-muted-foreground">Bu token faqat bir marta ko'rsatiladi. Hoziroq nusxalab oling.</p>
                <div className="flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded-lg border bg-background px-3 py-2 font-mono text-xs">{newToken}</code>
                  <Button size="sm" className="shrink-0 gap-1.5 bg-success text-success-foreground hover:bg-success/90" onClick={() => copy(newToken)}>
                    <Copy className="h-3.5 w-3.5" />
                    Nusxa
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-muted-foreground" />
              Faol tokenlar
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {tokens === null && <p className="py-4 text-center text-sm text-muted-foreground">Yuklanmoqda...</p>}
            {tokens?.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">Hech qanday faol token yo'q</p>}
            {tokens?.map(t => {
              const daysLeft = Math.max(0, Math.ceil((new Date(t.expires_at).getTime() - Date.now()) / 86400000));
              return (
                <div
                  key={t.id}
                  className={'flex items-center gap-3 rounded-xl border px-3 py-2.5' + (t.is_current ? ' bg-accent/40' : ' bg-muted/30')}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <KeyRound className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{t.label || <span className="italic text-muted-foreground">Nomsiz</span>}</span>
                      {t.is_current && <Badge>Joriy sessiya</Badge>}
                      <Badge variant={daysLeft <= 3 ? 'destructive' : 'success'}>{daysLeft} kun qoldi</Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
                      <span className="font-mono">{t.preview}</span>
                      <span>{t.username}</span>
                      <span>{new Date(t.created_at).toLocaleDateString()}</span>
                      <span>{new Date(t.expires_at).toLocaleDateString()} gacha</span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => deleteToken(t.id)}
                    title="O'chirish"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
