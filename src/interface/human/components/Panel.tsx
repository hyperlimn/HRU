import { useState, type ReactNode } from 'react';

export function Panel({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  const [open, setOpen] = useState(title === 'Universe' || title === 'Time');
  return <section className="panel">
    <button className="panel-title" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
      <span>{title}</span><span>{open ? '−' : '+'}</span>
    </button>
    {open && <div className="panel-content">{children}</div>}
  </section>;
}
