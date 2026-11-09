import { searchUrl } from "./api.js";

const products = document.querySelector("#products");
const output = document.querySelector("#output");
const status = document.querySelector("#status");

async function request(path, options) {
  const response = await fetch(path, options);
  const result = await response.json();
  status.textContent = response.ok ? "Операция выполнена" : "Не удалось выполнить операцию";
  status.dataset.kind = response.ok ? "success" : "error";
  output.textContent = JSON.stringify(result, null, 2);
  return result;
}

document.querySelector("#search").addEventListener("submit", (event) => {
  event.preventDefault();
  void request(searchUrl(new FormData(event.target).get("term")));
});
document.querySelector("#cart").addEventListener("click", () => void request("/api/cart"));
document
  .querySelector("#saved-cart")
  .addEventListener("click", () => void request("/api/cart?saved=1"));
document.querySelector("#checkout").addEventListener("submit", (event) => {
  event.preventDefault();
  const coupon = new FormData(event.target).get("coupon");
  const body = { items: [{ productId: 1, quantity: 1 }], ...(coupon ? { coupon } : {}) };
  void request("/api/orders", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
});

const catalog = await request("/api/products");
for (const product of catalog.products) {
  const card = document.createElement("article");
  const title = document.createElement("h3");
  title.textContent = product.name;
  const price = document.createElement("p");
  price.textContent = `${(product.price / 100).toLocaleString("ru-RU")} ₽`;
  card.append(title, price);
  products.append(card);
}
