import { useId, useState, type ReactNode } from 'react';

export function Disclosure({ title, count, children, defaultOpen = false, forceOpen = false, level = 'nested', closeLabel = 'Close' }: {
  readonly title: string;
  readonly count?: number;
  readonly children: ReactNode;
  readonly defaultOpen?: boolean;
  readonly forceOpen?: boolean;
  readonly level?: 'category' | 'nested';
  readonly closeLabel?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();
  const expanded = forceOpen || open;
  return <section className={`disclosure disclosure-${level}`}>
    <button className="disclosure-title" aria-controls={contentId} aria-expanded={expanded} onClick={() => setOpen(!expanded)}>
      <span><span className="disclosure-icon" aria-hidden="true">{expanded ? '▾' : '▸'}</span>{title}</span>
      {count !== undefined && <small>{count}</small>}
    </button>
    {expanded && <div className="disclosure-content" id={contentId}>
      {children}
      {!forceOpen && <button className="disclosure-close" onClick={() => setOpen(false)}>{closeLabel}</button>}
    </div>}
  </section>;
}
