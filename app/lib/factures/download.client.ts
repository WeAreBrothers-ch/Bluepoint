/**
 * Téléchargement du PDF depuis l'app intégrée : la route est authentifiée, on joint donc
 * le jeton de session App Bridge, puis on enregistre le fichier reçu.
 */

export async function downloadInvoicePdf(invoiceId: string, fileName: string): Promise<boolean> {
  try {
    const token = await shopify.idToken();
    const response = await fetch(`/app/factures/${encodeURIComponent(invoiceId)}/pdf`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return false;
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    return true;
  } catch {
    return false;
  }
}
