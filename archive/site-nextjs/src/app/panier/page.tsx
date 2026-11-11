import type { Metadata } from "next";
import { CartView } from "@/components/cart/CartView";

export const metadata: Metadata = {
  title: "Panier | BluePoint Distribution",
};

export default function CartPage() {
  return (
    <main>
      <CartView />
    </main>
  );
}
