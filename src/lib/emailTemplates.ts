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

function layout(inner: string, preheader = ""): string {
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
