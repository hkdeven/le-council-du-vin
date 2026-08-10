// The summons, in the language calendars speak (RFC 5545 / iTIP RFC 5546).
//
// When a soul answers a call, the night is posted to their calendar. Three
// things decide whether a client shows a real event rather than a dumb file,
// and all three are honoured here:
//   1. METHOD:REQUEST inside the body (below),
//   2. method=REQUEST on the attachment's content type (see the send route),
//   3. an ATTENDEE line carrying the recipient's own address.
//
// The fussy parts, which are what usually break an invite:
//   - CRLF line endings, always. A lone \n and some clients refuse the file.
//   - Folding at 75 OCTETS, not characters, and never mid-character.
//   - TEXT escaping: backslash, semicolon, comma, newline. (A colon is fine.)
//   - Times in UTC "Z" form. South Africa keeps a fixed +02:00 with no daylight
//     saving, so the Z form is exact and spares us a VTIMEZONE block, which is
//     itself a common source of "the event landed an hour out".
//   - A STABLE UID per gathering, so a second send AMENDS the night in their
//     calendar instead of littering it with duplicates.

import { DEFAULT_TZ, tzOffsetMin } from "./astrology";

export interface SummonsEvent {
  gatheringId: string;
  number: number;
  theme: string;
  date: string; // YYYY-MM-DD, the local wall clock of the gathering
  time?: string | null; // HH:MM local; the Council pours at 19:00 unless told otherwise
  durationMin?: number; // a wine night runs three hours by default
  tz?: string;
  hostName?: string | null;
  venue?: string | null; // the host's venue instructions
  organizerEmail: string;
  organizerName?: string;
  attendeeEmail: string;
  attendeeName?: string | null;
  cancel?: boolean; // a withdrawn RSVP, or a night called off
  nowMs?: number;
}

const DOMAIN = "lecouncilduvin.co.za";

// RFC 5545 §3.3.11: only these four, in this order (backslash first, or we
// would escape the escapes we just added).
const esc = (s: string) =>
  (s || "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");

// Fold at 75 octets with a leading space on continuations, counting UTF-8
// bytes and never splitting a character in half.
function fold(line: string): string {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let start = 0;
  while (start < bytes.length) {
    // First chunk takes 75 octets; continuations take 74, since the leading
    // space they carry counts toward the limit.
    let end = Math.min(start + (out.length === 0 ? 75 : 74), bytes.length);
    // Never cut mid-character: back up off any UTF-8 continuation byte.
    while (end > start && end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--;
    // Never split an escape pair either. Unfolding happens before escapes are
    // read, so "\" + "n" is legal, but lenient clients have been known to
    // mangle it, and this costs one byte to avoid.
    if (end > start + 1 && end < bytes.length && bytes[end - 1] === 0x5c) end--;
    out.push(bytes.subarray(start, end).toString("utf8"));
    start = end;
  }
  return out.join("\r\n ");
}

// A UTC instant from a wall clock reading in a named zone. Two passes: guess
// the offset, then re-read it at the corrected instant, which settles any
// daylight-saving boundary (South Africa has none, but the club may travel).
export function zonedToUtc(date: string, time: string, tz: string): number {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const naive = Date.UTC(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0);
  let utc = naive - tzOffsetMin(tz, naive) * 60000;
  utc = naive - tzOffsetMin(tz, utc) * 60000;
  return utc;
}

const stamp = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

// The UID names the EVENT, so it is the same for every soul invited: one
// night, one entry. Send it twice and the calendar amends rather than doubles.
export const summonsUid = (gatheringId: string) => `lcv-${gatheringId}@${DOMAIN}`;

// SEQUENCE must never go backwards, or a client will ignore the newer word as
// stale. Minutes since 2025 rises with every send, so the latest always wins.
const sequenceFor = (nowMs: number) => Math.floor((nowMs - Date.UTC(2025, 0, 1)) / 60000);

export function summonsIcs(e: SummonsEvent): string {
  const nowMs = e.nowMs ?? Date.now();
  const tz = e.tz || DEFAULT_TZ;
  const startMs = zonedToUtc(e.date, e.time || "19:00", tz);
  const endMs = startMs + (e.durationMin ?? 180) * 60000;

  const title = `Le Council du Vin · Gathering ${roman(e.number)}${e.theme ? `: ${e.theme}` : ""}`;
  const lines = [
    "Gathering " + roman(e.number) + (e.theme ? ` · ${e.theme}` : ""),
    e.hostName ? `At the table of ${e.hostName}.` : "",
    "",
    e.venue || "",
    "",
    "Bring a bottle that answers the theme. The cloths lift when every soul has judged.",
    `https://${DOMAIN}/convene`,
  ].filter((x, i, a) => !(x === "" && a[i - 1] === "")); // never two blank lines running

  const body: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Le Council du Vin//The Summons//EN",
    "CALSCALE:GREGORIAN",
    `METHOD:${e.cancel ? "CANCEL" : "REQUEST"}`,
    "BEGIN:VEVENT",
    `UID:${summonsUid(e.gatheringId)}`,
    `DTSTAMP:${stamp(nowMs)}`,
    `DTSTART:${stamp(startMs)}`,
    `DTEND:${stamp(endMs)}`,
    `SUMMARY:${esc(title)}`,
    `DESCRIPTION:${esc(lines.join("\n"))}`,
    e.venue ? `LOCATION:${esc(e.venue.split("\n")[0])}` : "",
    `ORGANIZER;CN=${esc(e.organizerName || "Le Council du Vin")}:mailto:${e.organizerEmail}`,
    // They have already answered in the app, so their calendar is told the
    // seat is accepted and must not pester them to RSVP a second time.
    `ATTENDEE;CN=${esc(e.attendeeName || e.attendeeEmail)};ROLE=REQ-PARTICIPANT;PARTSTAT=${e.cancel ? "DECLINED" : "ACCEPTED"};RSVP=FALSE:mailto:${e.attendeeEmail}`,
    `SEQUENCE:${sequenceFor(nowMs)}`,
    `STATUS:${e.cancel ? "CANCELLED" : "CONFIRMED"}`,
    "TRANSP:OPAQUE",
    `URL:https://${DOMAIN}/convene`,
  ].filter(Boolean);

  // One reminder the evening before: time enough to find a bottle.
  if (!e.cancel) {
    body.push(
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      "DESCRIPTION:The Council gathers tomorrow. Choose your bottle.",
      "TRIGGER:-P1D",
      "END:VALARM"
    );
  }
  body.push("END:VEVENT", "END:VCALENDAR");

  return body.map(fold).join("\r\n") + "\r\n";
}

function roman(n: number): string {
  const map: [number, string][] = [
    [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"],
    [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];
  let out = "";
  for (const [v, s] of map) while (n >= v) { out += s; n -= v; }
  return out || "I";
}
