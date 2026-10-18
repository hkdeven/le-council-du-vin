// Which night the reveal shows, and for how long.
//
// The fault this guards: pickCurrent answers "which night are we working
// towards", so the moment a new gathering was convened the reveal followed
// the new one and the Reckoning just held became unreachable, days inside
// the week it is promised for.
//
//   npx tsx scripts/verify-reveal-window.ts

import { pickReveal, pickCurrent, revealWindowClosed, REVEAL_WINDOW_DAYS } from "../src/lib/gatherings";
import type { Gathering } from "../src/lib/types";

let pass = 0, fail = 0;
const check = (label: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` : ${detail}` : ""}`);
  ok ? pass++ : fail++;
};

const NOW = new Date("2026-10-18T12:00:00Z").getTime();
const day = (offset: number) => new Date(NOW + offset * 86400000).toISOString().slice(0, 10);

const night = (id: string, date: string, number = 1): Gathering => ({
  id, number, moon_label: "", theme_title: "A theme", gather_date: date,
  status: "upcoming", wine_count: 6,
} as Gathering);

// Gatherings are held sorted by date, as every fetch returns them.
const sorted = (...gs: Gathering[]) => [...gs].sort((a, b) => a.gather_date.localeCompare(b.gather_date));

// ------------------------------------------------------------ the window

check(`the window is ${REVEAL_WINDOW_DAYS} days`, REVEAL_WINDOW_DAYS === 7);
check("the night itself is open", !revealWindowClosed(night("a", day(0)), NOW));
check("a night six days ago is open", !revealWindowClosed(night("a", day(-6)), NOW));
check("a night seven days ago is open", !revealWindowClosed(night("a", day(-7)), NOW));
check("a night eight days ago is shut", revealWindowClosed(night("a", day(-8)), NOW));
check("a night with no date is never shut", !revealWindowClosed(night("a", "") as Gathering, NOW));

// ------------------------------------------- the night a new one is convened

{
  // THE REPORTED FAULT, exactly: last week's night, and a new gathering
  // convened for next month.
  const last = night("last", day(-3), 19);
  const next = night("next", day(+20), 20);
  const all = sorted(last, next);
  check("pickCurrent follows the night ahead", pickCurrent(all)?.id === "next");
  check("the reveal stays on the night just held", pickReveal(all, NOW)?.id === "last");
}

{
  // Once the week has run out, the reveal lets go and follows the calendar
  // again; the codex keeps the record either way.
  const old = night("old", day(-9), 19);
  const next = night("next", day(+20), 20);
  const all = sorted(old, next);
  check("a lapsed night is released", pickReveal(all, NOW)?.id === "next");
  check("and its own window agrees", revealWindowClosed(old, NOW));
}

{
  // On the night itself nothing changes: tonight is both the current night
  // and the one to reveal.
  const tonight = night("tonight", day(0), 20);
  const all = sorted(night("old", day(-40), 19), tonight);
  check("tonight is the night revealed", pickReveal(all, NOW)?.id === "tonight");
  check("and pickCurrent agrees", pickCurrent(all)?.id === "tonight");
}

{
  // Two nights still inside their windows: the later one wins.
  const all = sorted(night("older", day(-6), 18), night("newer", day(-1), 19));
  check("the most recent open night is shown", pickReveal(all, NOW)?.id === "newer");
}

{
  // Nothing has happened yet: the reveal follows the only night there is,
  // and shows its sealed panel, exactly as before.
  const all = [night("first", day(+5), 1)];
  check("with no night yet held, the reveal follows the coming one", pickReveal(all, NOW)?.id === "first");
  check("an empty calendar reveals nothing", pickReveal([], NOW) === null);
}

{
  // Every night long past: the last one is still what resolves, as it always
  // did, so the page explains itself rather than going blank.
  const all = sorted(night("a", day(-90), 1), night("b", day(-60), 2));
  check("all nights lapsed falls back to the most recent", pickReveal(all, NOW)?.id === "b");
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
