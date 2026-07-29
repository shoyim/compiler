import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Users as UsersIcon, UserCircle, Pencil, Trash2, Plus } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiGet, apiSend, ApiError, type UserInfo } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';
import { useDocumentTitle } from '@/lib/useDocumentTitle';

export default function Users() {
  useDocumentTitle('Foydalanuvchilar — Compiler');
  const { ready, role } = useAuth(true);
  const [users, setUsers] = useState<UserInfo[] | null>(null);
  const [newUser, setNewUser] = useState('');
  const [newPass, setNewPass] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editPass, setEditPass] = useState('');
  const me = localStorage.getItem('auth_user');

  async function load() {
    try {
      setUsers(await apiGet('/auth/users'));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Server bilan bog'lanib bo'lmadi");
    }
  }

  useEffect(() => {
    if (ready) load();
  }, [ready]);

  async function addUser() {
    if (!newUser.trim() || !newPass) return toast.error('Username va parol kerak');
    try {
      const d = await apiSend('/auth/users', 'POST', { username: newUser.trim(), password: newPass });
      toast.success(d.message);
      setNewUser('');
      setNewPass('');
      load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Xatolik');
    }
  }

  async function changePassword(u: string) {
    if (!editPass) return toast.error('Yangi parol kiriting');
    try {
      const d = await apiSend(`/auth/users/${u}`, 'PUT', { password: editPass });
      toast.success(d.message);
      setEditing(null);
      setEditPass('');
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Xatolik');
    }
  }

  async function deleteUser(u: string) {
    try {
      const d = await apiSend(`/auth/users/${u}`, 'DELETE');
      toast.info(d.message);
      load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Xatolik');
    }
  }

  return (
    <AppShell ready={ready} role={role}>
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <h1 className="text-xl font-bold">Foydalanuvchilar</h1>
          <p className="mt-1 text-sm text-muted-foreground">Tizim foydalanuvchilarini boshqarish</p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-muted-foreground" />
              Yangi foydalanuvchi
            </CardTitle>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Input placeholder="Username" value={newUser} onChange={e => setNewUser(e.target.value)} />
            <Input
              type="password"
              placeholder="Parol"
              value={newPass}
              onChange={e => setNewPass(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addUser()}
            />
            <Button size="icon" onClick={addUser} className="shrink-0">
              <Plus className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UsersIcon className="h-4 w-4 text-muted-foreground" />
              Barcha foydalanuvchilar
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {users === null && <p className="py-4 text-center text-sm text-muted-foreground">Yuklanmoqda...</p>}
            {users?.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">Foydalanuvchilar yo'q</p>}
            {users?.map(u => (
              <div key={u.username}>
                <div className="flex items-center gap-2 rounded-xl border bg-muted/30 px-3 py-2.5">
                  <UserCircle className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 text-sm font-semibold">{u.username}</span>
                  <Badge variant={u.role === 'admin' ? 'default' : 'secondary'}>{u.role}</Badge>
                  {u.username === me && <Badge variant="success">Siz</Badge>}
                  <span className="text-[10px] text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-amber-500 hover:bg-amber-500/10 hover:text-amber-500"
                    onClick={() => {
                      setEditing(editing === u.username ? null : u.username);
                      setEditPass('');
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  {u.username !== me ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => deleteUser(u.username)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  ) : (
                    <div className="w-7" />
                  )}
                </div>
                {editing === u.username && (
                  <div className="mt-1 flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
                    <Input
                      type="password"
                      placeholder="Yangi parol"
                      className="h-8"
                      value={editPass}
                      onChange={e => setEditPass(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && changePassword(u.username)}
                    />
                    <Button size="sm" className="bg-amber-500 hover:bg-amber-400" onClick={() => changePassword(u.username)}>
                      Saqlash
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                      Bekor
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
