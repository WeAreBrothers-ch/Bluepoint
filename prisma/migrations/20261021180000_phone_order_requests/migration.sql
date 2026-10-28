-- CreateTable
CREATE TABLE "PhoneOrderRequest" (
    "key" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'en_cours',
    "draftOrderId" TEXT,
    "draftOrderName" TEXT,
    "orderId" TEXT,
    "orderName" TEXT,
    "paymentPending" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhoneOrderRequest_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "PhoneOrderRequest_shop_createdAt_idx" ON "PhoneOrderRequest"("shop", "createdAt");

