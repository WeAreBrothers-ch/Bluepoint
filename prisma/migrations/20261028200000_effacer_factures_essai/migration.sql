-- Données d'essai : efface les factures fictives de la boutique de test et leurs PDF,
-- remet la numérotation des factures à zéro (la prochaine sera BP-2026-0001)
-- et oublie les commandes par téléphone d'essai. Ne touche à rien d'autre.
DELETE FROM "StoredFile" WHERE "key" LIKE 'factures/5s71g8-0v.myshopify.com/%';
DELETE FROM "Invoice" WHERE "shop" = '5s71g8-0v.myshopify.com';
DELETE FROM "Counter" WHERE "shop" = '5s71g8-0v.myshopify.com';
DELETE FROM "PhoneOrderRequest" WHERE "shop" = '5s71g8-0v.myshopify.com';
