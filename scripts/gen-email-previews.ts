import { writeFileSync, mkdirSync, readFileSync } from "fs";
import { anointEmail, elevateEmail, inviteEmail, expulsionEmail, magicLinkHtml, petitionEmail, natalChartEmail, foretellingEmail } from "../src/lib/emailTemplates";

mkdirSync("public/email-previews", { recursive: true });

// The real emails reference images on the live domain. For local PROOFING the
// moon strip isn't deployed yet, so inline the hosted images as data URIs in the
// preview files only — this way opening them offline shows the true design.
const dataUri = (path: string) => `data:image/png;base64,${readFileSync(path).toString("base64")}`;
const LOGO_URI = dataUri("public/black-gold-full-logo.png");
const MOON_URI = dataUri("public/email-moons.png");
const inline = (html: string) =>
  html
    .split("https://lecouncilduvin.co.za/black-gold-full-logo.png").join(LOGO_URI)
    .split("https://lecouncilduvin.co.za/email-moons.png").join(MOON_URI);

const write = (file: string, html: string) => writeFileSync(`public/email-previews/${file}`, inline(html));

write("1-anoint.html", anointEmail("Priestess Larissa").html);
write("2-elevate.html", elevateEmail("Magus Dominik").html);
write("3-invite.html", inviteEmail({ number: "XLVIII", theme: "Rhône blends of the old world", date: "Saturday 26 July", time: "19:00", host: "Seer Matthew" }).html);
write("4-expulsion.html", expulsionEmail("Scribe Scott", 5).html);
write("6-petition.html", petitionEmail("Neophyte Testerson", "tester@vessel.com").html);
write("7-natal-chart.html", natalChartEmail({
  name: "Priestess Larissa",
  birthLine: "5 Dec 1990, 21:40, Cape Town",
  // Preview only: inlined. In the app, the wheel is snapshotted client-side at
  // send time, uploaded to Storage, and this becomes its hosted URL.
  wheelUrl: dataUri("public/email-previews/sample-wheel.png"),
  sun: "♐ Sagittarius",
  moon: "♋ Cancer",
  rising: "♏ Scorpio",
  rows: [
    { glyph: "☉", planet: "Sun", value: "♐ Sagittarius 13° · 2nd house" },
    { glyph: "☽", planet: "Moon", value: "♋ Cancer 13° · 9th house" },
    { glyph: "☿", planet: "Mercury", value: "♐ Sagittarius 25° · 2nd house" },
    { glyph: "♀", planet: "Venus", value: "♏ Scorpio 7° · 1st house" },
    { glyph: "♂", planet: "Mars", value: "♊ Gemini 13° · 8th house" },
    { glyph: "♃", planet: "Jupiter", value: "♌ Leo 7° · 10th house" },
    { glyph: "♄", planet: "Saturn", value: "♑ Capricorn 18° · 3rd house" },
    { glyph: "♅", planet: "Uranus", value: "♑ Capricorn 22° · 3rd house" },
    { glyph: "♆", planet: "Neptune", value: "♑ Capricorn 8° · 3rd house" },
    { glyph: "♇", planet: "Pluto", value: "♏ Scorpio 12° · 1st house" },
  ],
}).html);
write("8-foretelling.html", foretellingEmail({
  name: "Priestess Larissa",
  moonLabel: "new moon to new moon &middot; 14 July to 11 August",
  yearLabel: "2026",
  entries: [
    { glyphs: "🌑", title: "New moon · ♋ Cancer · your 9th house", when: "14 July", body: "A seed planted among far places and higher learning: plan the pilgrimage, book the tasting." },
    { glyphs: "♃ △ ☉", title: "Jupiter trines your Sun", when: "9 to 31 July", body: "Fortune leans toward you. Accept the second glass, and the second chance." },
    { glyphs: "♄ □ ☽", title: "Saturn squares your Moon", when: "all month", body: "The vine tests your patience. Pour slowly, speak late." },
    { glyphs: "🌕", title: "Full moon · ♒ Aquarius · your 4th house", when: "29 July", body: "It rises over home and hearth: host, gather, restore." },
  ],
  warning: "Mercury retrograde, 18 July to 11 August: reread the label before you buy.",
  year: [
    { glyphs: "7", title: "Personal year", when: "2026", body: "The seeker's year: study, cellar, deepen. Buy to keep, not to open." },
    { glyphs: "馬", title: "Year of the Fire Horse", when: "from 17 Feb", body: "For a Horse, your own year: guard the flame, do not gallop at every invitation." },
    { glyphs: "♅ → 9th", title: "Uranus enters your 9th house", when: "May", body: "The far vineyard calls. Travel for wine, and let one strange bottle change your mind." },
  ],
}).html);
write("5-magiclink.html", magicLinkHtml("https://lecouncilduvin.co.za/#example-link"));

// The file to paste into Supabase keeps the hosted image URLs and the real variable.
writeFileSync("public/email-previews/5-magiclink-for-supabase.html", magicLinkHtml());

console.log("wrote 5 previews + supabase template to public/email-previews/");
