import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Permet de vérifier un build dans un dossier séparé sans toucher au serveur de développement :
  // NEXT_DIST_DIR=.next-verif npm run build
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
};

export default nextConfig;
