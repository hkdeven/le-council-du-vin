import { writeFileSync, mkdirSync, readFileSync } from "fs";
import { anointEmail, elevateEmail, inviteEmail, expulsionEmail, magicLinkHtml, petitionEmail } from "../src/lib/emailTemplates";

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
write("5-magiclink.html", magicLinkHtml("https://lecouncilduvin.co.za/#example-link"));

// The file to paste into Supabase keeps the hosted image URLs and the real variable.
writeFileSync("public/email-previews/5-magiclink-for-supabase.html", magicLinkHtml());

console.log("wrote 5 previews + supabase template to public/email-previews/");
