import { findProduct, type CartItem } from "./store.ts";

export function calculateCart(items: CartItem[]) {
  const lines = items.map((item) => {
    const product = findProduct(item.productId)!;
    return {
      productId: item.productId,
      name: product.name,
      quantity: item.quantity,
      subtotal: product.price * item.quantity,
    };
  });
  return { lines, total: lines.reduce((sum, line) => sum + line.subtotal, 0) };
}
