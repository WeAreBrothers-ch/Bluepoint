import { ButtonLink } from "@/components/ui/ButtonLink";
import { PhotoFigure } from "@/components/ui/PhotoFigure";
import { HOUSE_FACTS, LUTRY } from "@/data/home";
import { PHOTOS } from "@/data/photos";
import { LocalClock } from "./LocalClock";
import styles from "./Manifesto.module.css";

/** La promesse en grand, puis la fiche signalétique de la maison. */
export function Manifesto() {
  return (
    <section className={styles.section} aria-labelledby="manifeste-title">
      <h2 id="manifeste-title" className={`ui carre ${styles.label}`}>
        À propos
      </h2>
      <div className={styles.body}>
        <p className={`apparition ${styles.statement}`}>
          De petits domaines d&apos;Italie et de Suisse romande, souvent en exclusivité, choisis un
          par un et livrés de Lutry à votre table.
        </p>
        <ButtonLink href="/#maison" variant="trait">
          L&apos;histoire de la maison
        </ButtonLink>
      </div>

      <div className={styles.photos}>
        <PhotoFigure photo={PHOTOS.cave} index={2} ratio="3 / 2" sizes="(min-width: 48rem) 62vw, 92vw" />
        <PhotoFigure photo={PHOTOS.etiquettes} index={3} ratio="1" sizes="(min-width: 48rem) 30vw, 92vw" />
      </div>

      <dl className={`ui ${styles.facts}`}>
        {HOUSE_FACTS.map((fact) => (
          <div key={fact.label} className={styles.fact}>
            <dt className={`crochets ${styles.factLabel}`}>{fact.label}</dt>
            <dd className={styles.factValue}>{fact.value}</dd>
          </div>
        ))}
      </dl>

      <div className={`ui ${styles.coordinates}`}>
        <span className="carre" data-actif="true">
          {LUTRY.place}
        </span>
        <span>
          {LUTRY.latitude}, {LUTRY.longitude}
        </span>
        <span>
          Heure locale <LocalClock timeZone={LUTRY.timeZone} />
        </span>
      </div>
    </section>
  );
}
