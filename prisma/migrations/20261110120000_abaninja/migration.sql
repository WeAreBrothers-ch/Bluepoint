-- CreateTable
CREATE TABLE "AbaNinjaInvoice" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderName" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'en_cours',
    "isTest" BOOLEAN NOT NULL DEFAULT false,
    "reference" TEXT NOT NULL,
    "invoiceUuid" TEXT,
    "systemInvoiceNumber" TEXT,
    "status" TEXT,
    "openAmountCents" INTEGER,
    "statusCheckedAt" TIMESTAMP(3),
    "lastErrorCode" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AbaNinjaInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AbaNinjaInvoice_orderId_key" ON "AbaNinjaInvoice"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "AbaNinjaInvoice_reference_key" ON "AbaNinjaInvoice"("reference");

-- CreateIndex
CREATE INDEX "AbaNinjaInvoice_shop_state_idx" ON "AbaNinjaInvoice"("shop", "state");
