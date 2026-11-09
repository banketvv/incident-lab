import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";

let child: ChildProcess;
let dir: string;
let base: string;
let logs = "";

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "incident-lab-test-"));
  child = spawn(process.execPath, ["src/server.ts"], {
    env: {
      ...process.env,
      DATA_DIR: dir,
      PORT: "0",
      HOST: "127.0.0.1",
      RELEASE: "test-sha",
      RUN_ID: "test-run",
      ENABLE_TEST_ERROR: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stderr?.on("data", (chunk) => {
    logs += chunk.toString();
  });
  const startup = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Server startup timed out: ${logs}`)), 10000);
    child.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`Server exited ${code}: ${logs}`));
    });
    child.stdout?.on("data", (chunk) => {
      for (const line of chunk.toString().trim().split("\n")) {
        const message = JSON.parse(line);
        if (message.listening) {
          base = `http://127.0.0.1:${message.listening.port}`;
          clearTimeout(timer);
          resolve();
        }
      }
    });
  });
  await startup;
});

afterAll(async () => {
  if (child && child.exitCode === null) {
    const stopped = once(child, "exit");
    child.kill("SIGTERM");
    await stopped;
  }
  if (dir) await rm(dir, { recursive: true, force: true });
});

describe("running application", () => {
  test("serves the interface and identifies the running release", async () => {
    const page = await fetch(`${base}/`);
    expect(await page.text()).toContain("Магазин инженера");
    const response = await fetch(`${base}/health`);
    expect(await response.json()).toEqual({ status: "ok", release: "test-sha", runId: "test-run" });
    expect(response.headers.get("x-release")).toBe("test-sha");
  });

  test("returns active catalog products and a current cart", async () => {
    const catalog = await fetch(`${base}/api/products`).then((r) => r.json());
    expect(catalog.products).toHaveLength(3);
    const response = await fetch(`${base}/api/cart`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ total: 240000 });
  });

  test("records actual SDK exceptions and successful traffic independently", async () => {
    const response = await fetch(`${base}/__test__/error`, {
      headers: { "x-run-id": "capture-test" },
    });
    expect(response.status).toBe(500);
    const result = await response.json();
    const events = (await readFile(join(dir, "events.jsonl"), "utf8"))
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    const event = events.find((item) => item.event_id === result.eventId);
    expect(event).toMatchObject({
      release: "test-sha",
      tags: { run_id: "capture-test", route: "/__test__/error" },
    });
    expect(event.exception.values.at(-1).stacktrace.frames.length).toBeGreaterThan(0);
    expect(event.breadcrumbs.length).toBeGreaterThan(0);
    const requests = await readFile(join(dir, "requests.jsonl"), "utf8");
    expect(requests).toContain('"status":200');
    await expect
      .poll(
        async () =>
          (await readFile(join(dir, "requests.jsonl"), "utf8"))
            .trim()
            .split("\n")
            .map((line) => JSON.parse(line))
            .find((record) => record.requestId === result.requestId),
        { timeout: 2000 },
      )
      .toMatchObject({ status: 500, path: "/__test__/error", runId: "capture-test" });
  });

  test("searches available catalog products using the server contract", async () => {
    const response = await fetch(`${base}/api/search?q=${encodeURIComponent("книга")}`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      products: [{ id: 1, name: "Книга об архитектуре" }],
    });
  });

  test("persists an order with a supported coupon and calculates money in kopecks", async () => {
    const response = await fetch(`${base}/api/orders`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ items: [{ productId: 1, quantity: 1 }], coupon: "WELCOME" }),
    });
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ id: 1, total: 216000 });
    const count = await fetch(`${base}/api/orders/count`).then((result) => result.json());
    expect(count.count).toBe(1);
  });

  test("does not leak a previous request scope into the next exception", async () => {
    const response = await fetch(`${base}/__test__/error`, {
      headers: { "x-run-id": "second-run" },
    });
    const { eventId } = await response.json();
    const events = (await readFile(join(dir, "events.jsonl"), "utf8"))
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    expect(events.find((item) => item.event_id === eventId)?.tags.run_id).toBe("second-run");
  });

  test("returns 404 for unknown files without exposing source code", async () => {
    const response = await fetch(`${base}/src/store.ts`);
    expect(response.status).toBe(404);
  });
});
