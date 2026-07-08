// Keiser-only: set (or create) a member's login password directly.
// For souls who struggle with the gate — hands them a working password;
// they can change it themselves later via "Forgot password".
//
//   SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/set-password.ts martin@rushmore.co.za NewSecretWord123
//
// Creates the auth account if none exists (petition approval only creates the
// members row, not the login), confirms the email so no confirmation mail is
// waited on, and warns if the address has no members row (they would reach the
// gate but be told they are not of the Council).

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import path from "path";

const [email, password] = process.argv.slice(2);

async function main() {
  if (!email || !password) throw new Error("Usage: set-password.ts <email> <new-password>");
  if (password.length < 8) throw new Error("The word must carry at least 8 characters.");

  const env = readFileSync(path.join(__dirname, "..", ".env.local"), "utf8");
  const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(\S+)/)?.[1];
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Need NEXT_PUBLIC_SUPABASE_URL (.env.local) and SUPABASE_SERVICE_ROLE_KEY (env).");
  const db = createClient(url, key, { auth: { persistSession: false } });

  const { data: member } = await db.from("members").select("cult_name,role,active").eq("email", email).maybeSingle();
  if (!member) {
    console.warn(`WARNING: no members row carries ${email} — they could log in but would see "not of the Council". Check the roster email first.`);
  } else {
    console.log(`Member: ${member.cult_name} (${member.role}${member.active ? "" : ", inactive"})`);
  }

  // Find the auth user by email (small club — a few pages at most).
  let userId: string | null = null;
  for (let page = 1; page <= 10 && !userId; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw new Error(error.message);
    userId = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id ?? null;
    if (data.users.length < 100) break;
  }

  if (userId) {
    const { error } = await db.auth.admin.updateUserById(userId, { password });
    if (error) throw new Error(error.message);
    console.log(`Password set for existing account ${email}.`);
  } else {
    const { error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw new Error(error.message);
    console.log(`No login existed for ${email} — account created with the given password (email pre-confirmed).`);
  }
  console.log("They enter with email + this password; suggest they change it via Forgot password once in.");
}

main().catch((e) => { console.error(e.message || e); process.exit(1); });
