"use client";

import { useSyncExternalStore } from "react";
import { getServerSnapshot, getSnapshot, subscribe, type CartLine } from "./store";

export function useCart(): ReadonlyArray<CartLine> {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useCartCount(): number {
  return useCart().reduce((total, line) => total + line.quantity, 0);
}
