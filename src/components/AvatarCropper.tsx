"use client";

import { useState, useCallback } from "react";
import Cropper, { Area } from "react-easy-crop";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function cropToDataUrl(src: string, area: Area): Promise<string> {
  const img = await loadImage(src);
  const canvas = document.createElement("canvas");
  const size = 256;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, size, size);
  return canvas.toDataURL("image/webp", 0.85);
}

export default function AvatarCropper({
  src,
  onSave,
  onCancel,
}: {
  src: string;
  onSave: (url: string) => void;
  onCancel: () => void;
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [pixels, setPixels] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);

  const onComplete = useCallback((_: Area, p: Area) => setPixels(p), []);

  const save = async () => {
    if (!pixels) return;
    setBusy(true);
    const url = await cropToDataUrl(src, pixels);
    onSave(url);
  };

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="eyebrow" style={{ marginBottom: 10 }}>Frame your portrait</div>
      <div style={{ position: "relative", width: "100%", height: 260, background: "#000", borderRadius: 12, overflow: "hidden" }}>
        <Cropper
          image={src}
          crop={crop}
          zoom={zoom}
          aspect={1}
          cropShape="round"
          showGrid={false}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onComplete}
        />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "14px 0 4px" }}>
        <i className="ti ti-zoom-in" style={{ color: "var(--gold)" }} aria-hidden="true" />
        <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} style={{ flex: 1, accentColor: "var(--gold)" }} aria-label="Zoom" />
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
        <button className="btn gold" style={{ flex: 1 }} onClick={save} disabled={busy}>
          {busy ? "Sealing…" : "Set portrait"}
        </button>
        <button className="btn" style={{ flex: 1 }} onClick={onCancel} disabled={busy}>Cancel</button>
      </div>
    </div>
  );
}
