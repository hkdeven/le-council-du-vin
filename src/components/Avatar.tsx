// A circular avatar: the uploaded portrait if there is one, else the
// Council's pyramid mark (Keiser's decree, 2026-07-10; initials retired).
export default function Avatar({ src, initials, size = 30 }: { src?: string | null; initials: string; size?: number }) {
  const base = { width: size, height: size, borderRadius: "50%", flex: "none" as const, border: "1px solid var(--line2)" };
  void initials; // kept in the signature so call sites stay untouched
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src || "/site-mark.png"} alt="" style={{ ...base, objectFit: "cover", display: "block", background: "#1a1614", padding: src ? 0 : Math.round(size * 0.12) }} />;
}
