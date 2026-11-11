import { STROKE } from "./arm-geometry";
import {
  CHIN,
  EAR,
  EYES_CLOSED,
  FACE_JAW,
  GLASSES_BAR,
  HAT_BRIM,
  HEAD_FILL,
  HEAD_OUTLINE,
  LENS_LEFT,
  LENS_MAIN,
  PUPILS,
  SHOULDER,
  SMILE,
  STUBBLE,
  TORSO_EDGE,
  TORSO_FILL,
} from "./head-geometry";
import styles from "./Intro.module.css";

const LINE = {
  fill: "none",
  stroke: "#000",
  strokeWidth: STROKE,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

/** Le personnage sans son bras : tête, lunettes, barbe, torse. Fixe, sous le bras. */
export function StaticFigure() {
  return (
    <svg className={styles.overlay} viewBox="0 0 474 474" aria-hidden="true">
      <path d={TORSO_FILL} fill="#fff" />
      <path d={TORSO_EDGE} {...LINE} />
      <path d={SHOULDER} {...LINE} />

      <path d={HEAD_FILL} fill="#fff" />
      <path d={`${LENS_LEFT}L206 196L217 153L226 135L188 141Z`} fill="#fff" />
      <path d={HEAD_OUTLINE} {...LINE} />
      <path d={FACE_JAW} {...LINE} />
      <path d={HAT_BRIM} {...LINE} strokeWidth={STROKE + 0.6} />
      <path d={GLASSES_BAR} {...LINE} strokeWidth={STROKE + 1.4} />
      <path d={LENS_LEFT} {...LINE} />
      <path d={LENS_MAIN} {...LINE} strokeWidth={STROKE + 0.6} />
      <path d={EAR} {...LINE} />
      <path d={SMILE} {...LINE} />
      <path d={CHIN} {...LINE} />

      <g fill="#000">
        {STUBBLE.map(([cx, cy]) => (
          <ellipse key={`${cx}-${cy}`} cx={cx} cy={cy} rx={1.7} ry={3.3} transform={`rotate(8 ${cx} ${cy})`} />
        ))}
      </g>

      <g className={styles.eyesClosed}>
        {EYES_CLOSED.map((d) => (
          <path key={d} d={d} {...LINE} />
        ))}
      </g>
      <g className={styles.eyesOpen}>
        <g className={styles.pupils}>
          {PUPILS.map((pupil) => (
            <ellipse key={pupil.cx} {...pupil} fill="#000" />
          ))}
        </g>
      </g>
    </svg>
  );
}
