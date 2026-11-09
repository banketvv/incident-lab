import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { dataDir } from "../src/config.ts";

try {
  const content = await readFile(join(dataDir, "events.jsonl"), "utf8");
  for (const line of content.split("\n")) {
    if (!line) continue;
    const event = JSON.parse(line);
    if (process.env.FILTER_RUN_ID && event.tags?.run_id !== process.env.FILTER_RUN_ID) continue;
    if (process.env.FILTER_RELEASE && event.release !== process.env.FILTER_RELEASE) continue;
    console.log(JSON.stringify(event));
  }
} catch (error) {
  if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
}
