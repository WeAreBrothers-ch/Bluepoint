-- CreateTable
CREATE TABLE "AbaNinjaTestClient" (
    "shop" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'en_cours',
    "addressUuid" TEXT,
    "companyUuid" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AbaNinjaTestClient_pkey" PRIMARY KEY ("shop","kind")
);
