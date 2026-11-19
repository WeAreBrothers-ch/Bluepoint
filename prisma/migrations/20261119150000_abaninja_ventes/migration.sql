-- CreateTable
CREATE TABLE "AbaNinjaSale" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderName" TEXT NOT NULL,
    "isTest" BOOLEAN NOT NULL,
    "reference" TEXT NOT NULL,
    "noteState" TEXT NOT NULL DEFAULT 'en_cours',
    "noteUuid" TEXT,
    "noteNumber" TEXT,
    "addressUuid" TEXT,
    "companyUuid" TEXT,
    "invoiceState" TEXT,
    "invoiceUuid" TEXT,
    "invoiceNumber" TEXT,
    "paymentState" TEXT,
    "lastErrorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AbaNinjaSale_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AbaNinjaSale_orderId_key" ON "AbaNinjaSale"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "AbaNinjaSale_reference_key" ON "AbaNinjaSale"("reference");

-- CreateIndex
CREATE INDEX "AbaNinjaSale_shop_isTest_idx" ON "AbaNinjaSale"("shop", "isTest");

