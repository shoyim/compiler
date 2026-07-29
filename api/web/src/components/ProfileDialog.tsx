import { useState } from 'react';
import { toast } from 'sonner';
import { Lock } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { apiSend, ApiError } from '@/lib/api';

export function ProfileDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [cur, setCur] = useState('');
  const [n1, setN1] = useState('');
  const [n2, setN2] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!cur || !n1) return toast.error("Barcha maydonlarni to'ldiring");
    if (n1 !== n2) return toast.error('Yangi parollar mos kelmadi');
    setBusy(true);
    try {
      const data = await apiSend('/auth/profile', 'PUT', { current_password: cur, new_password: n1 });
      toast.success(data.message);
      setCur('');
      setN1('');
      setN2('');
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Server bilan bog'lanib bo'lmadi");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <Lock className="h-4 w-4 text-muted-foreground" />
            Parolni o'zgartirish
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Joriy parol</label>
            <Input type="password" value={cur} onChange={e => setCur(e.target.value)} placeholder="••••••••" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Yangi parol</label>
            <Input type="password" value={n1} onChange={e => setN1(e.target.value)} placeholder="••••••••" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Tasdiqlang</label>
            <Input type="password" value={n2} onChange={e => setN2(e.target.value)} placeholder="••••••••" />
          </div>
          <Button className="w-full" disabled={busy} onClick={submit}>
            Saqlash
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
