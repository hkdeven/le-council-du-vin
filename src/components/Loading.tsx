// The Council's waiting mark: a turning loader and a whisper, shown wherever
// data is still on its way — so an empty screen never masquerades as no data.

export default function Loading({ text = "Consulting the annals…" }: { text?: string }) {
  return (
    <div style={{ textAlign: "center", padding: "26px 0" }} role="status" aria-live="polite">
      <i className="ti ti-loader-2 lcv-spin" style={{ fontSize: 22, color: "var(--gold)" }} aria-hidden="true" />
      <p className="whisper" style={{ fontSize: 14, margin: "8px 0 0" }}>{text}</p>
    </div>
  );
}
