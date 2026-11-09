import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { dataDir } from "./config.ts";

export type Product = { id: number; name: string; price: number; active: number };
export type CartItem = { productId: number; quantity: number };

mkdirSync(dataDir, { recursive: true });
const db = new DatabaseSync(join(dataDir, "shop.sqlite"));
db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY, name TEXT NOT NULL, price INTEGER NOT NULL, active INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT, total INTEGER NOT NULL, created_at TEXT NOT NULL
  );
  INSERT OR IGNORE INTO products VALUES
    (1, 'Книга об архитектуре', 240000, 1),
    (2, 'Блокнот инженера', 65000, 1),
    (3, 'Кружка разработчика', 90000, 1),
    (4, 'Старая редакция книги', 120000, 0);
`);

export function products(): Product[] {
  return db.prepare("SELECT * FROM products WHERE active = 1 ORDER BY id").all() as Product[];
}

export function findProduct(id: number): Product | undefined {
  return products().find((product) => product.id === id);
}

export function createOrder(total: number) {
  const createdAt = new Date().toISOString();
  const result = db
    .prepare("INSERT INTO orders (total, created_at) VALUES (?, ?)")
    .run(total, createdAt);
  return { id: Number(result.lastInsertRowid), total, createdAt };
}

export function orderCount() {
  const row = db.prepare("SELECT COUNT(*) AS count FROM orders").get();
  return Number(row?.count);
}

export function closeStore() {
  db.close();
}
