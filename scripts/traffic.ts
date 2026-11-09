import { randomUUID } from "node:crypto";
import { searchUrl } from "../public/api.js";

const baseUrl = process.env.TARGET_URL || "http://127.0.0.1:8080";
const runId = process.env.TRAFFIC_RUN_ID || randomUUID();
const rounds = Number(process.env.ROUNDS || 3);
if (!Number.isInteger(rounds) || rounds < 1 || rounds > 1000) {
  throw new Error("ROUNDS must be an integer from 1 to 1000");
}
const operations = [
  { name: "catalog", path: "/api/products" },
  { name: "search", path: searchUrl("Книга") },
  { name: "cart", path: "/api/cart" },
  { name: "saved-cart", path: "/api/cart?saved=1" },
  { name: "checkout", path: "/api/orders", body: { items: [{ productId: 1, quantity: 1 }] } },
];
const results = [];
for (let round = 0; round < rounds; round++) {
  for (const operation of operations) {
    const response = await fetch(new URL(operation.path, baseUrl), {
      method: operation.body ? "POST" : "GET",
      headers: { "content-type": "application/json", "x-run-id": runId },
      ...(operation.body ? { body: JSON.stringify(operation.body) } : {}),
    });
    results.push({
      operation: operation.name,
      round,
      status: response.status,
      release: response.headers.get("x-release"),
      result: await response.json(),
    });
  }
}
console.log(
  JSON.stringify(
    {
      runId,
      rounds,
      successes: results.filter((r) => r.status < 400).length,
      failures: results.filter((r) => r.status >= 400).length,
      results,
    },
    null,
    2,
  ),
);
