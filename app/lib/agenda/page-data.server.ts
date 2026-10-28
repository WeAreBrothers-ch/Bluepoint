import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { logError } from "../core/logger.server";
import { invoicesByOrder } from "../factures/repository.server";
import type { IsoDate } from "../metafields/definitions";
import { loadCompleteSettings } from "../reglages/settings.server";
import { addDays, formatRange, swissIsoDate, weekContaining, weekFromParam } from "./dates";
import { groupToday, groupWeek, type TodayGroups, type WeekGroups } from "./grouping";
import { loadAgendaOrders } from "./source.server";
import type { AgendaView, InvoiceRef, WeekNavigation } from "./types";

/** Données de la page Agenda, prêtes à afficher. */

export interface AgendaPageData {
  readonly view: AgendaView;
  readonly today: IsoDate;
  readonly periodLabel: string;
  readonly weekNavigation: WeekNavigation;
  readonly todayGroups: TodayGroups;
  readonly weekGroups: WeekGroups;
  readonly truncated: boolean;
  readonly loadError: string | null;
  readonly settingsComplete: boolean;
  /** Facture déjà créée, par identifiant de commande. */
  readonly invoices: Readonly<Record<string, InvoiceRef>>;
}

const EMPTY_TODAY: TodayGroups = { late: [], today: [], tomorrow: [], undated: [], doneToday: [] };

export async function loadAgendaPage(
  admin: AdminApiContext,
  shop: string,
  view: AgendaView,
  now: Date,
  weekParam: string | null,
): Promise<AgendaPageData> {
  const today = swissIsoDate(now);
  const week = view === "semaine" ? weekFromParam(weekParam, today) : weekContaining(today);
  const weekNavigation: WeekNavigation = {
    week,
    isCurrentWeek: week.start === weekContaining(today).start,
    previousStart: addDays(week.start, -7),
    nextStart: addDays(week.start, 7),
  };
  const periodLabel = formatRange(view === "aujourdhui" ? { start: today, end: today } : week);
  const [orders, settings] = await Promise.all([loadAgendaOrders(admin, week), loadCompleteSettings(shop)]);
  const base = { view, today, periodLabel, weekNavigation, settingsComplete: settings !== null };
  if (!orders.ok) {
    logError("Chargement de l'agenda impossible", orders.error);
    return {
      ...base,
      todayGroups: EMPTY_TODAY,
      weekGroups: groupWeek([], week, today),
      truncated: false,
      loadError: "Les commandes n’ont pas pu être chargées depuis Shopify. Rechargez la page dans un instant.",
      invoices: {},
    };
  }
  const tasks = orders.value.tasks;
  const invoices = await invoicesByOrder(shop, tasks.map((task) => task.orderId));
  return {
    ...base,
    todayGroups: groupToday(tasks, today),
    weekGroups: groupWeek(tasks, week, today),
    truncated: orders.value.truncated,
    loadError: null,
    invoices: Object.fromEntries([...invoices].map(([orderId, invoice]) => [orderId, { id: invoice.id, number: invoice.number }])),
  };
}
