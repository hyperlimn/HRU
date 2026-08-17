import { useEffect, useId, useState, type ReactNode } from "react";

export const SIDEBAR_OPEN_PANEL_EVENT = "hru:open-sidebar-panel";

export function Panel({
  id,
  title,
  children,
  defaultOpen = false,
}: {
  readonly id?: string;
  readonly title: string;
  readonly children: ReactNode;
  readonly defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();
  useEffect(() => {
    if (!id) return;
    const reveal = (event: Event) => {
      if ((event as CustomEvent<{ panelId: string }>).detail.panelId === id)
        setOpen(true);
    };
    window.addEventListener(SIDEBAR_OPEN_PANEL_EVENT, reveal);
    return () => window.removeEventListener(SIDEBAR_OPEN_PANEL_EVENT, reveal);
  }, [id]);
  return (
    <section className="panel">
      <button
        className="panel-title"
        onClick={() => setOpen((value) => !value)}
        aria-controls={contentId}
        aria-expanded={open}
      >
        <span>
          <span className="panel-icon" aria-hidden="true">
            {open ? "▾" : "▸"}
          </span>
          {title}
        </span>
      </button>
      <div className="panel-content" id={contentId} hidden={!open}>
        {children}
      </div>
    </section>
  );
}
