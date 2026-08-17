import { useEffect, useRef, useState } from "react";
import {
  formatActivityCli,
  serializeActivityJson,
} from "../../../activity/activity-events";
import { useActivity } from "../../../activity/activity-context";

export function ActivityLogPanel() {
  const { events, retention, clear, setRetention } = useActivity();
  const [pauseScroll, setPauseScroll] = useState(false);
  const [status, setStatus] = useState("");
  const log = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (!pauseScroll && log.current)
      log.current.scrollTop = log.current.scrollHeight;
  }, [events, pauseScroll]);
  useEffect(() => {
    const element = log.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting && !pauseScroll)
        element.scrollTop = element.scrollHeight;
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [pauseScroll]);

  const copy = async (json = false) => {
    try {
      await navigator.clipboard.writeText(
        json ? serializeActivityJson(events) : formatActivityCli(events),
      );
      setStatus(json ? "JSON copied" : "Log copied");
    } catch (error) {
      setStatus(
        `Copy failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  return (
    <div className="activity-panel">
      <div className="activity-actions">
        <button onClick={() => void copy()}>Copy</button>
        <button onClick={() => void copy(true)}>Copy JSON</button>
        <button onClick={clear}>Clear</button>
        <button
          aria-pressed={pauseScroll}
          className={pauseScroll ? "active" : ""}
          onClick={() => setPauseScroll((value) => !value)}
        >
          {pauseScroll ? "Resume Scroll" : "Pause Scroll"}
        </button>
      </div>
      <pre
        className="activity-terminal"
        ref={log}
        tabIndex={0}
        aria-label="Retained HRU activity events"
      >
        {events.length ? (
          events.map((event) => (
            <span
              className={`activity-line ${event.level}`}
              key={event.sequence}
            >
              {formatActivityCli([event])}
              {"\n"}
            </span>
          ))
        ) : (
          <span className="activity-empty">No retained activity.</span>
        )}
      </pre>
      <div className="activity-settings">
        <label>
          Retain{" "}
          <input
            type="number"
            min={1}
            max={10_000}
            step={100}
            value={retention}
            onChange={(event) => {
              const value = Number(event.target.value);
              if (Number.isInteger(value) && value >= 1 && value <= 10_000)
                setRetention(value);
            }}
          />{" "}
          events
        </label>
        <span>{events.length} retained</span>
      </div>
      {status && <output className="activity-copy-status">{status}</output>}
    </div>
  );
}
