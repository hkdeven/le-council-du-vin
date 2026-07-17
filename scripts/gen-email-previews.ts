import { writeFileSync, mkdirSync, readFileSync } from "fs";
import { anointEmail, elevateEmail, inviteEmail, expulsionEmail, magicLinkHtml, petitionEmail, natalChartEmail, foretellingEmail, kundliEmail, vedicForetellingEmail, reckoningEmail, wakeRequestEmail } from "../src/lib/emailTemplates";

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
  dayLabel: "Friday 10 July",
  day: [
    { glyphs: "☽", title: "Moon in ♉ Taurus · your 7th house", when: "today", body: "The Moon crosses your house of partners today: company over solitude. Share the bottle you were saving." },
    { glyphs: "☿ ⚹ ☽", title: "Mercury sextiles your Moon", when: "today", body: "Talking, asking, and negotiating all run smoothly today." },
    { glyphs: "☿ ℞", title: "Mercury retrograde", when: "today", body: "Double-check plans, messages, and purchases, and allow for small delays." },
  ],
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
// The Heavens' two new emails, previewed with the Keiser's REAL chart.
write("9-kundli.html", kundliEmail({
  name: "The Keiser",
  lagna: "Kanya (Virgo) · 8.7°",
  nakshatra: "Uttara Phalguni · pada 1",
  navamsa: "Meena (D9)",
  ageTitle: "The years of Rahu",
  ageDates: "December 2010 to December 2028 · tempered by Chandra until December 2027",
  agePassage: "Rahu years bring hunger: ambition beyond the map, unconventional roads, foreign influences and material growth, with a standing warning against shortcuts and overreach. Within it, the Moon's sub-period turns the tide inward: home, feeling, and belonging steer the bigger machinery.",
  nextLine: "Next: the years of Guru from December 2028, an age of expansion, teachers, and fortune earned through generosity.",
  turning: [
    { lord: "Sun", range: "1988 to 1993" }, { lord: "Moon", range: "1993 to 2003" },
    { lord: "Mars", range: "2003 to 2010" }, { lord: "Rahu", range: "2010 to 2028", now: true },
    { lord: "Jupiter", range: "2028 to 2044" }, { lord: "Saturn", range: "2044 to 2063" },
    { lord: "Mercury", range: "2063 to 2080" },
  ],
  strength: "Budha, lord of your lagna, stands with Surya in the 2nd: a mind that earns; words and judgement are the estate. Guru in the 9th blesses the house of fortune from its own element.",
  dharma: "the 10th carries Mithuna, ruled by that same Budha: work of language, trade, and connection. The path rewards the broker of understanding, not the lone hand.",
  pitfalls: "Chandra in the 12th with Ketu: feeling retreats when it should speak, and solitude flatters you more than it feeds you. Rahu in the 6th makes rivals of habits before people.",
  marriage: "The 7th carries Meena, its lord Guru seated in the house of fortune: a partnership of belief and growth. Shukra in the lagna gives charm that opens doors; the work is staying once inside. The navamsa rises in Meena: the bond softens you.",
  yogas: [
    { name: "Gajakesari", text: "Guru stands in a kendra from your Chandra: dignity that compounds, a name that outlives its bearer." },
    { name: "Budhaditya", text: "Surya and Budha share a sign: intellect lit from within, sharpest when speaking for something larger than itself." },
  ],
  muhurtaGood: ["Sat 11 July", "Wed 15 July", "Fri 17 July"],
  muhurtaBad: ["Sun 12 July", "Tue 14 July"],
}).html);
write("10-vedic-foretelling.html", vedicForetellingEmail({
  name: "The Keiser",
  dayLabel: "Friday 10 July",
  dayStar: "Janma tara",
  dayPassage: "The Moon walks Krittika today, your own birth star's count returned to one. A Janma day is tender rather than hostile: good for rest, kin, and finishing, poor for launching. Begin nothing new; tend what already grows.",
  almanac: [
    { label: "Tithi", value: "Krishna Ekadashi" },
    { label: "Day lord", value: "Shukra (Friday)" },
    { label: "Nakshatra", value: "Krittika" },
    { label: "Yoga", value: "Shula" },
    { label: "Karana", value: "Bava" },
  ],
  monthLabel: "July 2026",
  gochara: [
    { lord: "Shukra", line: "over your Moon · sweetens the month", favourable: true },
    { lord: "Surya", line: "11th · gains and allies", favourable: true },
    { lord: "Budha", line: "11th · profitable talk", favourable: true },
    { lord: "Mangala", line: "10th · heavy hands at work" },
    { lord: "Guru", line: "12th · generous spending" },
    { lord: "Shani", line: "8th · the eighth passage" },
  ],
  moonPassage: "Shukra crosses your own Moon this month while Surya and Budha stand in the house of gains: company, taste, and well-chosen words earn more than force. Guru in the twelfth opens the purse; let it open for what feeds you.",
  turnings: [
    { date: "31 OCT 2026", text: "Guru crosses onto your Moon: the great blessing settles over you. Growth, favour, and honest luck, with a winter retreat from January to June before it returns for good." },
    { date: "6 DEC 2026", text: "Rahu slides into your 6th: the hunger turns on rivals and habits. A good axis for winning; watch what you pick fights with." },
    { date: "5 JUN 2027", text: "Shani releases the eighth: the iron passage ends, and old accounts close." },
  ],
  clock: [
    { lord: "Chandra", range: "until 17 July", now: true },
    { lord: "Mangala", range: "17 July to 18 August" },
    { lord: "Rahu", range: "18 August to 8 November" },
    { lord: "Guru", range: "8 November to 20 January" },
    { lord: "Shani", range: "20 January to 16 April" },
    { lord: "Budha", range: "16 April to 3 July 2027" },
  ],
  ironTitle: "Ashtama Shani",
  ironWhisper: "Shani eighth from your Moon · until 5 June 2027",
  ironBody: "Saturn crosses the eighth from your Moon: the deep house. Old accounts surface to be settled, and what is hidden asks to be faced. Not a wound, a reckoning; travel light and keep your word extra carefully until it passes.",
  ironNext: "The Sade Sati itself, Saturn's seven and a half years astride your Moon, does not begin until July 2034, and releases you in late 2041. You will be warned here when it approaches.",
}).html);

