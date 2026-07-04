export default function Emblem({ size = 64 }: { size?: number }) {
  const rays = Array.from({ length: 36 }, (_, i) => {
    const a = (i * Math.PI) / 18;
    const c = Math.cos(a);
    const n = Math.sin(a);
    return {
      x1: (60 + c * 44).toFixed(1),
      y1: (60 + n * 44).toFixed(1),
      x2: (60 + c * 53).toFixed(1),
      y2: (60 + n * 53).toFixed(1),
    };
  });
  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      aria-hidden="true"
      style={{ flex: "none" }}
    >
      <g stroke="var(--gold)" strokeWidth="1">
        {rays.map((r, i) => (
          <line key={i} x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2} />
        ))}
      </g>
      <polygon points="60,28 95,86 25,86" fill="none" stroke="var(--gold)" strokeWidth="1.5" />
      <ellipse cx="60" cy="64" rx="17" ry="11" fill="none" stroke="var(--gold)" strokeWidth="1" />
      <circle cx="60" cy="64" r="5" fill="var(--gold)" />
    </svg>
  );
}
