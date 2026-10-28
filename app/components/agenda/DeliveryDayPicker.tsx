import { useState } from "react";
import type { FetcherWithComponents } from "react-router";
import type { AgendaActionResult } from "../../lib/agenda/action-result";
import { addDays, capitalize, longDay, nextDeliveryDay } from "../../lib/agenda/dates";
import { modeLabel } from "../../lib/agenda/labels";
import type { ScheduledTask } from "../../lib/agenda/types";
import { parseIsoDate, type IsoDate } from "../../lib/metafields/definitions";

/**
 * « Choisir le jour » : surtout pour les commandes du site arrivées sans date.
 * Deux raccourcis (aujourd'hui, prochain jour de livraison) et un calendrier pour les autres jours.
 */

interface DeliveryDayPickerProps {
  readonly task: ScheduledTask;
  readonly today: IsoDate;
  readonly fetcher: FetcherWithComponents<AgendaActionResult>;
  readonly busy: boolean;
  readonly saving: boolean;
}

function shortcutLabel(date: IsoDate, today: IsoDate): string {
  if (date === today) return `Aujourd’hui (${longDay(date)})`;
  if (date === addDays(today, 1)) return `Demain (${longDay(date)})`;
  return capitalize(longDay(date));
}

export function DeliveryDayPicker({ task, today, fetcher, busy, saving }: DeliveryDayPickerProps) {
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState<string>(task.plannedDate ?? "");
  const mode = modeLabel(task.mode);
  const undated = task.plannedDate === null;
  const chosen = parseIsoDate(day);
  const choose = (date: IsoDate) => {
    setOpen(false);
    fetcher.submit({ intent: "dater", orderId: task.orderId, date, deadline: task.deadline ?? "" }, { method: "post" });
  };

  if (!open) {
    return (
      <s-button
        icon="calendar"
        variant={undated ? "primary" : "secondary"}
        onClick={() => setOpen(true)}
        {...(saving ? { loading: true } : {})}
        {...(busy ? { disabled: true } : {})}
      >
        {undated ? mode.chooseDay : "Changer le jour"}
      </s-button>
    );
  }

  const shortcuts = [...new Set([today, nextDeliveryDay(today)])];
  return (
    <s-box padding="base" background="subdued" borderRadius="base">
      <s-stack direction="block" gap="small-200">
        <s-text type="strong">{mode.dayQuestion(task.name)}</s-text>
        <s-stack direction="inline" gap="small-200">
          {shortcuts.map((date) => (
            <s-button key={date} onClick={() => choose(date)}>
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
              if (chosen !== null) choose(chosen);
            }}
            {...(chosen === null || chosen < today ? { disabled: true } : {})}
          >
            Valider ce jour
          </s-button>
          <s-button icon="x" onClick={() => setOpen(false)}>
            Annuler
          </s-button>
        </s-stack>
      </s-stack>
    </s-box>
  );
}
