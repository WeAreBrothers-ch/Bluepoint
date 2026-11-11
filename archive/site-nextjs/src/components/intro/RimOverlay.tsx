import { RIM, STROKE } from "./arm-geometry";
import styles from "./Intro.module.css";

/** Le bord du verre, posé devant le nez ; il suit le bras (même animation). */
export function RimOverlay() {
  return (
    <svg className={styles.overlay} viewBox="0 0 474 474" aria-hidden="true">
      <path d={RIM} fill="none" stroke="#000" strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
