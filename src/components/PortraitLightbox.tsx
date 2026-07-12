"use client";

// The portrait lightbox: tap a portrait, see it large; tap anywhere to put it
// back. One component, shared by the member card and the tribunal's
// petitioner card (#9), so enlarging behaves the same everywhere.
//
// Mount it as a SIBLING of any transformed card, never inside it — a CSS
// transform becomes the containing block for position:fixed and would trap
// the lightbox inside the card.
export default function PortraitLightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  return (
    <div
      onClick={(e) => { e.stopPropagation(); onClose(); }}
      style={{ position: "fixed", inset: 0, zIndex: 150, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "zoom-out" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        style={{ width: "min(78vw, 340px)", height: "min(78vw, 340px)", objectFit: "cover", borderRadius: 16, border: "1px solid var(--gold)", boxShadow: "0 0 0 1px rgba(0,0,0,0.6), 0 24px 70px rgba(0,0,0,0.8)" }}
      />
    </div>
  );
}
