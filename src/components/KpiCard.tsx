interface KpiCardProps {
  label: string;
  value: string;
  subtext: string;
  highlight?: 'yellow' | 'orange' | 'neutral';
}

export function KpiCard({
  label,
  value,
  subtext,
  highlight = 'neutral',
}: KpiCardProps) {
  const accentBar =
    highlight === 'yellow'
      ? 'bg-[#FFC800]'
      : highlight === 'orange'
        ? 'bg-[#F58220]'
        : 'bg-zinc-900 dark:bg-zinc-100';

  return (
    <div className="bg-white dark:bg-[#141416] border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 sm:p-5 flex flex-col justify-between gap-2 transition-colors">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400 truncate">
          {label}
        </span>
        <span className={`w-4 h-1 rounded-full shrink-0 ${accentBar}`} aria-hidden="true" />
      </div>
      <div className="text-2xl sm:text-[28px] font-bold tracking-tight text-zinc-950 dark:text-white font-mono-num leading-none">
        {value}
      </div>
      <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate tabular-nums">
        {subtext}
      </div>
    </div>
  );
}
