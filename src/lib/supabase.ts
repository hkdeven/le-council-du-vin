import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { assertWrite, assertRpc, assertBucketWrite } from "./writeLock";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Every mutating verb on a table builder. Reads (select) pass straight through.
const MUTATORS = new Set(["insert", "update", "upsert", "delete"]);
// Every mutating verb on a storage bucket.
const BUCKET_MUTATORS = new Set(["upload", "uploadToSignedUrl", "update", "move", "copy", "remove", "createSignedUploadUrl"]);

// Bind a member off the raw target, so the SDK's own `this` is never the proxy.
const raw = (target: object, prop: string | symbol) => {
  const v = (target as Record<string | symbol, unknown>)[prop];
  return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(target) : v;
};

// The sleeping seal, at the only chokepoint that catches everything: the client
// itself. Most live writes go straight from a component to supabase.from(...),
// never touching the data libs, so guarding the libs alone left the seal full
// of holes (an audit found sixteen). Wrapping the client seals every one of
// them at once, and every surface built after this. See src/lib/writeLock.ts.
// This is the courtesy lock; supabase/policies.sql is the enforcement.
function sealed(client: SupabaseClient): SupabaseClient {
  return new Proxy(client, {
    get(target, prop, receiver) {
      if (prop === "from") {
        return (table: string) =>
          new Proxy(target.from(table), {
            get(qb, qProp) {
              if (typeof qProp === "string" && MUTATORS.has(qProp)) {
                return (...args: unknown[]) => {
                  assertWrite();
                  return (raw(qb, qProp) as (...a: unknown[]) => unknown)(...args);
                };
              }
              return raw(qb, qProp);
            },
          });
      }
      if (prop === "rpc") {
        return (fn: string, ...args: unknown[]) => {
          assertRpc(fn);
          return (target.rpc as unknown as (...a: unknown[]) => unknown)(fn, ...args);
        };
      }
      if (prop === "storage") {
        return new Proxy(target.storage, {
          get(store, sProp) {
            if (sProp === "from") {
              return (bucket: string) =>
                new Proxy(store.from(bucket), {
                  get(api, aProp) {
                    if (typeof aProp === "string" && BUCKET_MUTATORS.has(aProp)) {
                      return (...args: unknown[]) => {
                        assertBucketWrite(bucket);
                        return (raw(api, aProp) as (...a: unknown[]) => unknown)(...args);
                      };
                    }
                    return raw(api, aProp);
                  },
                });
            }
            return raw(store, sProp);
          },
        });
      }
      // auth and everything else pass through untouched: a sleeping soul must
      // still be able to sign in and change their own password.
      return Reflect.get(target, prop, receiver);
    },
  });
}

// The app runs in demo mode (seeded data, no writes) until these are set, so we
// don't throw on missing env — we expose a null client and let the data layer
// fall back. Once Supabase is provisioned, filling .env.local lights it up.
export const supabase: SupabaseClient | null =
  url && anon ? sealed(createClient(url, anon)) : null;

export const isLive = Boolean(supabase);

// The login wall is a separate switch from "is Supabase connected". With Supabase
// wired but this off, the app stays open (navigable, role switcher) while still
// able to read/write data. Set NEXT_PUBLIC_ENFORCE_LOGIN=true to turn the wall on.
export const enforceLogin = process.env.NEXT_PUBLIC_ENFORCE_LOGIN === "true";
