import { useState } from "react";
import { addDays, capitalize, longDay, nextDeliveryDay } from "../../lib/agenda/dates";
import { modeLabel } from "../../lib/agenda/labels";
import type { ScheduledTask } from "../../lib/agenda/types";
import { parseIsoDate, type IsoDate } from "../../lib/metafields/definitions";

/**
 * Choix du jour d'une commande (surtout celles du site, arrivées sans date) : deux raccourcis
 * (aujourd'hui, prochain jour de livraison) et un calendrier pour les autres jours.
 * S'affiche à la place des boutons de la carte, comme la confirmation de la livraison.
 */

interface DayChoicePanelProps {
  readonly task: ScheduledTask;
  readonly today: IsoDate;
  readonly onChoose: (date: IsoDate) => void;
  readonly onCancel: () => void;
}

function shortcutLabel(date: IsoDate, today: IsoDate): string {
  if (date === today) return `Aujourd’hui (${longDay(date)})`;
  if (date === addDays(today, 1)) return `Demain (${longDay(date)})`;
  return capitalize(longDay(date));
}

export function DayChoicePanel({ task, today, onChoose, onCancel }: DayChoicePanelProps) {
  const [day, setDay] = useState<string>(task.plannedDate ?? "");
  const chosen = parseIsoDate(day);
  const shortcuts = [...new Set([today, nextDeliveryDay(today)])];
  return (
    <s-box padding="base" background="subdued" borderRadius="base">
      <s-stack direction="block" gap="small-200">
        <s-text type="strong">{modeLabel(task.mode).dayQuestion(task.name)}</s-text>
        <s-stack direction="inline" gap="small-200">
          {shortcuts.map((date) => (
            <s-button key={date} onClick={() => onChoose(date)}>
              {shortcutLabel(date, today)}
            </s-button>
          ))}
        </s-stack>
        <s-date-field label="Ou un autre jour" value={day} allow={`${today}--`} onChange={(event) => setDay(event.currentTarget.value)} />
        <s-stack direction="inline" gap="small-200">
          <s-button
            variant="primary"
            icon="check"
            onClick={() => {
              if (chosen !== null) onChoose(chosen);
            }}
            {...(chosen === null || chosen < today ? { disabled: true } : {})}
          >
            Valider ce jour
          </s-button>
          <s-button icon="x" onClick={onCancel}>
            Annuler
          </s-button>
        </s-stack>
      </s-stack>
    </s-box>
  );
}
