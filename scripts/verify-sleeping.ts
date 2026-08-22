// Checks for the sleeping seal: a sleeping member reads everything, writes nothing.
//
//   npx tsx scripts/verify-sleeping.ts
//
// This exercises the CLIENT lock (the wrapped Supabase client in
// src/lib/supabase.ts). The vault's restrictive RLS policies are the real
// enforcement and cannot be exercised from here; they live in
// supabase/policies.sql under "THE SLEEPING SEAL".
//
// NOTE the dynamic imports below: `import` statements are hoisted above any
// assignment, so a static import would read the env before it was set and hand
// us a null client. A null client makes every "refused" check fail and every
// "untouched" check pass for the wrong reason, which is exactly how a seal
// gets shipped broken with a green suite.

let pass = 0, fail = 0;
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` : ${detail}` : ""}`);
  ok ? pass++ : fail++;
};

async function main() {
  process.env.NEXT_PUBLIC_SUPABASE_URL ||= "https://fixture.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= "fixture-anon-key";

  const { supabase } = await import("../src/lib/supabase");
  const { setWriteLock, assertWrite, isSealed, SLEEPING_MESSAGE } = await import("../src/lib/writeLock");

  const sealed = (fn: () => unknown): boolean => {
    try { fn(); return false; } catch (e) { return (e as Error).message === SLEEPING_MESSAGE; }
  };
  const allowed = (fn: () => unknown): boolean => {
    try { fn(); return true; } catch (e) { return (e as Error).message !== SLEEPING_MESSAGE; }
  };

  if (!supabase) {
    console.log("FAIL  the client is wired for the fixture : supabase is null, every check below would lie");
    process.exit(1);
  }
  const sb = supabase;
  check("the client is wired for the fixture", true);

  // ── Awake: everything passes ──────────────────────────────────────────────
  setWriteLock(false);
  check("awake: the seal reports open", !isSealed());
  check("awake: assertWrite does not throw", allowed(() => assertWrite()));
  check("awake: a member update is allowed", allowed(() => sb.from("members").update({ cult_name: "x" })));
  check("awake: a ballot insert is allowed", allowed(() => sb.from("ballots").insert({})));
  check("awake: an avatar upload is allowed", allowed(() => sb.storage.from("avatars").upload("p", new Blob(["x"]))));

  // ── Sleeping: every write is refused ───────────────────────────────────────
  setWriteLock(true);
  check("sleeping: the seal reports shut", isSealed());
  check("sleeping: assertWrite throws the decree", sealed(() => assertWrite()));

  for (const table of ["members", "applications", "gatherings", "themes", "theme_favours", "polls", "ballots", "offerings", "annals"]) {
    check(`sleeping: ${table} update refused`, sealed(() => sb.from(table).update({})));
    check(`sleeping: ${table} insert refused`, sealed(() => sb.from(table).insert({})));
    check(`sleeping: ${table} delete refused`, sealed(() => sb.from(table).delete()));
  }
  check("sleeping: an upsert is refused", sealed(() => sb.from("annals").upsert({})));

  // The decree: reading rights are untouched.
  check("sleeping: select is UNTOUCHED", allowed(() => sb.from("members").select("*")));
  check("sleeping: select with filters is untouched", allowed(() => sb.from("annals").select("*").eq("number", 1)));

  // RPCs: the writing one is sealed, the reading one is not.
  check("sleeping: cast_counsel (a write) refused", sealed(() => sb.rpc("cast_counsel", { app_id: "x", vote: "anoint" })));
  check("sleeping: reveal_summary (a read) untouched", allowed(() => sb.rpc("reveal_summary", { gid: "x" })));

  // Storage: records buckets sealed, the self-serving chart bucket open.
  const blob = new Blob(["x"]);
  check("sleeping: avatars upload refused (a portrait is their own record)", sealed(() => sb.storage.from("avatars").upload("p", blob)));
  // The Keiser's decree, 2026-07-17: photographs of past nights are the one
  // write a sleeping hand keeps.
  check("sleeping: reveal-photos upload UNTOUCHED", allowed(() => sb.storage.from("reveal-photos").upload("p", blob)));
  check("sleeping: add_reveal_photo RPC UNTOUCHED", allowed(() => sb.rpc("add_reveal_photo", { gid: "x", url: "u" })));
  check("sleeping: claim_bottle is REFUSED (a claim is a write on the record)",
    sealed(() => sb.rpc("claim_bottle", { gid: "x", row_index: 0 })));
  check("sleeping: a gatherings update is still refused (the RPC is the only door)", sealed(() => sb.from("gatherings").update({ theme_title: "x" })));
  check("sleeping: charts upload UNTOUCHED (their own sky, their own inbox)",
    allowed(() => sb.storage.from("charts").upload("p", blob)));
  check("sleeping: reading a public URL untouched", allowed(() => sb.storage.from("avatars").getPublicUrl("p")));

  // Auth: sleep must never lock a soul out of their own door.
  check("sleeping: the auth door is untouched", typeof sb.auth.signInWithPassword === "function");

  // ── Waking restores everything ────────────────────────────────────────────
  setWriteLock(false);
  check("woken: writes flow again", allowed(() => sb.from("members").update({ cult_name: "x" })));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main();
