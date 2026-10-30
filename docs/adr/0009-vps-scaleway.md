# 0009 — Le site, sa base et son cron sur un VPS Scaleway

**Date** : 2026-10-30 · **Statut** : accepté (remplace la ligne « Hébergement » de l'ADR 0006)

## Contexte

L'ADR 0006 mettait le site sur Vercel, sa base sur Neon et le cron horaire sur GitHub Actions, « un VPS plus tard si besoin ». Trois limites pesaient : les 5 Go par mois que Neon laisse sortir de sa base (le cron s'en arrangeait par des détours, `site-public.md`), un hébergeur et des journaux de requêtes aux États-Unis, et trois services à tenir pour un seul site.

## Décision

- **Une instance Scaleway à Paris** (Ubuntu 24.04, DEV1-S ou plus) porte tout : le site Next.js, Postgres 18, le cron horaire et la sauvegarde de nuit. Les fichiers sont dans `deploy/`, copiés dans `/opt/optizzz`.
- **Docker Compose et Caddy** (`deploy/compose.yml`, `deploy/Caddyfile`) : Caddy sert `optizzz.fr` en HTTPS (certificats Let's Encrypt) et redirige `www`. Pas de journal des accès : le site ne garde aucune adresse IP.
- **Images construites par GitHub Actions** (`apps/web/Dockerfile`, `.github/workflows/deploy.yml`) et poussées sur GHCR (`ghcr.io/achaak/optizzz-web` et `optizzz-tools`, publiques), étiquetées par le commit. Le VPS ne compile rien : il télécharge. Next.js en `output: "standalone"`.
- **Le build prérend sur une base vide** (comme la CI) ; une fois en ligne, `deploy.sh` appelle `/api/revalidate` : les pages se refont à la visite suivante.
- **Déploiement par SSH** à chaque push sur `main` qui touche le site, après la CI : `deploy.sh <commit>` applique les migrations (image `tools`, rôle propriétaire `optizzz`), redonne ses droits à `optizzz_app` (`deploy/postgres/grants.sql`, idempotent), puis remplace le site.
- **Cron et sauvegardes par systemd** sur le VPS (`deploy/systemd/`) : `ingest.sh` à chaque heure et dix, `backup.sh` à 3 h 40 UTC (`pg_dump` gardé 7 jours sur le VPS, 30 jours dans un bucket Object Storage à Paris, copié par rclone).
- **Rôles Postgres** : `optizzz` (propriétaire : migrations, cron) et `optizzz_app` (le site, ADR 0008). `optizzz_read` disparaît avec les aperçus Vercel.
- **Pas d'aperçu par branche** : on teste en local (`pnpm dev:web`, ou l'image avec `docker build`).

## Options écartées

- **Construire sur le VPS** : le build de Next.js demande plus de mémoire qu'une petite instance, et ralentirait le site pendant ce temps.
- **Coolify ou Dokploy** : aperçus et interface en plus, mais un service de plus à tenir et à mettre à jour, et de la mémoire prise au site.
- **Base gérée (Scaleway ou Neon)** : sauvegardes faites par d'autres, mais un coût ou les limites de Neon ; un `pg_dump` par nuit suffit à la taille de la base.

## Conséquences

- Mise en place et bascule depuis Vercel et Neon : `bash scripts/setup-vps.sh` (instance, pare-feu, secrets repris de l'ancienne installation, copie de Neon, GitHub, minuteries, DNS, ménage).
- `DISCORD_REMINDERS_KEY` et `BETTER_AUTH_SECRET` doivent rester les mêmes d'un hébergement à l'autre : la première chiffre les webhooks enregistrés, la seconde signe les sessions.
- Un échec du cron ne prévient plus par e-mail comme GitHub Actions : `journalctl -u optizzz-ingest` sur le VPS.
- Les mises à jour de sécurité d'Ubuntu sont automatiques (`unattended-upgrades`) ; celles des images (Postgres, Caddy, Node) passent par une nouvelle étiquette dans `deploy/compose.yml` ou `apps/web/Dockerfile`.
- Mentions légales, Confidentialité, `PRIVACY.md` et `docs/store/fiche.md` nomment Scaleway, en France, à la place de Vercel.
- Lancer le cron à la main sur un serveur : `ssh optizzz@<VPS> /opt/optizzz/ingest.sh --server s5`.
