// Checks for the summons (.ics): the parts that actually break calendar invites.
//
//   npx tsx scripts/verify-ics.ts

import { summonsIcs, summonsUid, zonedToUtc } from "../src/lib/ics";

let pass = 0, fail = 0;
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` : ${detail}` : ""}`);
  ok ? pass++ : fail++;
};

const NOW = Date.UTC(2026, 6, 20, 9, 0, 0);
const base = {
  gatheringId: "g-abc",
  number: 17,
  theme: "Cape Cabernet",
  date: "2026-08-08",
  time: "19:00",
  hostName: "Seer Matthew",
  venue: "12 Vineyard Road, Constantia",
  organizerEmail: "council@lecouncilduvin.co.za",
  attendeeEmail: "member@example.com",
  attendeeName: "Priestess Larissa",
  nowMs: NOW,
};

const ics = summonsIcs(base);
const lines = ics.split("\r\n");
// A client UNFOLDS before it parses, so content checks must too: a long line
// is legitimately split mid-token ("RSVP=F" + "ALSE"), which is valid and must
// not read as a failure. Structure checks below still use the folded text.
const unfold = (t: string) => t.replace(/\r\n[ \t]/g, "");
const has = (needle: string) => unfold(ics).includes(needle);

// ── The three things that decide event-vs-attachment ────────────────────────
check("METHOD:REQUEST is in the body", has("METHOD:REQUEST"));
check("the recipient is named as an ATTENDEE", has("mailto:member@example.com"));
check("the attendee is not pestered to RSVP again", has("PARTSTAT=ACCEPTED") && has("RSVP=FALSE"));
check("an ORGANIZER is named", has("ORGANIZER;CN=Le Council du Vin:mailto:council@lecouncilduvin.co.za"));

// ── Structure ───────────────────────────────────────────────────────────────
check("opens and closes as a calendar", lines[0] === "BEGIN:VCALENDAR" && ics.trimEnd().endsWith("END:VCALENDAR"));
check("carries VERSION and PRODID", has("VERSION:2.0") && has("PRODID:"));
for (const p of ["UID:", "DTSTAMP:", "DTSTART:", "DTEND:", "SUMMARY:", "SEQUENCE:", "STATUS:CONFIRMED"]) {
  check(`carries ${p}`, has(p));
}
check("a reminder rides the night before", has("BEGIN:VALARM") && has("TRIGGER:-P1D"));

// ── CRLF everywhere: a lone newline and some clients refuse the file ────────
check("every line ends CRLF, none bare", !/[^\r]\n/.test(ics));

// ── The clock: 19:00 in Johannesburg is 17:00 UTC (fixed +02:00, no DST) ────
check("DTSTART converts local to UTC", has("DTSTART:20260808T170000Z"), lines.find((l) => l.startsWith("DTSTART")) || "");
check("DTEND is three hours later", has("DTEND:20260808T200000Z"));
check("a summer date keeps the same offset (SA has no daylight saving)",
  summonsIcs({ ...base, date: "2026-12-12" }).includes("DTSTART:20261212T170000Z"));
check("zonedToUtc agrees with the wall clock", new Date(zonedToUtc("2026-08-08", "19:00", "Africa/Johannesburg")).toISOString() === "2026-08-08T17:00:00.000Z");
// A zone that DOES keep daylight saving, to prove the two-pass conversion.
check("a DST zone is handled (London, summer = UTC+1)",
  new Date(zonedToUtc("2026-07-01", "19:00", "Europe/London")).toISOString() === "2026-07-01T18:00:00.000Z");
check("a DST zone in winter (London = UTC)",
  new Date(zonedToUtc("2026-01-15", "19:00", "Europe/London")).toISOString() === "2026-01-15T19:00:00.000Z");

// ── One night, one entry: a second send amends, never duplicates ────────────
check("the UID is stable across sends", summonsUid("g-abc") === summonsUid("g-abc"));
check("two members of the same night share the UID",
  unfold(summonsIcs({ ...base, attendeeEmail: "other@example.com" })).includes(summonsUid("g-abc")));
check("a different night takes a different UID", summonsUid("g-abc") !== summonsUid("g-xyz"));
{
  const later = summonsIcs({ ...base, nowMs: NOW + 3600000 });
  const seq = (t: string) => Number(t.split("\r\n").find((l) => l.startsWith("SEQUENCE:"))!.slice(9));
  check("SEQUENCE rises with a later send", seq(later) > seq(ics), `${seq(ics)} then ${seq(later)}`);
}

// ── Escaping (RFC 5545 §3.3.11) ─────────────────────────────────────────────
{
  const nasty = summonsIcs({
    ...base,
    theme: "Reds; whites, and a \\ backslash",
    venue: "Gate code 1234\nRing twice; the dog is friendly, mostly",
  });
  const flat = unfold(nasty);
  check("semicolons are escaped", flat.includes("Reds\\; whites"));
  check("commas are escaped", flat.includes("whites\\, and"));
  check("backslashes are escaped", flat.includes("\\\\ backslash"));
  check("newlines become \\n, never a raw break", flat.includes("Gate code 1234\\nRing twice"));
  check("a colon is left alone (it needs no escape)", unfold(summonsIcs({ ...base, theme: "19:00 sharp" })).includes("19:00 sharp"));
}

// ── Folding at 75 octets, never mid-character ───────────────────────────────
{
  const long = summonsIcs({ ...base, theme: "A" + "veryLongTheme".repeat(20) });
  const bad = long.split("\r\n").filter((l) => Buffer.from(l, "utf8").length > 75);
  check("no line exceeds 75 octets", bad.length === 0, bad.length ? `${bad.length} too long` : "");
  check("continuations begin with one space", long.split("\r\n").some((l) => l.startsWith(" ")));
}
{
  // Accented and emoji text must survive the fold intact.
  const uni = summonsIcs({ ...base, theme: "Rosé Sauternes ★ " + "château ".repeat(20) });
  const unfolded = unfold(uni);
  check("multi-byte characters survive folding", unfolded.includes("Rosé Sauternes ★") && !unfolded.includes("�"));
}

// ── Withdrawal ──────────────────────────────────────────────────────────────
{
  const off = summonsIcs({ ...base, cancel: true });
  check("a withdrawal is METHOD:CANCEL", off.includes("METHOD:CANCEL"));
  check("a withdrawal is STATUS:CANCELLED", off.includes("STATUS:CANCELLED"));
  check("a withdrawal keeps the same UID (so it matches the event)", unfold(off).includes(summonsUid("g-abc")));
  check("a withdrawal carries no reminder", !off.includes("BEGIN:VALARM"));
}

// ── Defaults ────────────────────────────────────────────────────────────────
check("no time given falls to 19:00", summonsIcs({ ...base, time: null }).includes("DTSTART:20260808T170000Z"));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
