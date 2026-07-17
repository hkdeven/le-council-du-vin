// Branded, mobile-first HTML for every transactional email. Email clients strip
// <style> and don't load web fonts reliably, so everything is inline and falls
// back to serif. Dark "The Deep" theme with tarnished gold. One layout wraps
// each message; each builder returns { subject, html }.

const SITE = "https://lecouncilduvin.co.za";
const LOGO = `${SITE}/black-gold-full-logo.png`;
const MOONS = `${SITE}/email-moons.png`;
const INSTAGRAM = "https://instagram.com/lecouncilduvin";

const HEAD_FONT = `'Cinzel','Playfair Display',Georgia,'Times New Roman',serif`;
const BODY_FONT = `'EB Garamond',Georgia,'Times New Roman',serif`;
// Cursive display face for the title. Loads in clients that honour web fonts
// (Apple Mail); elsewhere it falls back to a system script, then generic cursive.
const SCRIPT_FONT = `'Great Vibes','Snell Roundhand','Apple Chancery','Brush Script MT',cursive`;

function layout(inner: string, preheader = "", afterFooter = ""): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<link href="https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background-color:#0a0908;-webkit-text-size-adjust:100%;">
<span style="display:none;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">${preheader}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0a0908;">
  <tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background-color:#12100e;border:1px solid #3a3327;border-radius:14px;">
      <tr><td align="center" style="padding:30px 24px 6px;">
        <img src="${LOGO}" alt="Le Council du Vin" width="210" style="display:block;width:210px;max-width:72%;height:auto;">
      </td></tr>
      <tr><td style="padding:6px 30px 26px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="color:#cabfa2;font-family:${BODY_FONT};font-size:16px;line-height:1.62;">
          ${inner}
        </td></tr></table>
      </td></tr>
      <tr><td align="center" style="padding:16px 24px 26px;border-top:1px solid #241f18;">
        <div style="color:#6f6653;font-family:${BODY_FONT};font-size:12px;letter-spacing:1px;font-style:italic;">in vino veritas</div>
        <div style="margin-top:6px;">
          <a href="${SITE}" style="color:#9c8a5f;font-family:${BODY_FONT};font-size:12px;text-decoration:none;">lecouncilduvin.co.za</a>
          <span style="color:#4a4436;">&nbsp;&middot;&nbsp;</span>
          <a href="${INSTAGRAM}" style="color:#9c8a5f;font-family:${BODY_FONT};font-size:12px;text-decoration:none;">Instagram</a>
        </div>
      </td></tr>
      ${afterFooter ? `<tr><td style="padding:14px 24px 22px;border-top:1px solid #241f18;">
        <div style="color:#5a554c;font-family:${BODY_FONT};font-size:11.5px;line-height:1.55;text-align:left;">${afterFooter}</div>
      </td></tr>` : ""}
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function heading(text: string): string {
  return `<h1 style="margin:0 0 12px;color:#cbbd93;font-family:${SCRIPT_FONT};font-size:40px;font-weight:400;letter-spacing:0;line-height:1.15;text-align:center;">${text}</h1>`;
}
function moons(): string {
  return `<div style="text-align:center;margin:2px 0 16px;"><img src="${MOONS}" alt="" width="150" style="display:inline-block;width:150px;max-width:56%;height:auto;"></div>`;
}
function p(text: string): string {
  return `<p style="margin:0 0 14px;color:#cabfa2;font-family:${BODY_FONT};font-size:16px;line-height:1.62;">${text}</p>`;
}
function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:20px auto 6px;"><tr><td align="center" bgcolor="#cbbd93" style="border-radius:8px;">
    <a href="${href}" style="display:inline-block;background-color:#cbbd93;color:#0a0908;font-family:${HEAD_FONT};font-size:13px;font-weight:600;letter-spacing:2px;text-transform:uppercase;text-decoration:none;padding:13px 30px;border-radius:8px;">${label}</a>
  </td></tr></table>`;
}
// A full-width horizontal rule. Table-based so Outlook draws it too.
function rule(): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;"><tr>
    <td height="1" style="border-top:1px solid #3a3327;font-size:0;line-height:0;">&nbsp;</td>
  </tr></table>`;
}
function detailRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:6px 0;color:#6f6653;font-family:${HEAD_FONT};font-size:10px;letter-spacing:2px;text-transform:uppercase;white-space:nowrap;vertical-align:top;">${label}</td>
    <td style="padding:6px 0 6px 14px;color:#cbbd93;font-family:${BODY_FONT};font-size:16px;text-align:right;">${value}</td>
  </tr>`;
}

export interface Email { subject: string; html: string; }

// 1. Petition anointed → the petitioner becomes an initiate. (auto)
export function anointEmail(name: string): Email {
  return {
    subject: "Your petition is answered",
    html: layout(
      moons() +
      heading("You are Anointed") +
      p(`${name || "Seeker"},`) +
      p(`The Council has weighed your petition and found you worthy. You are anointed an <strong style="color:#cbbd93;">initiate</strong> of Le Council du Vin.`) +
      p(`The gate is open to you: the gatherings, the rite of judgement, and the revelation of each moon's champion now await. Enter, and pour with us.`) +
      button(SITE, "Enter the Council"),
      "You have been anointed an initiate of the Council."
    ),
  };
}

