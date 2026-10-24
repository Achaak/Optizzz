# 0008 — Le site écrit les comptes dans un schéma `accounts`, avec son propre rôle

**Date** : 2026-10-23 · **Statut** : accepté

## Contexte

Jusqu'à l'étape 2 (`docs/features/site-public.md`), seul le cron écrivait en base ; le site lisait avec le rôle Postgres `optizzz_read`, qui ne peut rien écrire. Les Comptes Optizzz (ticket 14, `docs/features/site-comptes-espaces.md`) demandent que le site écrive : comptes, sessions, jetons du lien magique, prolongation de la session. Deux pièges : `optizzz_read` reçoit par défaut le droit de lire toute nouvelle table du schéma `public` (il lirait les e-mails), et les aperçus Vercel partagent la base de production.

## Décision

- **Schéma `accounts`** : les tables des comptes (puis, aux tickets suivants, Joueurs déclarés, clés, Espaces d'alliance) vivent dans un schéma Postgres à part, `accounts` (Prisma `schemas = ["public", "accounts"]`, `@@schema("accounts")`). Les données des serveurs restent dans `public`.
- **Rôle `optizzz_app`** pour le site en production : `SELECT` sur `public`, `SELECT, INSERT, UPDATE, DELETE` sur `accounts`, par droits par défaut (`ALTER DEFAULT PRIVILEGES … IN SCHEMA accounts`) pour que chaque nouvelle table de compte soit couverte sans geste en production. Il ne crée ni ne modifie aucune table.
- **`optizzz_read` n'a aucun droit sur `accounts`** : il ne lit jamais un e-mail.
- **Seul le cron écrit les données des serveurs** ; le site n'écrit que dans `accounts`. Les migrations restent faites par le rôle propriétaire (le workflow « Ingest »).
- **Aperçus Vercel en lecture seule** : ils gardent `optizzz_read` ; la connexion y échoue proprement (« La connexion n'est pas disponible ici »). Une branche Neon par aperçu pourra venir plus tard.
- **Session** : 30 jours, prolongée au plus une fois par jour (`updateAge`), pas une écriture à chaque requête.

## Options écartées

- **Donner au site le rôle propriétaire** : le site pourrait réécrire les données des serveurs et le schéma, et les aperçus avec lui.
- **Tables de comptes dans `public`, droits table par table** : un `GRANT` à la main en production pour chaque nouvelle table, et `optizzz_read` lirait les e-mails.

## Conséquences

- Mise en production : la migration (par le workflow « Ingest »), puis la création de `optizzz_app` et ses droits, puis `DATABASE_URL` de Production sur Vercel passe à `optizzz_app` (`scripts/setup-site.sh`).
- `optizzz_app` et `optizzz_read` se créent par SQL (`CREATE ROLE … LOGIN PASSWORD …`), jamais par « New Role » de la console Neon : ces rôles-là reçoivent `neon_superuser`, qui lit et écrit toutes les tables (`pg_read_all_data`, `pg_write_all_data`) et annulerait la séparation.
- Un nouveau modèle Prisma de compte porte `@@schema("accounts")` ; un modèle des serveurs, `@@schema("public")`.
