// Demo-mode proof: the pre-night offering form (saveOffering) never touches a
// claim, and never asks for one. Uses a localStorage shim.
const store = new Map<string, string>();
(globalThis as any).window = globalThis;
(globalThis as any).localStorage = {
  getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); },
  removeItem: (k: string) => { store.delete(k); }, key: (i: number) => [...store.keys()][i] ?? null, get length() { return store.size; },
};
(async () => {
  const { saveOffering, claimCloth, fetchOffering, fetchAllOfferings } = await import("../src/lib/bottles");
  let ok = 0, bad = 0;
  const check = (l: string, c: boolean) => { c ? ok++ : bad++; console.log(`${c ? "PASS" : "FAIL"}  ${l}`); };
  await saveOffering("g", "m1", { title: "Meerlust", price: 350, varietals: ["Cabernet"] });
  check("offering saved with no cloth", (await fetchOffering("g", "m1"))?.cloth === null);
  await claimCloth("g", "m1", 2);
  check("claim lands (cloth 2)", (await fetchOffering("g", "m1"))?.cloth === 2);
  await saveOffering("g", "m1", { title: "Meerlust 2019", price: 360, varietals: ["Cabernet"] });
  const after = await fetchOffering("g", "m1");
  check("re-saving the wine from the form keeps the claim", after?.cloth === 2 && after?.title === "Meerlust 2019");
  await claimCloth("g", "m2", 1);
  const all = await fetchAllOfferings("g");
  check("a soul with no logged wine still appears with their claim", all["m2"]?.cloth === 1 && all["m2"]?.title === "");
  check("the roll of offerings carries both claims", all["m1"]?.cloth === 2);
  await claimCloth("g", "m1", null);
  check("release clears the claim, keeps the wine", (await fetchOffering("g", "m1"))?.cloth === null && (await fetchOffering("g", "m1"))?.title === "Meerlust 2019");
  console.log(`${ok} passed, ${bad} failed`); if (bad) process.exit(1);
})();
