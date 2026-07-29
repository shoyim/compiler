export function StatsBar({ total, installed }: { total: number; installed: number }) {
  const stats = [
    { label: 'Jami:', value: total, dot: 'bg-primary', text: '' },
    { label: "O'rnatilgan:", value: installed, dot: 'bg-success', text: 'text-success' },
    { label: 'Mavjud:', value: total - installed, dot: 'bg-muted-foreground/40', text: '' },
  ];
  return (
    <div className="border-b bg-card">
      <div className="mx-auto flex max-w-7xl flex-wrap gap-6 px-4 py-3 sm:px-6">
        {stats.map(s => (
          <div key={s.label} className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${s.dot}`} />
            <span className="text-xs text-muted-foreground">{s.label}</span>
            <span className={`text-xs font-bold ${s.text}`}>{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
