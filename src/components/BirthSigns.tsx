"use client";

// The stars that made them: element, sun, moon, ascendant, Shengxiao, Wu
// Xing, day-master, life path, Venus sign, birth arcana and day sign. Once
// the foot of the member card; now the first part of the Wheel in the
// Heavens, above the temperament.

import { sunSign, moonSign, ascendant, shengxiao, wuXing, venusSign, dayMaster, lifePath, birthArcana, tzolkin, VENUS_IN } from "@/lib/astrology";
import Tip from "./Tip";
import type { CardMember } from "./MemberCard";

const ELEMENT_TIP = "This defines the fundamental energy, temperament, and personality traits of each sign.";
const SUN_TIP = 'Core identity, ego, and life purpose (what most call their "star sign").';
const MOON_TIP = "Inner emotions, subconscious, and private self.";
const ASC_TIP = "The sign rising on the eastern horizon at the exact birth time and place: outward personality and how others first perceive them.";
const SX_TIP = "The Chinese zodiac: a 12-year cycle, each year a specific animal.";
const WX_TIP = "The five elements govern deeper personality, destiny, and how one moves through the world.";
const DM_TIP = "The Bazi day-master: the element of the day of birth in the Chinese sexagenary cycle, held to be the truest self.";
const LP_TIP = "Numerology: the whole birth date reduced to its ruling number.";
const VENUS_TIP = "Venus, the planet of taste, pleasure, and desire: how they savour.";
const ARC_TIP = "The tarot birth card: the Major Arcana card hidden in the digits of the birth date. It names the archetype a soul carries for life, the lesson and power that keep returning.";
const TZ_TIP = "The Tzolk'in, the Maya sacred round of 260 days: thirteen tones crossed with twenty day signs. The day sign names the face a soul wears; the tone, its rhythm.";

export function Row({ label, tip, value, valueTip }: { label: string; tip: string; value: string; valueTip?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "5px 0" }}>
      <span className="eyebrow" style={{ display: "inline-flex", alignItems: "center", fontSize: 10 }}>{label}<Tip text={tip} align="left" /></span>
      <span style={{ display: "inline-flex", alignItems: "center", color: "var(--gold2)", fontFamily: "'Cormorant Garamond', serif", fontSize: 16 }}>{value}{valueTip && <Tip text={valueTip} />}</span>
    </div>
  );
}

export default function BirthSigns({ member, isSelf }: { member: CardMember; isSelf?: boolean }) {
  const dob = member.date_of_birth || "";
  const tob = member.time_of_birth || "";
  const tz = member.birth_tz || undefined;
  if (!dob) return <p className="whisper" style={{ fontSize: 14, margin: "6px 0" }}>The stars that made {isSelf ? "you" : "them"} are unrecorded.</p>;
  const sun = sunSign(dob, tob || undefined, tz);
  const moon = moonSign(dob, tob || undefined, tz);
  const rising = ascendant(dob, tob || undefined, tz, member.birth_lat, member.birth_lon);
  const animal = shengxiao(dob);
  const wx = wuXing(dob);
  const venus = venusSign(dob, tob || undefined, tz);
  const dm = dayMaster(dob);
  const lp = lifePath(dob);
  const arc = birthArcana(dob);
  const daySign = tzolkin(dob);
  return (
    <div style={{ textAlign: "left" }}>
      <Row label="Element" tip={ELEMENT_TIP} value={sun?.element || "-"} />
      <Row label="Sun sign" tip={SUN_TIP} value={sun ? `${sun.symbol} ${sun.name}` : "-"} />
      <Row label="Moon sign" tip={MOON_TIP} value={moon ? `${moon.symbol} ${moon.name}` : "-"} />
      <Row label="Ascendant" tip={ASC_TIP} value={rising ? `${rising.symbol} ${rising.name}` : !tob ? "unknown hour" : "unknown place"} />
      <Row label="Shengxiao" tip={SX_TIP} value={animal ? `${animal.symbol} ${animal.name}` : "-"} />
      <Row label="Wu Xing" tip={WX_TIP} value={wx ? `${wx.symbol} ${wx.name}` : "-"} valueTip={wx?.meaning} />
      <Row label="Day-master" tip={DM_TIP} value={dm ? `${dm.hanzi} ${dm.polarity} ${dm.element}` : "-"} valueTip={dm?.meaning} />
      <Row label="Life path" tip={LP_TIP} value={lp ? String(lp.number) : "-"} valueTip={lp?.meaning} />
      <Row label="Venus sign" tip={VENUS_TIP} value={venus ? `${venus.symbol} ${venus.name}` : "-"} valueTip={venus ? VENUS_IN[venus.name] : undefined} />
      <Row label="Birth arcana" tip={ARC_TIP} value={arc ? arc.name : "-"} valueTip={arc?.meaning} />
      <Row label="Day sign" tip={TZ_TIP} value={daySign ? `${daySign.tone} ${daySign.sign}` : "-"} valueTip={daySign ? `${daySign.meaning} ${daySign.toneMeaning}` : undefined} />
    </div>
  );
}
