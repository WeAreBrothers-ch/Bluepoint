"use client";

import { useEffect, useRef, useState } from "react";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { isAgeConfirmed, rememberAgeConfirmed, UNDERAGE_EXIT_URL } from "@/lib/age-gate";
import styles from "./AgeGate.module.css";

type GateState = "question" | "refused" | "confirmed";

/**
 * Rendue ouverte côté serveur (sans JavaScript, elle reste visible) ; masquée par CSS
 * avant le premier affichage si le navigateur a déjà confirmé l'âge.
 * Une fois hydratée, elle passe en modale native : fond inerte et focus piégé.
 */
export function AgeGate() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, setState] = useState<GateState>("question");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isAgeConfirmed()) {
      dialog.close();
      return;
    }
    dialog.close();
    dialog.showModal();
  }, []);

  const confirm = (): void => {
    rememberAgeConfirmed();
    setState("confirmed");
    dialogRef.current?.close();
  };

  return (
    <dialog
      ref={dialogRef}
      className={styles.gate}
      aria-labelledby="age-gate-title"
      data-state={state}
      open
      onCancel={(event) => event.preventDefault()}
    >
      <div className={styles.inner}>
        <div className={`ui ${styles.top}`}>
          <BrandLogo className={styles.logo} />
          <span className="sr-only">BluePoint Distribution</span>
          <span className="crochets">18+</span>
        </div>
        <h2 id="age-gate-title" className={styles.title}>
          Avez-vous l&apos;âge légal&nbsp;?
        </h2>
        {state === "refused" ? (
          <p className={styles.text} role="status">
            Ce site est réservé aux personnes majeures. Nous vous remercions de votre visite.{" "}
            <a className={styles.link} href={UNDERAGE_EXIT_URL}>
              En savoir plus avec Addiction Suisse
            </a>
          </p>
        ) : (
          <p className={styles.text}>
            Pour découvrir nos vins et spiritueux, vous devez avoir 18&nbsp;ans révolus.
          </p>
        )}
        <div className={styles.actions}>
          <button type="button" className={`ui carre ${styles.primary}`} onClick={confirm}>
            Oui, j&apos;ai 18 ans ou plus
          </button>
          <button type="button" className={`ui ${styles.secondary}`} onClick={() => setState("refused")}>
            Non
          </button>
        </div>
        <p className={`ui ${styles.legal}`}>
          L&apos;abus d&apos;alcool est dangereux pour la santé. À consommer avec modération.
        </p>
      </div>
    </dialog>
  );
}
