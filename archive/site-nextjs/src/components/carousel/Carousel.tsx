"use client";

import { Children, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { CarouselControls } from "./CarouselControls";
import styles from "./Carousel.module.css";

interface CarouselProps {
  /** Nom du carrousel pour les lecteurs d'écran. */
  label: string;
  children: ReactNode;
}

interface ScrollState {
  index: number;
  canPrev: boolean;
  canNext: boolean;
  scrollable: boolean;
}

const INITIAL: ScrollState = { index: 0, canPrev: false, canNext: false, scrollable: false };

function readState(track: HTMLUListElement): ScrollState {
  const first = track.firstElementChild;
  const step = first instanceof HTMLElement ? first.offsetWidth + parseFloat(getComputedStyle(track).columnGap || "0") : 1;
  const maxScroll = track.scrollWidth - track.clientWidth;
  return {
    index: Math.round(track.scrollLeft / Math.max(step, 1)),
    canPrev: track.scrollLeft > 2,
    canNext: track.scrollLeft < maxScroll - 2,
    scrollable: maxScroll > 2,
  };
}

/**
 * Rangée défilante avec aimantation native (scroll-snap). Au doigt, on fait glisser ;
 * à la souris ou au clavier, PREV / NEXT avancent d'une carte. Les commandes
 * disparaissent quand tout tient à l'écran.
 */
export function Carousel({ label, children }: CarouselProps) {
  const trackRef = useRef<HTMLUListElement>(null);
  const [state, setState] = useState<ScrollState>(INITIAL);
  const items = Children.toArray(children);

  const update = useCallback((): void => {
    const track = trackRef.current;
    if (track) setState(readState(track));
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    update();
    const observer = new ResizeObserver(update);
    observer.observe(track);
    track.addEventListener("scroll", update, { passive: true });
    return () => {
      observer.disconnect();
      track.removeEventListener("scroll", update);
    };
  }, [update]);

  const move = (direction: 1 | -1): void => {
    const track = trackRef.current;
    const first = track?.firstElementChild;
    if (!track || !(first instanceof HTMLElement)) return;
    track.scrollBy({ left: direction * first.offsetWidth, behavior: "smooth" });
  };

  return (
    <div className={styles.carousel} role="region" aria-roledescription="carrousel" aria-label={label}>
      <ul ref={trackRef} className={styles.track}>
        {items.map((item, index) => (
          <li key={index} className={styles.slide}>
            {item}
          </li>
        ))}
      </ul>
      {state.scrollable && (
        <CarouselControls
          count={items.length}
          index={state.index}
          canPrev={state.canPrev}
          canNext={state.canNext}
          onMove={move}
        />
      )}
    </div>
  );
}
