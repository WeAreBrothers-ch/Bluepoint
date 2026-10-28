import { PrismaClient } from "@prisma/client";

/**
 * Client Prisma unique. En développement, il est gardé sur `globalThis`
 * pour ne pas ouvrir une nouvelle connexion à chaque rechargement à chaud.
 */
declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  return new PrismaClient();
}

const prisma: PrismaClient = globalThis.prismaGlobal ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.prismaGlobal = prisma;
}

export default prisma;
