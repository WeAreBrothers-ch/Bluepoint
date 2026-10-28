-- CreateTable
CREATE TABLE "ProRequest" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'en_attente',
    "source" TEXT NOT NULL DEFAULT 'site',
    "companyName" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'CH',
    "vatNumber" TEXT,
    "message" TEXT,
    "companyId" TEXT,
    "customerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "ProRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProRequest_shop_status_createdAt_idx" ON "ProRequest"("shop", "status", "createdAt");

