"use client";

import { useSyncExternalStore } from "react";

interface LocalClockProps {
  timeZone: string;
}

const TICK_MS = 1000;

function subscribe(onChange: () => void): () => void {
  const timer = window.setInterval(onChange, TICK_MS);
  return () => window.clearInterval(timer);
}

/** L'heure à Lutry, à la seconde. Côté serveur, des tirets en attendant le navigateur. */
export function LocalClock({ timeZone }: LocalClockProps) {
  const formatter = new Intl.DateTimeFormat("fr-CH", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone,
  });
  const time = useSyncExternalStore(
    subscribe,
    () => formatter.format(Date.now()),
    () => "--:--:--",
  );
  return <time>{time}</time>;
}
