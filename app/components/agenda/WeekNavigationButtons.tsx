import type { WeekNavigation } from "../../lib/agenda/types";

/** « Semaine précédente / Cette semaine / Semaine suivante » : la semaine vit dans l'adresse. */

interface WeekNavigationButtonsProps {
  readonly navigation: WeekNavigation;
}

export function WeekNavigationButtons({ navigation }: WeekNavigationButtonsProps) {
  return (
    <s-stack direction="inline" gap="small-200" accessibilityLabel="Changer de semaine">
      <s-button href={`/app?vue=semaine&semaine=${navigation.previousStart}`} icon="chevron-left">
        Semaine précédente
      </s-button>
      {navigation.isCurrentWeek ? null : <s-button href="/app?vue=semaine">Revenir à cette semaine</s-button>}
      <s-button href={`/app?vue=semaine&semaine=${navigation.nextStart}`} icon="chevron-right">
        Semaine suivante
      </s-button>
    </s-stack>
  );
}
