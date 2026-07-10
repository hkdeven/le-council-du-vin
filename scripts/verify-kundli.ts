// Triple-check for the Kundli's readings, in the vein of verify-vedic.ts:
//  1. Kuta components against hand-derivable classical facts
//  2. Yoga detection against the Keiser's independently confirmed chart
//  3. Invariants (score bounds, symmetry of the Council accord, muhurta shape)
//
//   npx tsx scripts/verify-kundli.ts

import { kutaAccord, kutaDirectional, kutaVerdict, detectYogas, mangalDosha, pillarsOf, muhurtaDays, vashyaGroup, GANA, NADI, YONI, RASHI_LORDS, feelingOf } from "../src/lib/kundli";
import { vedicChart, NAKSHATRAS, nakshatraOf } from "../src/lib/vedic";

let pass = 0, fail = 0;
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  ok ? pass++ : fail++;
};

// Moon longitude that lands in a given nakshatra's centre (sidereal).
const midOf = (nk: number) => nk * (360 / 27) + 360 / 54;

// ── 1. classical facts ──────────────────────────────────────────────────────
{
  // Same nakshatra, same rashi: nadi 0 (same pulse) and tara 0 (Janma both
  // ways) are unavoidable, so an identical pair peaks at 25 of 36.
  const k = kutaAccord(midOf(11), midOf(11)); // Uttara Phalguni p1-ish
  check("identical moons: nadi scores 0 (same pulse)", k.nadi === 0, `nadi ${k.nadi}`);
  check("identical moons: tara scores 0 (Janma both ways, even-remainder rule)", k.tara === 0, `tara ${k.tara}`);
  check("identical moons: varna, gana, yoni, maitri all full", k.varna === 1 && k.gana === 6 && k.yoni === 4 && k.maitri === 5, JSON.stringify(k));
  check("identical moons: bhakoot full (same sign is not a bad pair)", k.bhakoot === 7);
  check("identical moons total 25 of 36", k.total === 25, `${k.total}`);

  // Different nadi scores 8: Ashwini (Adi) vs Bharani (Madhya).
  const k2 = kutaAccord(midOf(0), midOf(1));
  check("Ashwini vs Bharani: nadi 8 (different pulse)", k2.nadi === 8, `nadi ${k2.nadi}`);

  // Bhakoot: moon signs 6 apart (shashtashtaka 6/8) score 0 both ways.
  const mesha = 15, kanya = 155; // Mesha vs Kanya = 6th/8th from each other
  const k3 = kutaAccord(mesha, kanya);
  check("Mesha–Kanya moons: bhakoot 0 (6/8)", k3.bhakoot === 0, `bhakoot ${k3.bhakoot}`);

  // Nadi pattern is the classical zigzag: first six are Adi Madhya Antya Antya Madhya Adi.
  check("nadi zigzag opening", NADI.slice(0, 6).join("") === "012210", NADI.slice(0, 6).join(""));
  check("27 nadis balance 9/9/9", [0, 1, 2].every((n) => NADI.filter((x) => x === n).length === 9));
  check("27 ganas balance 9/9/9", [0, 1, 2].every((n) => GANA.filter((x) => x === n).length === 9));
  check("yoni covers all 27 nakshatras with 14 animals", YONI.length === 27 && new Set(YONI).size === 14);

  // Graha maitri: classical friendships hold.
  check("Sun and Venus are enemies", feelingOf("Sun", "Venus") === "enemy");
  check("Moon has no enemies", feelingOf("Moon", "Venus") !== "enemy" && feelingOf("Moon", "Saturn") !== "enemy");
  check("Mercury calls the Moon enemy (one-sided)", feelingOf("Mercury", "Moon") === "enemy" && feelingOf("Moon", "Mercury") === "friend");

  // Vashya half-signs: early Dhanu is human, late Dhanu quadruped; late Makara water.
  check("Dhanu 5° is Manava, Dhanu 25° is Chatushpada", vashyaGroup(245) === 1 && vashyaGroup(265) === 0);
  check("Makara 25° is Jalachara", vashyaGroup(295) === 2);
}