// A member's feature request, relayed to the Keiser's inbox.
export function featureRequestEmail(fromName: string, fromEmail: string, text: string): Email {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return {
    subject: `A wish from ${fromName || fromEmail || "a member"}`,
    html: layout(
      moons() +
      heading("A member petitions the builders") +
      p(`<strong style="color:#cbbd93;">${esc(fromName || "Unknown soul")}</strong> (${esc(fromEmail)}) wishes the Council could:`) +
      p(`<em>&ldquo;${esc(text)}&rdquo;</em>`),
      "A feature request from the Council."
    ),
  };
}

// A sleeping seat asks to wake. The ONE word a sleeping hand may send: it
// writes nothing to the Council's records, it only asks. Always to the Keiser.
export function wakeRequestEmail(fromName: string, fromEmail: string, text: string): Email {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return {
    subject: `${fromName || fromEmail || "A sleeping seat"} asks to wake`,
    html: layout(
      moons() +
      heading("A sleeping seat asks to wake") +
      p(`<strong style="color:#cbbd93;">${esc(fromName || "A sleeping soul")}</strong> (${esc(fromEmail)}) asks the Keiser to wake their seat.`) +
      (text ? p(`<em>&ldquo;${esc(text)}&rdquo;</em>`) : "") +
      p(`The waking is yours alone: the council roster, on your profile.`),
      "A sleeping seat asks to wake."
    ),
  };
}

// 2. Initiate elevated → full member. (auto)
export function elevateEmail(name: string): Email {
  return {
    subject: "You are raised to Member of the Council",
    html: layout(
      moons() +
      heading("You are raised to Member") +
      p(`${name || "Initiate"},`) +
      p(`You have stood before the vine and proven true. By the Keiser's decree you are elevated to full <strong style="color:#cbbd93;">member</strong> of Le Council du Vin.`) +
      p(`The Oracle, the Codex, and every rite of the Council are now yours in full. Wear the title well.`) +
      button(SITE, "Enter the Council"),
      "You have been elevated to full member of the Council."
    ),
  };
}

// Petition alert to the Keiser when a new soul applies. (auto)
export function petitionEmail(name: string, email?: string): Email {
  return {
    subject: `A new petition: ${name}`,
    html: layout(
      moons() +
      heading("New Petition") +
      p(`<strong style="color:#cbbd93;">${name}</strong> stands at the gate and petitions the Council${email ? ` <span style="color:#8a7f66;">(${email})</span>` : ""}.`) +
      p(`Weigh the soul, and pass your decree.`) +
      button(`${SITE}/tribunal`, "Judge in the Tribunal"),
      `${name} has petitioned the Council.`
    ),
  };
}

