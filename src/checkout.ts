import { calculateCart } from "./cart.ts";
import { createOrder, type CartItem } from "./store.ts";

export type Checkout = { items: CartItem[]; coupon?: string };

export function checkout(input: Checkout) {
  const cart = calculateCart(input.items);
  const coupon = input.coupon!.trim().toUpperCase();
  const total = coupon === "WELCOME" ? Math.round(cart.total * 0.9) : cart.total;
  return createOrder(total);
}
