// One-time: move existing base64 portraits out of members.avatar_url into the
// public avatars bucket, leaving a short cacheable URL behind. New portraits
// already upload to the bucket; this clears the historical heavyweight rows.
//
//   Dry run:  SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/migrate-avatars.ts
//   Apply:    SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/migrate-avatars.ts --write
//
// Run the avatars-bucket SQL (bottom of supabase/policies.sql) first.

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import path from "path";

const WRITE = process.argv.includes("--write");

async function main() {
  const env = readFileSync(path.join(__dirname, "..", ".env.local"), "utf8");
  const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(\S+)/)?.[1];
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Need NEXT_PUBLIC_SUPABASE_URL (.env.local) and SUPABASE_SERVICE_ROLE_KEY (env).");
  const db = createClient(url, key, { auth: { persistSession: false } });

  const { data: members, error } = await db.from("members").select("id,cult_name,avatar_url");
  if (error) throw new Error(error.message);
  const heavy = (members || []).filter((m) => (m.avatar_url as string | null)?.startsWith("data:"));

  console.log(`${members?.length ?? 0} members; ${heavy.length} carry base64 portraits:`);
  for (const m of heavy) {
    const kb = Math.round(((m.avatar_url as string).length * 3) / 4 / 1024);
    console.log(`  ${String(kb).padStart(4)} KB  ${m.cult_name}`);
  }
  if (!WRITE) { console.log("\nDry run only — re-run with --write to migrate."); return; }

  for (const m of heavy) {
    const dataUrl = m.avatar_url as string;
    const b64 = dataUrl.split(",")[1];
    const mime = dataUrl.slice(5, dataUrl.indexOf(";")) || "image/webp";
    const ext = mime.includes("png") ? "png" : mime.includes("jpeg") ? "jpg" : "webp";
    const bytes = Buffer.from(b64, "base64");
    const objectPath = `${m.id}/${Date.now()}.${ext}`;
    const { error: upErr } = await db.storage.from("avatars").upload(objectPath, bytes, { contentType: mime, upsert: false });
    if (upErr) throw new Error(`${m.cult_name}: upload — ${upErr.message}`);
    const publicUrl = db.storage.from("avatars").getPublicUrl(objectPath).data.publicUrl;
    const { error: rowErr } = await db.from("members").update({ avatar_url: publicUrl }).eq("id", m.id);
    if (rowErr) throw new Error(`${m.cult_name}: row — ${rowErr.message}`);
    console.log(`  ✓ ${m.cult_name} → ${publicUrl}`);
  }
  console.log("\nDone. The roster travels light now.");
}

main().catch((e) => { console.error(e.message || e); process.exit(1); });
