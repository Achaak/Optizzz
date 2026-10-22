# 0006 — Monorepo Turborepo, site en stack T3

**Date** : 2026-10-22 · **Statut** : accepté

## Contexte

L'extension et le Site Optizzz partagent les règles du jeu, le format des données échangées et le chiffrement d'alliance (ADR 0005). Les dupliquer ferait diverger le chiffrement, là où une divergence rend les données illisibles.

## Décision

- **Monorepo pnpm + Turborepo** : `apps/extension` (le WXT actuel), `apps/web` (le site), et des paquets partagés : `packages/game` (règles et lecteurs de pages purs, l'actuel `src/game/`), `packages/protocol` (schémas zod versionnés entre extension et site), `packages/crypto` (chiffrement d'alliance, petit et relu à part).
- **Site en stack T3** : Next.js, tRPC, Prisma, PostgreSQL. L'API vit dans l'app Next ; l'extension appelle la même API tRPC.
- **Logique partagée au maximum, interface non** : calculs, simulateurs, lecteurs et règles vivent dans les paquets ; chaque app garde ses composants. Le site a son propre style (shadcn/ui), l'extension garde le design système de `src/theme/`.
- **Hébergement** : Vercel et Neon pour commencer ; un VPS plus tard si besoin. Le cron horaire qui stocke les exports publics des serveurs passe par GitHub Actions.

## Conséquences

- Les commandes du CLAUDE.md passent par Turborepo ; le hook Husky reste à la racine.
- Prisma ne stocke que du chiffré pour le contenu des alliances : pas de requêtes SQL sur ces données.
