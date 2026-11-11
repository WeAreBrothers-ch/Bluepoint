import styles from "./Intro.module.css";

/*
 * Les effets de la dégustation, posés sur le visage (repère 474 × 474) :
 * le rose aux joues et les arômes qui montent du verre.
 */

const AROMAS: ReadonlyArray<string> = [
  "M176 196c-8-10 8-18 0-28s8-18 0-28",
  "M160 204c-8-10 8-18 0-28s8-18 0-28",
  "M192 190c-6-8 6-14 0-22s6-14 0-22",
];

export function TastingOverlay() {
  return (
    <svg className={styles.overlay} viewBox="0 0 474 474" aria-hidden="true">
      <ellipse className={styles.blush} cx="344" cy="222" rx="22" ry="12" fill="#f890c5" />

      {AROMAS.map((d, index) => (
        <path
          key={d}
          className={styles.aroma}
          style={{ animationDelay: `calc(var(--t-arome) + ${index * 140}ms)` }}
          d={d}
          fill="none"
          stroke="#fff"
          strokeWidth={3.5}
          strokeLinecap="round"
          pathLength={1}
        />
      ))}
    </svg>
  );
}