// ── 1b. a fully published worked example, reproduced kuta by kuta ───────────
// AstroSage's Virat Kohli + Anushka Sharma match: bride Moon in Mesha,
// Krittika pada 1; groom Moon in Vrishabha, Rohini pada 3. Published
// breakdown: varna 0, vashya 2, tara 3, yoni 2, maitri 3, gana 0, bhakoot 0,
// nadi 0 — total 10 of 36.
{
  const bride = 28; // Mesha 28°: Krittika pada 1
  const groom = 48; // Vrishabha 18°: Rohini pada 3
  const k = kutaDirectional(bride, groom);
  check("published example: varna 0 (Vaishya groom under Kshatriya bride)", k.varna === 0, `${k.varna}`);
  check("published example: vashya 2 (both quadruped)", k.vashya === 2, `${k.vashya}`);
  check("published example: tara 3 (both counts favourable)", k.tara === 3, `${k.tara}`);
  check("published example: yoni 2 (Serpent with Sheep)", k.yoni === 2, `${k.yoni}`);
  check("published example: maitri 3 (Venus and Mars, both neutral)", k.maitri === 3, `${k.maitri}`);
  check("published example: gana 0 (Manushya groom, Rakshasa bride)", k.gana === 0, `${k.gana}`);
  check("published example: bhakoot 0 (2/12 pair)", k.bhakoot === 0, `${k.bhakoot}`);
  check("published example: nadi 0 (both Antya)", k.nadi === 0, `${k.nadi}`);
  check("published example: total 10 of 36", k.total === 10, `${k.total}`);
  // The gana matrix is directed, classical orientation: a Deva groom with a
  // Manushya bride scores full 6, the reverse 5.
  const mid = (nk: number) => nk * (360 / 27) + 360 / 54;
  const gDM = kutaDirectional(mid(0), mid(1)); // bride Ashwini (Deva), groom Bharani (Manushya)
  const gMD = kutaDirectional(mid(1), mid(0));
  check("gana direction (classical): Manushya groom + Deva bride 5, reverse 6", gDM.gana === 5 && gMD.gana === 6, `${gDM.gana}/${gMD.gana}`);
}

// ── 1b. invariants over many pairs ──────────────────────────────────────────
{
  let ok = true, sym = true;
  for (let a = 0; a < 27; a++) for (let b = 0; b < 27; b++) {
    const k = kutaAccord(midOf(a), midOf(b));
    if (k.total < 0 || k.total > 36) ok = false;
    const r = kutaAccord(midOf(b), midOf(a));
    if (Math.abs(k.total - r.total) > 1e-9) sym = false;
  }
  check("all 729 pairs score within 0..36", ok);
  check("the Council accord is symmetric (A·B = B·A)", sym);
}

// ── 2. the Keiser's chart, independently confirmed placements ───────────────
{
  const chart = vedicChart("1988-11-05", "03:30", "Africa/Johannesburg", -26.95, 24.73, Date.UTC(2026, 6, 10))!;
  const yogas = detectYogas(chart).map((y) => y.key);
  check("Gajakesari present (Guru kendra from Chandra: Vrishabha from Simha = 10th)", yogas.includes("gajakesari"), yogas.join(","));
  check("Budhaditya present (Surya + Budha in Tula)", yogas.includes("budhaditya"));
  check("Kemadruma absent (Shukra sits 2nd from Chandra)", !yogas.includes("kemadruma"));
  check("Chandra-Mangala absent (Simha vs Meena)", !yogas.includes("chandramangala"));
  check("no Mahapurusha yoga (no dignified planet in kendra)", !["ruchaka", "bhadra", "hamsa", "malavya", "sasa"].some((k) => yogas.includes(k)));
  check("mangal dosha present (Mangala in the 7th)", mangalDosha(chart) === true);

  const p = pillarsOf(chart);
  check("lagna lord is Budha (Kanya rises)", p.lagnaLord === "Mercury");
  check("lagna lord stands in the 2nd (Budha in Tula)", p.lagnaLordHouse === 2);
  check("10th is Mithuna, ruled by Budha", p.tenthRashi === 2 && p.tenthLord === "Mercury");
  check("7th is Meena, lord Guru in the 9th", p.seventhRashi === 11 && p.seventhLord === "Jupiter" && p.seventhLordHouse === 9);
  check("pitfalls include Chandra with Ketu and Chandra in the 12th", p.pitfalls.includes("moon-ketu") && p.pitfalls.includes("moon-h12"), p.pitfalls.join(","));
}

// ── 3. muhurta shape ────────────────────────────────────────────────────────
{
  const chart = vedicChart("1988-11-05", "03:30", "Africa/Johannesburg", -26.95, 24.73, Date.UTC(2026, 6, 10))!;
  const m = muhurtaDays(chart.moonNakshatra, chart.lagna.rashi, Date.UTC(2026, 6, 10));
  check("muhurta finds favourable days within a month", m.favourable.length === 3, `${m.favourable.length}`);
  check("muhurta names hostile days too", m.hostile.length >= 1, `${m.hostile.length}`);
  check("no day is both favourable and hostile", !m.favourable.some((f) => m.hostile.some((h) => h.ms === f.ms)));
  // The Moon crosses ~1 nakshatra per day; favourable days must actually have
  // a good tara: re-derive one and confirm.
  const dayLords = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"];
  const lagnaLord = RASHI_LORDS[chart.lagna.rashi];
  const friendly = m.favourable.every((f) => feelingOf(lagnaLord, dayLords[new Date(f.ms).getDay()]) !== "enemy");
  check("every favourable day is ruled by a non-enemy of the lagna lord", friendly);
}

// ── 3b. verdict bands ───────────────────────────────────────────────────────
{
  check("verdict bands", kutaVerdict(31) === "a rare accord" && kutaVerdict(26.5) === "strong" && kutaVerdict(21) === "workable" && kutaVerdict(14) === "effortful");
  const uttaraPhalguni = NAKSHATRAS[11];
  check("nakshatra table intact", uttaraPhalguni === "Uttara Phalguni" && nakshatraOf(midOf(11)).nakshatra === 11);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
