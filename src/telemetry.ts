import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import * as Sentry from "@sentry/node";
import { dataDir, release } from "./config.ts";

mkdirSync(dataDir, { recursive: true });

Sentry.init({
  dsn: "http://local@127.0.0.1:1/1",
  environment: "lab",
  release,
  integrations: (integrations) =>
    integrations.filter((integration) => integration.name !== "Dedupe"),
  transport: () => ({
    send(envelope) {
      try {
        appendFileSync(join(dataDir, "envelopes.jsonl"), `${JSON.stringify(envelope)}\n`);
        for (const [header, payload] of envelope[1]) {
          if (header.type === "event") {
            appendFileSync(join(dataDir, "events.jsonl"), `${JSON.stringify(payload)}\n`);
          }
        }
        return Promise.resolve({ statusCode: 200 });
      } catch (error) {
        return Promise.reject(error);
      }
    },
    flush: () => Promise.resolve(true),
  }),
});

export { Sentry };

export function writeRequest(record: Record<string, unknown>) {
  appendFileSync(join(dataDir, "requests.jsonl"), `${JSON.stringify(record)}\n`);
}
