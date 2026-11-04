import { AgendaTabs } from "../AgendaTabs";
import { capitalize } from "../../lib/agenda/dates";
import type { AgendaPageData } from "../../lib/agenda/page-data.server";
import { TodayView } from "./TodayView";
import { WeekNavigationButtons } from "./WeekNavigationButtons";
import { WeekView } from "./WeekView";

/** Page « Agenda » : la partie visible, séparée de la route pour pouvoir être affichée seule (aperçu, tests). */

function Notices({ data }: { readonly data: AgendaPageData }) {
  return (
    <>
      {data.loadError === null ? null : <s-banner tone="critical" heading={data.loadError} />}
      {data.truncated ? (
        <s-banner tone="warning" heading="Certaines commandes ne sont pas affichées">
          Il y a trop de commandes en cours pour toutes les montrer. Terminez les livraisons en retard pour alléger la liste.
        </s-banner>
      ) : null}
      {data.pendingProRequests === 0 ? null : (
        <s-banner
          tone="info"
          heading={`${data.pendingProRequests} demande${data.pendingProRequests > 1 ? "s" : ""} de compte pro à valider`}
        >
          <s-button href="/app/pros">Voir les demandes</s-button>
        </s-banner>
      )}
      {data.settingsComplete ? null : (
        <s-banner tone="info" heading="Les factures ne peuvent pas encore être faites">
          <s-stack direction="block" gap="small-200">
            <s-text>Il manque vos coordonnées ou votre compte bancaire.</s-text>
            <s-button href="/app/reglages">Compléter mes coordonnées</s-button>
          </s-stack>
        </s-banner>
      )}
    </>
  );
}

/** Une phrase pour savoir tout de suite où on en est : combien il reste à livrer, dont combien en retard. */
function TodaySummary({ groups }: { readonly groups: AgendaPageData["todayGroups"] }) {
  const late = groups.late.length;
  const toDeliver = late + groups.today.length;
  if (toDeliver === 0) return <s-text color="subdued">Rien à livrer aujourd’hui.</s-text>;
  const orders = `${toDeliver} commande${toDeliver > 1 ? "s" : ""} à livrer`;
  return (
    <s-text type="strong" {...(late > 0 ? { tone: "critical" as const } : {})}>
      {late > 0 ? `${orders}, dont ${late} en retard` : orders}
    </s-text>
  );
}

export function AgendaPageView({ data }: { readonly data: AgendaPageData }) {
  return (
    <s-page heading="Mes livraisons" inlineSize="base">
      <s-button slot="primary-action" href="/app/commande" variant="primary">
        Prendre une commande
      </s-button>
      <s-section>
        <s-stack direction="block" gap="base">
          <AgendaTabs current={data.view} />
          <s-heading>{capitalize(data.periodLabel)}</s-heading>
          {data.view === "aujourdhui" ? <TodaySummary groups={data.todayGroups} /> : null}
          {data.view === "semaine" ? <WeekNavigationButtons navigation={data.weekNavigation} /> : null}
        </s-stack>
      </s-section>
      <Notices data={data} />
      {data.view === "aujourdhui" ? (
        <TodayView groups={data.todayGroups} invoices={data.invoices} today={data.today} emailConfigured={data.emailConfigured} />
      ) : (
        <WeekView groups={data.weekGroups} invoices={data.invoices} today={data.today} emailConfigured={data.emailConfigured} />
      )}
      <s-section>
        <s-text>
          Besoin d’aide\u202F? <s-link href="/app/aide">Voir les explications pas à pas</s-link>
        </s-text>
      </s-section>
    </s-page>
  );
}
