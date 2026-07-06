// The moon-phase row from the gate, used as a section divider.
export default function MoonDivider() {
  return (
    <div style={{ display: "flex", justifyContent: "center", gap: 12, margin: "30px 0", color: "var(--gold)", opacity: 0.5, fontSize: 16 }} aria-hidden="true">
      <i className="ti ti-moon-stars" /><i className="ti ti-moon" /><i className="ti ti-circle" /><i className="ti ti-moon-2" /><i className="ti ti-moon-stars" />
    </div>
  );
}
