import { Sentry, writeRequest } from "./telemetry.ts";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { products, closeStore, orderCount } from "./store.ts";
import { searchProducts } from "./search.ts";
import { calculateCart } from "./cart.ts";
import { checkout, type Checkout } from "./checkout.ts";
import { release, runId } from "./config.ts";

function json(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

async function body(request: IncomingMessage): Promise<unknown> {
  const parts: Buffer[] = [];
  let size = 0;
  for await (const part of request) {
    const buffer = Buffer.from(part);
    size += buffer.length;
    if (size > 65536) throw new Error("Request body exceeds limit");
    parts.push(buffer);
  }
  return JSON.parse(Buffer.concat(parts).toString("utf8"));
}

const assets: Record<string, [string, string]> = {
  "/": ["index.html", "text/html; charset=utf-8"],
  "/app.js": ["app.js", "text/javascript; charset=utf-8"],
  "/api.js": ["api.js", "text/javascript; charset=utf-8"],
  "/style.css": ["style.css", "text/css; charset=utf-8"],
};

const server = createServer((request, response) => {
  void Sentry.withIsolationScope(async (scope) => {
    const url = new URL(request.url || "/", "http://localhost");
    const requestId = randomUUID();
    const attempt = String(request.headers["x-run-id"] || runId).slice(0, 128);
    const started = performance.now();
    scope.setTags({ run_id: attempt, request_id: requestId, route: url.pathname });
    scope.addBreadcrumb({
      category: "http",
      message: `${request.method} ${url.pathname}`,
      level: "info",
    });
    response.setHeader("x-request-id", requestId);
    response.setHeader("x-release", release);
    response.on("finish", () => {
      if (url.pathname === "/health") return;
      writeRequest({
        timestamp: new Date().toISOString(),
        requestId,
        runId: attempt,
        release,
        method: request.method,
        path: url.pathname,
        status: response.statusCode,
        durationMs: Math.round(performance.now() - started),
      });
    });
    try {
      if (process.env.ENABLE_TEST_ERROR === "1" && url.pathname === "/__test__/error") {
        throw new Error("Telemetry probe");
      } else if (request.method === "GET" && assets[url.pathname]) {
        const [file, contentType] = assets[url.pathname];
        const content = await readFile(
          fileURLToPath(new URL(`../public/${file}`, import.meta.url)),
        );
        response.writeHead(200, { "content-type": contentType });
        response.end(content);
      } else if (request.method === "GET" && url.pathname === "/health") {
        json(response, 200, { status: "ok", release, runId });
      } else if (request.method === "GET" && url.pathname === "/api/products") {
        json(response, 200, { products: products() });
      } else if (request.method === "GET" && url.pathname === "/api/search") {
        json(response, 200, { products: searchProducts(url.searchParams) });
      } else if (request.method === "GET" && url.pathname === "/api/cart") {
        const items =
          url.searchParams.get("saved") === "1"
            ? [
                { productId: 1, quantity: 1 },
                { productId: 4, quantity: 1 },
              ]
            : [{ productId: 1, quantity: 1 }];
        json(response, 200, calculateCart(items));
      } else if (request.method === "POST" && url.pathname === "/api/orders") {
        json(response, 201, checkout((await body(request)) as Checkout));
      } else if (request.method === "GET" && url.pathname === "/api/orders/count") {
        json(response, 200, { count: orderCount() });
      } else {
        json(response, 404, { error: "Not found" });
      }
    } catch (error) {
      const eventId = Sentry.captureException(error);
      await Sentry.flush(2000);
      json(response, 500, { error: "Операция не выполнена", eventId, requestId });
    }
  }).catch((error: unknown) => {
    console.error(error);
    if (!response.headersSent) json(response, 503, { error: "Telemetry unavailable" });
    else response.end();
  });
});

server.listen(Number(process.env.PORT || 8080), process.env.HOST || "127.0.0.1", () => {
  console.log(JSON.stringify({ listening: server.address(), release, runId }));
});

function stop() {
  server.close(() => {
    void Sentry.close(2000).finally(() => {
      closeStore();
    });
  });
}
process.once("SIGTERM", stop);
process.once("SIGINT", stop);
