/** Essais faits par les commandes fictives (bons, factures) : ce que la page Connexion AbaNinja montre. */

export interface TestSaleSummary {
  readonly orderName: string;
  /** « facture R02291, brouillon dans AbaNinja », « bon n° L00042 réglé · facture R02292 »… */
  readonly label: string;
}

/** `available` faux : la base n'a pas répondu (liste vide par défaut). */
export interface TestSales {
  readonly available: boolean;
  readonly items: readonly TestSaleSummary[];
}

export interface TestSalesEraseOutcome {
  readonly tone: "success" | "warning" | "critical";
  readonly heading: string;
  readonly details: readonly string[];
}

export const ERASE_TEST_SALES_INTENT = "vente-effacer";
