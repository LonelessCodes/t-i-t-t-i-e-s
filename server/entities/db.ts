export const kv = await Deno.openKv("./data/database.sqlite");

// Enable graceful stop
globalThis.addEventListener("unload", () => {
  kv.close();
});
