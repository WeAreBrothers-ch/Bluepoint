import type { Config } from "@react-router/dev/config";
import { vercelPreset } from "@vercel/react-router/vite";

/**
 * Le preset Vercel découpe le serveur en fonctions Vercel (Fluid compute, Node).
 * Il n'est activé que pendant un build Vercel (variable VERCEL=1) : ailleurs
 * (Docker, `npm run start`), le serveur reste un seul fichier build/server/index.js.
 */
const isVercelBuild = process.env.VERCEL === "1";

export default {
  ssr: true,
  presets: isVercelBuild ? [vercelPreset()] : [],
} satisfies Config;