export interface InviteParams {
  number?: string; // roman numeral, e.g. "XLVII"
  theme?: string;
  date?: string; // human readable
  time?: string;
  host?: string;
  venue?: string | null;
}

// 3. New gathering summoned → members. (MANUAL, Keiser-triggered)
export function inviteEmail(gp: InviteParams): Email {
  const details = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 4px;border-top:1px solid #241f18;border-bottom:1px solid #241f18;">
    ${gp.theme ? detailRow("Theme", gp.theme) : ""}
    ${gp.date ? detailRow("When", `${gp.date}${gp.time ? ` &middot; from ${gp.time}` : ""}`) : ""}
    ${gp.host ? detailRow("Host", gp.host) : ""}
  </table>`;
  return {
    subject: `A gathering is summoned${gp.theme ? `: ${gp.theme}` : ""}`,
    html: layout(
      moons() +
      heading(`Gathering${gp.number ? ` <span style="font-family:${HEAD_FONT};font-size:26px;font-weight:600;letter-spacing:2px;">${gp.number}</span>` : ""}`) +
      p(`The Council convenes once more. Bring a bottle true to the theme, cloaked and unmarked, and take your seat among us.`) +
      details +
      button(`${SITE}/convene`, "RSVP · see the details"),
      `A new gathering has been summoned${gp.date ? ` for ${gp.date}` : ""}.`
    ),
  };
}

// Magic-link login email — the HTML to paste into Supabase → Auth → Email
// Templates → Magic Link. Defaults the button to Supabase's {{ .ConfirmationURL }}
// variable; pass a real URL only for previews.
export function magicLinkHtml(url = "{{ .ConfirmationURL }}"): string {
  return layout(
    moons() +
    heading("Enter the Council") +
    p(`A rite of passage has been called in your name. Follow the sigil below to cross the threshold. It is yours alone, and fades within the hour.`) +
    button(url, "Enter"),
    "Your link to enter Le Council du Vin."
  );
}

// 5. The member's natal chart, emailed to their own inbox on request from the
// profile ("Your sky" envelope). Mail clients can't render the interactive
// wheel, so the email carries the big three + the full placement table and a
// button into the Council for the wheel itself.
export interface NatalEmailParams {
  name?: string;
  birthLine?: string; // "5 Dec 1990, 21:40, Cape Town"
  wheelUrl?: string; // hosted PNG of the member's wheel, snapshotted client-side at send time
  sun?: string; // "♐ Sagittarius"
  moon?: string;
  rising?: string;
  rows?: { glyph: string; planet: string; value: string }[]; // value: "♐ Sagittarius 13° · 2nd house"
}
export function natalChartEmail(np: NatalEmailParams): Email {
  const big3 = (np.sun || np.moon || np.rising)
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 16px;"><tr>
        ${([["Sun", np.sun], ["Moon", np.moon], ["Rising", np.rising]] as [string, string | undefined][])
          .filter(([, v]) => v)
          .map(([l, v]) => `<td align="center" width="33%" style="padding:11px 4px;border:1px solid #241f18;">
            <div style="font-family:${HEAD_FONT};font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#6f6653;">${l}</div>
            <div style="font-family:${BODY_FONT};font-size:17px;color:#cbbd93;margin-top:4px;white-space:nowrap;">${v}</div>
          </td>`).join("")}
      </tr></table>`
    : "";
  const rows = (np.rows || []).length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:2px 0 4px;border-top:1px solid #241f18;border-bottom:1px solid #241f18;">
        ${(np.rows || []).map((r) => detailRow(`<span style="font-size:14px;letter-spacing:0;">${r.glyph}</span>&nbsp;&nbsp;${r.planet}`, r.value)).join("")}
      </table>`
    : "";
  return {
    subject: "Your natal chart, drawn from the true sky",
    html: layout(
      moons() +
      heading("Your Natal Chart") +
      p(`${np.name || "Member of the Council"}, this is the sky at your first breath${np.birthLine ? `: ${np.birthLine}` : ""}. Keep it close; it does not change.`) +
      (np.wheelUrl ? rule() + `<img src="${np.wheelUrl}" alt="Your natal wheel" width="310" style="display:block;margin:4px auto 16px;width:310px;max-width:100%;height:auto;">` : "") +
      big3 +
      rows +
      p(`<span style="color:#8a7f66;font-size:13px;font-style:italic;">Whole-sign houses, computed from the true sky. Nothing here is guessed.</span>`) +
      p(`Every placement above holds a longer meaning than a letter can carry. <strong style="color:#cbbd93;">Open your chart in the Council</strong> and tap any row to read what it signifies: the planet, its sign, and the house it keeps.`) +
      button(`${SITE}/profile`, "Read the full chart"),
      "The sky at your first breath, kept in the Council's colours."
    ),
  };
}

// 6. The Foretelling, emailed to the member's own inbox on request. One block
// per omen; the interpretations are the hand-written transit passages.
export interface OmenEntry { glyphs: string; title: string; when: string; body: string }
export interface ForetellingEmailParams {
  name?: string;
  dayLabel?: string; // "Friday 10 July"
  moonLabel?: string; // "14 July to 11 August"
  yearLabel?: string; // "2026"
  day?: OmenEntry[]; // the daily reading
  entries?: OmenEntry[];
  warning?: string; // e.g. Mercury retrograde note
  year?: OmenEntry[];
}
// A gold-ruled section band, echoing the chalice band on the member card.
function sectionBand(title: string, sub?: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0 14px;"><tr>
    <td align="center" style="border-top:1px solid #9c8a5f;border-bottom:1px solid #9c8a5f;padding:9px 6px;">
      <div style="font-family:${HEAD_FONT};font-size:13px;letter-spacing:3px;text-transform:uppercase;color:#cbbd93;">${title}</div>
      ${sub ? `<div style="font-family:'Cormorant Garamond',Georgia,serif;font-style:italic;font-size:13px;color:#8a7f66;margin-top:2px;">${sub}</div>` : ""}
    </td>
  </tr></table>`;
}
function omenBlock(e: OmenEntry): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 10px;"><tr>
    <td style="border:1px solid #241f18;border-radius:10px;padding:11px 14px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="font-family:${BODY_FONT};"><span style="color:#cbbd93;font-size:15px;letter-spacing:2px;">${e.glyphs}</span>&nbsp;&nbsp;<span style="font-family:${HEAD_FONT};font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#9c8a5f;">${e.title}</span></td>
        <td align="right" style="color:#5a554c;font-size:12px;font-family:${BODY_FONT};white-space:nowrap;vertical-align:top;">${e.when}</td>
      </tr></table>
      <div style="font-family:'Cormorant Garamond',Georgia,serif;font-style:italic;font-size:15px;color:#cbc5b7;line-height:1.5;margin-top:5px;">${e.body}</div>
    </td>
  </tr></table>`;
}
// The Reckoning of a gathering, sent to a member's own inbox from the reveal.
export interface ReckoningEmailParams {
  numberRoman?: string;
  theme?: string;
  dateLabel?: string;
  crowned?: { title: string; owner: string; score: number }[];
  ranked?: { rank: string; title: string; owner: string; score: number | null; dq: boolean }[];
  split?: string;
  quotes?: { text: string; cloth: string }[];
  value?: string;
}
export function reckoningEmail(rp: ReckoningEmailParams): Email {
  const esc = (x: string) => x.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const crowned = (rp.crowned || [])
    .map((c) => p(
      `<span style="text-align:center;display:block;">🏆 <strong style="color:#cbbd93;">${esc(c.title)}</strong></span>` +
      `<span style="text-align:center;display:block;color:#9c8a5f;font-size:15px;">borne by <strong style="color:#cbbd93;">${esc(c.owner || "an unclaimed hand")}</strong> · ${c.score.toFixed(1)}</span>`
    ))
    .join("");
  const ranked = (rp.ranked || [])
    .map((r) => `<tr>
      <td style="padding:6px 0;border-bottom:1px solid #241f18;color:#cabfa2;font-family:${BODY_FONT};font-size:15px;">
        <span style="font-family:${HEAD_FONT};font-size:11px;color:#cbbd93;">${esc(r.rank)}</span>&nbsp;&nbsp;${esc(r.title)}${r.owner ? ` · ${esc(r.owner)}` : ""}${r.dq ? ` <span style="color:#7a3038;">· cast out</span>` : ""}
      </td>
      <td align="right" style="padding:6px 0;border-bottom:1px solid #241f18;color:#cbbd93;font-family:${HEAD_FONT};font-size:13px;">${r.dq || r.score == null ? "—" : r.score.toFixed(1)}</td>
    </tr>`).join("");
  const quotes = (rp.quotes || [])
    .map((q) => `<p style="margin:0 0 10px;font-family:'Cormorant Garamond',Georgia,serif;font-style:italic;font-size:16px;color:#cbc5b7;line-height:1.5;">&ldquo;${esc(q.text)}&rdquo; <span style="color:#5a554c;font-size:13px;">· on cloth ${esc(q.cloth)}</span></p>`)
    .join("");
  return {
    subject: `The Reckoning of Gathering ${rp.numberRoman || ""}`.trim(), // the subject still names the rite; only the page's title is bare
    html: layout(
      moons() +
      heading(`Gathering <span style="font-family:${HEAD_FONT};font-size:30px;letter-spacing:0.04em;">${esc(rp.numberRoman || "")}</span>`) +
      p(`<span style="text-align:center;display:block;font-family:'Cormorant Garamond',Georgia,serif;font-style:italic;color:#9c8a5f;">${esc(rp.theme || "")}${rp.dateLabel ? ` · ${esc(rp.dateLabel)}` : ""}</span>`) +
      (crowned ? sectionBand("The Crowning") + crowned : "") +
      (ranked ? sectionBand("As the table ranked them") + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${ranked}</table>` : "") +
      (rp.split ? sectionBand("The split cloth") + p(`⚡ ${esc(rp.split)}`) : "") +
      (quotes ? sectionBand("The table's whispers") + quotes : "") +
      (rp.value ? sectionBand("The ledger") + p(esc(rp.value)) : "") +
      `<p style="margin:18px 0 0;text-align:center;font-family:'Cormorant Garamond',Georgia,serif;font-style:italic;font-size:13px;color:#5a554c;">the vine calculates, it does not flatter</p>`,
      "The reckoning of the Council's latest gathering."
    ),
  };
}

