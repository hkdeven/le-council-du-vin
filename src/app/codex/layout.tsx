// The codex keeps the Council's original palette (the Keiser's decree, when
// the rest of the app moved to pure black with white reading text). The
// classic-theme class restores the old colour tokens for everything inside.
export default function CodexLayout({ children }: { children: React.ReactNode }) {
  return <div className="classic-theme">{children}</div>;
}
