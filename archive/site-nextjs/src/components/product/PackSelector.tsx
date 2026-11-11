import type { Bottle } from "@/data/types";
import { formatPrice } from "@/lib/format";
import { isPackSize, PACK_SIZES, packLabel, packPriceCents, type PackSize } from "@/lib/packs";
import styles from "./PackSelector.module.css";

interface PackSelectorProps {
  bottle: Bottle;
  value: PackSize;
  onChange: (size: PackSize) => void;
}

export function PackSelector({ bottle, value, onChange }: PackSelectorProps) {
  return (
    <fieldset className={`ui ${styles.fieldset}`}>
      <legend className={styles.legend}>Format</legend>
      <div className={styles.options}>
        {PACK_SIZES.map((size) => (
          <label key={size} className={styles.option}>
            <input
              type="radio"
              name={`format-${bottle.slug}`}
              value={size}
              checked={value === size}
              className={styles.input}
              onChange={(event) => {
                const next = Number(event.target.value);
                if (isPackSize(next)) onChange(next);
              }}
            />
            <span className="carre">{packLabel(size)}</span>
            <span className={styles.price}>{formatPrice(packPriceCents(bottle, size), bottle.currency)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