export function foretellingEmail(fp: ForetellingEmailParams): Email {
  const dayEntries = (fp.day || []).map(omenBlock).join("");
  const daySection = dayEntries ? sectionBand("This Day", fp.dayLabel) + dayEntries : "";
  const entries = (fp.entries || []).map(omenBlock).join("");
  const warning = fp.warning
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:2px 0 10px;"><tr>
        <td align="center" style="border:1px solid #7a3038;border-radius:10px;padding:9px 14px;color:#c98a86;font-family:${BODY_FONT};font-size:13.5px;">${fp.warning}</td>
      </tr></table>`
    : "";
  const moonSection = entries
    ? sectionBand("This Moon", fp.moonLabel) + entries + warning
    : "";
  const yearSection = (fp.year || []).length
    ? sectionBand("The Year", fp.yearLabel) + (fp.year || []).map(omenBlock).join("")
    : "";
  const howMade =
    `<span style="font-family:${HEAD_FONT};font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#6f6653;">How this reading is made</span><br>` +
    `The positions of the planets for the month and year ahead are computed by the same astronomical engine as your natal chart, then compared against your own chart. A transit is reported only when a real geometric alignment occurs, with its true dates; moon phases and retrogrades are exact to the day. The words that interpret each alignment are written once, by hand, in the Council's voice, and chosen by the alignment itself, never at random. Nothing is padded to fill a quiet month: a quiet month reads quiet. No astrology API of any kind is consulted: every chart, transit, dasha, and kuta is computed in-house by the Council's own verified engines. That is the whole doctrine.`;
  return {
    subject: `The Foretelling: what this moon intends`,
    html: layout(
      moons() +
      heading("The Foretelling") +
      p(`${fp.name || "Member of the Council"}, this is what the sky intends for you. Computed, never invented.`) +
      daySection +
      moonSection +
      yearSection +
      p(`<span style="color:#8a7f66;font-size:13px;font-style:italic;">The vine calculates, it does not flatter.</span>`) +
      button(`${SITE}/profile`, "Read it in the Council"),
      "What the sky intends for you this moon.",
      howMade
    ),
  };
}

export interface KundliEmailParams {
  name?: string;
  lagna?: string;
  nakshatra?: string;
  navamsa?: string;
  ageTitle?: string; // "The years of Rahu"
  ageDates?: string;
  agePassage?: string;
  nextLine?: string;
  turning?: { lord: string; range: string; now?: boolean }[];
  strength?: string;
  dharma?: string;
  pitfalls?: string;
  marriage?: string;
  yogas?: { name: string; text: string }[];
  muhurtaGood?: string[];
  muhurtaBad?: string[];
}

export function kundliEmail(kp: KundliEmailParams): Email {
  const esc = (x: string) => x.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const rows =
    detailRow("Lagna", esc(kp.lagna || "")) +
    detailRow("Moon's nakshatra", esc(kp.nakshatra || "")) +
    detailRow("Navamsa lagna", esc(kp.navamsa || ""));
  const turning = (kp.turning || [])
    .map((t) => `<tr>
      <td style="padding:5px 0;font-family:${HEAD_FONT};font-size:11px;letter-spacing:2px;color:${t.now ? "#cbbd93" : "#6f6653"};">${esc(t.lord.toUpperCase())}${t.now ? " · NOW" : ""}</td>
      <td align="right" style="padding:5px 0;font-family:'Cormorant Garamond',Georgia,serif;font-style:italic;font-size:14px;color:${t.now ? "#cbbd93" : "#8a7f66"};">${esc(t.range)}</td>
    </tr>`).join("");
  const yogas = (kp.yogas || [])
    .map((y) => p(`<strong style="color:#cbbd93;">${esc(y.name)}</strong>: ${esc(y.text)}`))
    .join("");
  const chips = (list: string[], bright: boolean) =>
    `<p style="margin:0 0 10px;text-align:center;font-family:'Cormorant Garamond',Georgia,serif;font-size:16px;color:${bright ? "#cbbd93" : "#5a554c"};">${list.map(esc).join(" · ")}</p>`;
  const muhurta = (kp.muhurtaGood || []).length
    ? sectionBand("Muhurta · Favourable Hours") +
      p(`<span style="text-align:center;display:block;font-family:'Cormorant Garamond',Georgia,serif;font-style:italic;color:#9c8a5f;">sign, ask, and begin on these days</span>`) +
      chips(kp.muhurtaGood || [], true) +
      ((kp.muhurtaBad || []).length ? p(`<span style="text-align:center;display:block;font-family:${HEAD_FONT};font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#6f6653;">Let pass quietly</span>`) + chips(kp.muhurtaBad || [], false) : "")
    : "";
  const howMade =
    `<span style="font-family:${HEAD_FONT};font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#6f6653;">How this chart is drawn</span><br>` +
    `Positions come from the Council's verified natal engine, shifted by the Lahiri ayanamsa to give the Vedic sky. Rahu and Ketu are the mean lunar node; houses are whole-sign from the Lagna; the Vimshottari dasha is timed from the Moon's nakshatra at birth. Every passage is written once, by hand, and chosen by the chart itself. No astrology API of any kind is consulted: every chart, transit, dasha, and kuta is computed in-house by the Council's own verified engines. That is the whole doctrine.`;
  return {
    subject: "The Kundli: the Vedic sky at your first breath",
    html: layout(
      moons() +
      heading("The Kundli") +
      p(`${esc(kp.name || "Member of the Council")}, this is the Vedic sky at your first breath. Computed, never invented.`) +
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>` +
      (kp.ageTitle ? sectionBand("The age you are living", kp.ageDates) +
        `<p style="margin:0 0 8px;text-align:center;font-family:'Great Vibes',cursive;font-size:26px;color:#cbbd93;">${esc(kp.ageTitle)}</p>` +
        (kp.agePassage ? p(esc(kp.agePassage)) : "") +
        (kp.nextLine ? p(esc(kp.nextLine)) : "") : "") +
      (turning ? sectionBand("The full turning") + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${turning}</table>` : "") +
      ((kp.strength || kp.dharma || kp.pitfalls) ? sectionBand("The pillars and the pits") +
        (kp.strength ? p(`<strong style="color:#cbbd93;">Your strength:</strong> ${esc(kp.strength)}`) : "") +
        (kp.dharma ? p(`<strong style="color:#cbbd93;">Your dharma path:</strong> ${esc(kp.dharma)}`) : "") +
        (kp.pitfalls ? p(`<strong style="color:#cbbd93;">Your pitfalls:</strong> ${esc(kp.pitfalls)}`) : "") : "") +
      muhurta +
      (kp.marriage ? sectionBand("The marriage bond") + p(esc(kp.marriage)) : "") +
      (yogas ? sectionBand("The yogas") + yogas : "") +
      p(`<span style="color:#8a7f66;font-size:13px;font-style:italic;">The vine calculates, it does not flatter.</span>`) +
      button(`${SITE}/profile`, "Read it in the Council"),
      "The Vedic sky at your first breath.",
      howMade
    ),
  };
}

