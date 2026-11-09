/** Lien « écrire un e-mail » (mailto:), avec l'objet et le message préremplis, pour la messagerie de l'équipe. */
export function mailtoUrl(to: string, subject: string, body: string): string {
  const address = encodeURIComponent(to.trim()).replace(/%40/g, "@");
  return `mailto:${address}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
