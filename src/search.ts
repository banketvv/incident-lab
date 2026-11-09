import { products } from "./store.ts";

export function searchProducts(params: URLSearchParams) {
  const query = params.get("q");
  if (query === null) throw new Error("Missing required search parameter q");
  return products().filter((product) => product.name.toLowerCase().includes(query.toLowerCase()));
}
