// Checks for the Augury (augury.ts): the accord against the table, the
// palate table's completeness, the shadow's plain speech, and the veiled
// gate for incomplete petitions.
//
//   npx tsx scripts/verify-augury.ts

import { computeAugury, PALATE_OMEN } from "../src/lib/augury";
import type { Application, Member } from "../src/lib/types";

let pass = 0, fail = 0;
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` : ${detail}` : ""}`);
  ok ? pass++ : fail++;
};
const NOW = new Date("2026-07-10T12:00:00Z").getTime();

const app = (over: Partial<Application> = {}): Application => ({
  id: "a1", cult_name: "Neophyte Testerson", email: "x@y.z", oath: true, status: "pending", created_at: "2026-07-06",
  date_of_birth: "1991-03-12", time_of_birth: "14:15", birth_place: "Cape Town", birth_lat: -33.92, birth_lon: 18.42, birth_tz: "Africa/Johannesburg",
  ...over,
});
const KEISER: Member = { id: "m1", email: "k@c", cult_name: "The Keiser", short_name: "TK", role: "keiser", active: true, date_of_birth: "1988-11-05", time_of_birth: "03:30", birth_place: "Vryburg", birth_lat: -26.95, birth_lon: 24.73, birth_tz: "Africa/Johannesburg" };
const MATTHEW: Member = { ...KEISER, id: "m2", email: "m@c", cult_name: "Seer Matthew", short_name: "SM", role: "member", date_of_birth: "1990-06-14", time_of_birth: "09:45", birth_lat: -25.75, birth_lon: 28.19 };
const BARE: Member = { ...KEISER, id: "m3", email: "b@c", cult_name: "Elder Bare", role: "member", date_of_birth: null, time_of_birth: null, birth_lat: null, birth_lon: null };
const INITIATE: Member = { ...MATTHEW, id: "m4", email: "i@c", cult_name: "Initiate Soul", role: "initiate" };

// The full reading.
{
  const a = computeAugury(app(), [KEISER, MATTHEW, BARE, INITIATE], NOW)!;
  check("augury computes for a complete petition", !!a);
  check("accord present with a verdict", !!a.accord && a.accord.total >= 0 && a.accord.total <= 36 && !!a.accord.verdict, a.accord ? `${a.accord.total} ${a.accord.verdict}` : "");
  check("easiest and hardest are the two complete full members", !!a.easiest && !!a.hardest && a.easiest.name !== a.hardest.name, `${a.easiest?.name} / ${a.hardest?.name}`);
  check("incomplete member and initiate excluded", ![a.easiest?.name, a.hardest?.name].includes("Elder Bare") && ![a.easiest?.name, a.hardest?.name].includes("Initiate Soul"));
  check("palate omen is plain (no planet names)", !/venus|taurus|pisces|moon|saturn/i.test(a.palate), a.palate.slice(0, 40));
  check("shadow is plain (no planet or Sanskrit names)", !/rahu|ketu|chandra|shani|moon|saturn|venus/i.test(a.shadow), a.shadow.slice(0, 40));
}

// The veiled gate: no time of birth, no augury.
{
  check("incomplete petition gets no augury", computeAugury(app({ time_of_birth: null }), [KEISER, MATTHEW], NOW) === null);
}

// Nobody to compare against: accord null, omens still speak.
{
  const a = computeAugury(app(), [BARE, INITIATE], NOW)!;
  check("no complete members: accord null, palate + shadow still read", a.accord === null && !!a.palate && !!a.shadow);
}

// The palate table covers the full wheel.
{
  check("twelve palate omens, all distinct", PALATE_OMEN.length === 12 && new Set(PALATE_OMEN).size === 12);
}

// Determinism.
{
  const a = JSON.stringify(computeAugury(app(), [KEISER, MATTHEW], NOW));
  const b = JSON.stringify(computeAugury(app(), [KEISER, MATTHEW], NOW));
  check("the augury is deterministic", a === b);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
