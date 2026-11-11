"use client";

import type { AnimationEvent, CSSProperties } from "react";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { markIntroSeen } from "@/lib/intro";
import { NoseOverlay } from "./NoseOverlay";
import { RimOverlay } from "./RimOverlay";
import { StaticFigure } from "./StaticFigure";
import { TastingOverlay } from "./TastingOverlay";
import { WineOverlay } from "./WineOverlay";
import styles from "./Intro.module.css";

/**
 * La réplique, écrite lettre à lettre en très grand : trois morceaux, sur trois lignes
 * sur mobile, les deux derniers réunis sur une ligne sur grand écran.
 */
const LINES: ReadonlyArray<string> = ["Oh là là,", "quelle", "émotion !"];
const DRAWING_LABEL = "Paolo, dessiné au trait, fait tourner son verre de vin rouge puis le hume les yeux fermés";


/**
 * Intro de l'accueil : Paolo fait tourner son vin, le sent, s'émeut, puis le rideau
 * se lève sur le site. Tout le minutage vit dans le CSS ; l'animation démarre d'elle-même
 * dès que la vérification d'âge est passée (l'intro est masquée avant).
 */
export function Intro() {
  const onAnimationEnd = (event: AnimationEvent<HTMLDivElement>): void => {
    if (event.target === event.currentTarget) markIntroSeen();
  };

  return (
    <div className={styles.intro} data-intro role="region" aria-label="Introduction" onAnimationEnd={onAnimationEnd}>
      <div className={`ui ${styles.top}`}>
        <BrandLogo className={styles.logo} />
        <button type="button" className={`ui carre ${styles.skip}`} onClick={markIntroSeen}>
          Passer
        </button>
      </div>

      <p className={styles.quote}>
        {LINES.map((line, index) => (
          <span
            key={line}
            className={styles.quoteLine}
            style={{ "--lettres": line.length, "--rang": index } as CSSProperties}
          >
            {line}
          </span>
        ))}
      </p>

      <div className={styles.stage}>
        <div className={styles.character} role="img" aria-label={DRAWING_LABEL}>
          <StaticFigure />
          <TastingOverlay />
          <div className={styles.arm}>
            <WineOverlay />
          </div>
          {/* Le bout du nez plonge dans le verre, le bord du verre passe devant lui. */}
          <NoseOverlay />
          <div className={styles.arm}>
            <RimOverlay />
          </div>
        </div>
      </div>
    </div>
  );
}
