import { resolve } from "node:path";

export const dataDir = resolve(process.env.DATA_DIR || "var");
export const release = process.env.RELEASE || "local";
export const runId = process.env.RUN_ID || "manual";
