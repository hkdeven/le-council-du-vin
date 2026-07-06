// A circular avatar: shows the uploaded portrait if there is one, else initials.
export default function Avatar({ src, initials, size = 30 }: { src?: string | null; initials: string; size?: number }) {
  const base = { width: size, height: size, borderRadius: "50%", flex: "none" as const, border: "1px solid var(--line2)" };
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" style={{ ...base, objectFit: "cover", display: "block" }} />;
  }
  return (
    <span style={{ ...base, background: "#1a1614", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Cinzel', serif", fontSize: Math.round(size * 0.36), color: "var(--gold2)" }}>
      {initials}
    </span>
  );
}
