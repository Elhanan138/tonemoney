import type { ReactNode } from "react";

/** Dotted-leader line: label ........ value */
export function Item({ k, v, className }: { k: ReactNode; v: ReactNode; className?: string }) {
  return (
    <div className={`item ${className ?? ""}`}>
      <span className="k">{k}</span>
      <span className="lead" aria-hidden />
      <span className="v">{v}</span>
    </div>
  );
}

export function Cut() {
  return <div className="cut" role="separator" />;
}

export function Paper({ children, tilt, className, label }: { children: ReactNode; tilt?: boolean; className?: string; label?: string }) {
  return (
    <div aria-label={label}>
      <div className={`paper ${tilt ? "tilt" : ""} ${className ?? ""}`}>{children}</div>
      <div className={`zig ${tilt ? "tilt" : ""}`} aria-hidden />
    </div>
  );
}

export function ArrowLeft({ size = 20 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6" /></svg>;
}
export function ArrowRight({ size = 20 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
}
export function ChatIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z" /></svg>;
}
export function SendIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M20 12L4 4l3 8-3 8z" /></svg>;
}
export function ClipIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M21 11l-8.5 8.5a5 5 0 01-7-7L14 4a3.5 3.5 0 015 5l-8.5 8.5a2 2 0 01-3-3L15 7" /></svg>;
}
export function FileIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M6 3h8l4 4v14H6z M14 3v4h4" /></svg>;
}
