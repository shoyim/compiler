import { useState, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { Header } from '@/components/Header';
import { ProfileDialog } from '@/components/ProfileDialog';

export function AppShell({
  ready,
  role,
  actions,
  children,
}: {
  ready: boolean;
  role: string | null;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const [profileOpen, setProfileOpen] = useState(false);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header role={role} actions={actions} onOpenProfile={() => setProfileOpen(true)} />
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
    </div>
  );
}
