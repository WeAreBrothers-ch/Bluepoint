import prisma from "../../db.server";
import { completeSettings, type StoredSettings } from "./seller";
import type { ShopSettingsValues } from "./schema";

/** Lecture et enregistrement des réglages de la boutique (table ShopSettings). */

export async function loadStoredSettings(shop: string): Promise<StoredSettings | null> {
  return prisma.shopSettings.findUnique({ where: { shop } });
}

export async function loadCompleteSettings(shop: string): Promise<ShopSettingsValues | null> {
  return completeSettings(await loadStoredSettings(shop));
}

export async function saveSettings(shop: string, values: ShopSettingsValues): Promise<void> {
  await prisma.shopSettings.upsert({
    where: { shop },
    create: { shop, ...values },
    update: values,
  });
}