write("5-magiclink.html", magicLinkHtml("https://lecouncilduvin.co.za/#example-link"));

// The file to paste into Supabase keeps the hosted image URLs and the real variable.
writeFileSync("public/email-previews/5-magiclink-for-supabase.html", magicLinkHtml());

console.log("wrote previews (incl. 9-kundli, 10-vedic-foretelling) to public/email-previews/");

// The Reckoning: what the reveal sends on the night, and what a past night in
// the codex now sends months later ("Email this to me" on any annal).
write("10-reckoning.html", reckoningEmail({
  numberRoman: "XVI",
  theme: "Greyton · Overberg Wines",
  dateLabel: "6 June 2026",
  crowned: [{ title: "Lismore Estate Syrah 2021", owner: "Seer Matthew", score: 8.4 }],
  ranked: [
    { rank: "II", title: "Barton Chardonnay 2022", owner: "The Keiser", score: 7.9, dq: false },
    { rank: "III", title: "Sumaridge Pinot Noir 2021", owner: "Priestess Larissa", score: 7.4, dq: false },
    { rank: "IV", title: "Luddite Shiraz 2019", owner: "Adept Wernardt", score: 6.8, dq: false },
    { rank: "V", title: "Beaumont Hope Marguerite", owner: "Elder Martin", score: 6.1, dq: false },
    { rank: "✕", title: "A chilled Pinotage", owner: "Great Scott", score: null, dq: true },
  ],
  split: "Luddite Shiraz 2019 divided the table, 3 to 9",
  quotes: [
    { text: "Smoke, and something the fire left behind.", cloth: "I" },
    { text: "It argues with the food and wins.", cloth: "III" },
  ],
  value: "Best value of the night: Sumaridge Pinot Noir 2021, borne by Priestess Larissa, at R210 · 3.5 points per hundred rand.",
}).html);

// The one word a sleeping seat may send.
write("11-wake.html", wakeRequestEmail("Elder Martin", "martin@nightvine.com", "I have been away, not absent. Let me return.").html);
