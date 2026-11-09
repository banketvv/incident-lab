import { rm } from "node:fs/promises";
import { join } from "node:path";
import { dataDir } from "../src/config.ts";

for (const file of [
  "shop.sqlite",
  "shop.sqlite-shm",
  "shop.sqlite-wal",
  "events.jsonl",
  "envelopes.jsonl",
  "requests.jsonl",
]) {
  await rm(join(dataDir, file), { force: true });
}
