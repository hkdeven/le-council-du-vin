"use client";

// /member/<name>: a member's card at a human address (/member/dominik,
// /member/keiser). The card opens the moment the roster is read; closing it
// returns to wherever the visitor came from, or to Convene when they came
// from outside. A shared given name offers a choice; an unknown name says so.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { seedMembers } from "@/lib/seed";
import { loadMembers, rosterOrder } from "@/lib/members";
import { findBySlug, slugFor } from "@/lib/memberSlug";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";
import MemberCard from "@/components/MemberCard";
import Loading from "@/components/Loading";
import type { Member } from "@/lib/types";

export default function SoulPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const { mode, loading, signedIn } = useAuth();
  // null until the roster has actually answered: the guard waits on the
  // fetch, never on "no members yet" (see the rite load race).
  const [roster, setRoster] = useState<Member[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (mode === "live" && supabase && signedIn) {
      supabase.from("members").select("*").then(({ data, error }) => {
        if (error) setFailed(error.message);
        else setRoster((data || []) as Member[]);
      });
    } else if (mode !== "live") {
      setRoster(loadMembers().length ? loadMembers() : seedMembers);
    }
  }, [mode, loading, signedIn]);

  const leave = () => {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.replace("/convene");
  };

  if (failed) return <p className="whisper" style={{ textAlign: "center", padding: "70px 0" }}>The register would not open: {failed}</p>;
  if (!roster) return <Loading text="Seeking them in the register…" />;

  const found = findBySlug(roster, String(slug || ""));

  if (found.length === 1) {
    return (
      <div style={{ textAlign: "center", padding: "70px 0" }}>
        <MemberCard member={found[0]} size={72} initiallyOpen onClosed={leave} />
        <p className="whisper" style={{ fontSize: 14, marginTop: 14 }}>{found[0].cult_name}</p>
      </div>
    );
  }

  return (
    <section style={{ textAlign: "center", padding: "50px 0" }}>
      {found.length === 0 ? (
        <>
          <div className="disp" style={{ fontSize: 19 }}>No such soul</div>
          <p className="whisper" style={{ fontSize: 14 }}>Nobody in the register answers to &ldquo;{slug}&rdquo;.</p>
        </>
      ) : (
        <>
          <div className="disp" style={{ fontSize: 19 }}>More than one answers</div>
          <p className="whisper" style={{ fontSize: 14 }}>Which {slug} did you mean?</p>
          <ul style={{ listStyle: "none", padding: 0, margin: "18px 0 0" }}>
            {rosterOrder(found).map((m) => (
              <li key={m.id} style={{ margin: "8px 0" }}>
                <Link href={`/member/${slugFor(m, roster)}`} style={{ color: "var(--gold)" }}>{m.cult_name}</Link>
              </li>
            ))}
          </ul>
        </>
      )}
      <p style={{ marginTop: 26 }}><Link href="/convene" style={{ color: "var(--gold)" }}>Back to the council</Link></p>
    </section>
  );
}
