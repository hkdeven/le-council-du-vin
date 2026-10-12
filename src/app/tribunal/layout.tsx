// The tribunal keeps the Council's original palette (see codex/layout.tsx).
export default function TribunalLayout({ children }: { children: React.ReactNode }) {
  return <div className="classic-theme">{children}</div>;
}
