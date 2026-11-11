import {
  ARM_FILL,
  BOWL,
  FOREARM_EDGE,
  HAND_OUTLINE,
  HAND_RIGHT_EDGE,
  RING,
  RING_TIES,
  STEM,
  STROKE,
  WINE,
  WINE_PIVOT,
} from "./arm-geometry";
import styles from "./Intro.module.css";

const LINE = {
  fill: "none",
  stroke: "#000",
  strokeWidth: STROKE,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

/** Le bras qui tient le verre : il bouge d'un bloc, le vin tourne dans la coupe. */
export function WineOverlay() {
  return (
    <svg className={styles.overlay} viewBox="0 0 474 474" aria-hidden="true">
      <defs>
        <clipPath id="intro-coupe">
          <path d={BOWL} />
        </clipPath>
      </defs>

      <path d={ARM_FILL} fill="#fff" />
      <path d={FOREARM_EDGE} {...LINE} />
      <path d={HAND_OUTLINE} {...LINE} />
      <path d={HAND_RIGHT_EDGE} {...LINE} />
      <path d={RING} {...LINE} />
      {RING_TIES.map((d) => (
        <path key={d} d={d} {...LINE} />
      ))}
      <path d={STEM} {...LINE} strokeWidth={STROKE + 1} />

      <path d={BOWL} fill="#fff" />
      <g clipPath="url(#intro-coupe)">
        <g className={styles.wine} style={{ transformOrigin: WINE_PIVOT }}>
          <path d={WINE} fill="#000" />
        </g>
      </g>
      <path d={BOWL} {...LINE} />
    </svg>
  );
}