export interface VedicForetellingEmailParams {
  name?: string;
  dayLabel?: string; // "Friday 10 July"
  dayStar?: string; // "Janma tara"
  dayPassage?: string;
  almanac?: { label: string; value: string }[]; // tithi, day lord, nakshatra, yoga, karana
  monthLabel?: string;
  gochara?: { lord: string; line: string; favourable?: boolean }[];
  moonPassage?: string;
  turnings?: { date: string; text: string }[];
  clock?: { lord: string; range: string; now?: boolean }[];
  ironTitle?: string; // "Ashtama Shani" / "Sade Sati"
  ironWhisper?: string;
  ironBody?: string;
  ironNext?: string;
}

export function vedicForetellingEmail(vp: VedicForetellingEmailParams): Email {
  const esc = (x: string) => x.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const almanac = (vp.almanac || [])
    .map((a) => detailRow(esc(a.label), esc(a.value)))
    .join("");
  const daySection = vp.dayStar
    ? sectionBand("The Day's Star", vp.dayLabel) +
      `<p style="margin:0 0 8px;text-align:center;font-family:'Cormorant Garamond',Georgia,serif;font-size:18px;color:#cbbd93;">${esc(vp.dayStar)}</p>` +
      (vp.dayPassage ? p(esc(vp.dayPassage)) : "") +
      (almanac ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${almanac}</table>` : "")
    : "";
  const gochara = (vp.gochara || [])
    .map((g) => `<tr>
      <td style="padding:5px 0;font-family:${HEAD_FONT};font-size:11px;letter-spacing:2px;color:#cbc5b7;">${esc(g.lord.toUpperCase())}</td>
      <td align="right" style="padding:5px 0;font-family:'Cormorant Garamond',Georgia,serif;font-style:italic;font-size:14px;color:${g.favourable ? "#cbbd93" : "#8a7f66"};">${esc(g.line)}</td>
    </tr>`).join("");
  const turnings = (vp.turnings || [])
    .map((t) => `<tr>
      <td valign="baseline" style="padding:6px 12px 6px 0;font-family:${HEAD_FONT};font-size:10.5px;letter-spacing:1px;color:#cbbd93;white-space:nowrap;">${esc(t.date)}</td>
      <td style="padding:6px 0;font-family:${BODY_FONT};font-size:14.5px;color:#cbc5b7;line-height:1.5;">${esc(t.text)}</td>
    </tr>`).join("");
  const clock = (vp.clock || [])
    .map((c) => `<tr>
      <td style="padding:5px 0;font-family:${HEAD_FONT};font-size:11px;letter-spacing:2px;color:${c.now ? "#cbbd93" : "#6f6653"};">${esc(c.lord.toUpperCase())}${c.now ? " · NOW" : ""}</td>
      <td align="right" style="padding:5px 0;font-family:'Cormorant Garamond',Georgia,serif;font-style:italic;font-size:14px;color:${c.now ? "#cbbd93" : "#8a7f66"};">${esc(c.range)}</td>
    </tr>`).join("");
  const iron = vp.ironTitle
    ? sectionBand("The iron passage") +
      `<p style="margin:0 0 4px;text-align:center;font-family:'Great Vibes',cursive;font-size:26px;color:#cbbd93;">${esc(vp.ironTitle)}</p>` +
      (vp.ironWhisper ? `<p style="margin:0 0 10px;text-align:center;font-family:'Cormorant Garamond',Georgia,serif;font-style:italic;font-size:13px;color:#8a7f66;">${esc(vp.ironWhisper)}</p>` : "") +
      (vp.ironBody ? p(esc(vp.ironBody)) : "") +
      (vp.ironNext ? p(esc(vp.ironNext)) : "")
    : "";
  const howMade =
    `<span style="font-family:${HEAD_FONT};font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#6f6653;">How this reading is made</span><br>` +
    `The gochara counts each graha's live sidereal position from the natal Moon, as tradition prescribes; the year's turnings are exact sign entries; the clock within is the Vimshottari's own hand. Every passage is written once, by hand, and chosen by the sky itself. No astrology API of any kind is consulted: every chart, transit, dasha, and kuta is computed in-house by the Council's own verified engines. That is the whole doctrine.`;
  return {
    subject: "The Foretelling: the Vedic sky",
    html: layout(
      moons() +
      heading("The Vedic Sky") +
      p(`${esc(vp.name || "Member of the Council")}, this is what the wandering grahas intend for you. Computed, never invented.`) +
      daySection +
      (gochara ? sectionBand("The wandering sky", vp.monthLabel) + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${gochara}</table>` : "") +
      (vp.moonPassage ? p(esc(vp.moonPassage)) : "") +
      (turnings ? sectionBand("The year's turnings") + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${turnings}</table>` : "") +
      (clock ? sectionBand("The clock within") + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${clock}</table>` : "") +
      iron +
      p(`<span style="color:#8a7f66;font-size:13px;font-style:italic;">The vine calculates, it does not flatter.</span>`) +
      button(`${SITE}/profile`, "Read it in the Council"),
      "What the wandering grahas intend for you.",
      howMade
    ),
  };
}

// 4. Summons before the tribunal (5 disqualifications). (MANUAL, Keiser-triggered)
export function expulsionEmail(name: string, count?: number): Email {
  return {
    subject: "You are summoned before the Tribunal",
    html: layout(
      moons() +
      heading("You are summoned before the Tribunal") +
      p(`${name || "Member"},`) +
      p(`Your offerings have strayed from the theme${count ? ` <strong style="color:#c98a86;">${count}</strong> times` : " once too often"}. The threshold is met.`) +
      p(`The Council will convene to weigh your place among us. Attend the next gathering, and speak in your defense before the vote is cast.`) +
      p(`<span style="color:#8a7f66;font-style:italic;">The vine remembers.</span>`),
      "You are summoned before the Tribunal of the Council."
    ),
  };
}
