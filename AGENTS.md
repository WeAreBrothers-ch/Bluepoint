# Shopify app development

This app is scaffolded from a Shopify app template. See the README for framework-specific details.

Use the [Shopify AI Toolkit](https://shopify.dev/docs/apps/build/ai-toolkit) for all Shopify API and platform work. If missing, install it in the agent host per that page (or `npx skills add Shopify/shopify-ai-toolkit --list` for skill-compatible hosts) — do not add tooling to this repo.

## Publication des changements (demande du propriétaire du dépôt)

- **Pas de pull request.** Une fois les vérifications passées (`npm run typecheck`, `npm run lint`, `npm test`, `npm run build`),
  pousser directement sur `main` : c'est la branche que Vercel met en ligne (Production = `main`).
- La branche par défaut de GitHub (`claude/vigilant-noether-n4dql5`) n'est qu'une copie : la remettre au même point que `main`
  après chaque envoi (`git push origin origin/main:refs/heads/claude/vigilant-noether-n4dql5`).
- Les fichiers du thème (`theme/`) ne partent pas avec Vercel : les envoyer dans le thème Shopify concerné (brouillon
  « bluepoint-refonte vague » pour l'instant) et vérifier l'empreinte MD5 dans Shopify.
- Prévenir avant tout ce qui touche la base de données (migrations), les prix ou les factures.
