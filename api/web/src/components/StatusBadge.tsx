import { Check, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export function StatusBadge({ exit, status }: { exit: number | null; status: string | null }) {
  if (status === 'timed_out')
    return (
      <Badge className="border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400" variant="outline">
        TLE
      </Badge>
    );
  if (status === 'memory_limit')
    return (
      <Badge className="border-orange-500/20 bg-orange-500/10 text-orange-600 dark:text-orange-400" variant="outline">
        MLE
      </Badge>
    );
  if (exit === 0 || status === 'ok')
    return (
      <Badge variant="success">
        <Check className="h-2.5 w-2.5" />
        OK
      </Badge>
    );
  if (exit !== null && exit !== undefined)
    return (
      <Badge variant="destructive">
        <X className="h-2.5 w-2.5" />
        {exit}
      </Badge>
    );
  return <span className="text-[10px] text-muted-foreground/50">—</span>;
}
