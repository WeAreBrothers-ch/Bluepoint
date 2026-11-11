-- Une seule demande « en attente » par adresse e-mail et par boutique.
-- Deux envois du formulaire presque en même temps (clics répétés) créaient deux demandes identiques :
-- la vérification dans le code ne suffit pas, la base de données l'interdit désormais.

-- 1. On garde la plus ancienne demande en attente de chaque e-mail, on efface les doubles.
DELETE FROM "ProRequest" AS doublon
USING "ProRequest" AS premiere
WHERE doublon."status" = 'en_attente'
  AND premiere."status" = 'en_attente'
  AND doublon."shop" = premiere."shop"
  AND lower(doublon."email") = lower(premiere."email")
  AND (doublon."createdAt" > premiere."createdAt"
       OR (doublon."createdAt" = premiere."createdAt" AND doublon."id" > premiere."id"));

-- 2. Index unique partiel (Prisma ne sait pas l'écrire dans schema.prisma : il vit seulement ici).
CREATE UNIQUE INDEX "ProRequest_une_demande_en_attente" ON "ProRequest" ("shop", lower("email")) WHERE "status" = 'en_attente';
