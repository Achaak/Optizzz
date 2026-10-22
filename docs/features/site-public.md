# Site public (étape 2 du Site Optizzz)

Décidé lors d'une session de cadrage (`/grill-me`) le 2026-10-22. Étape 2 de `site-optizzz.md` : le site sans compte. Ni comptes ni chiffrement ici.

## Découpage

- **2a, fondation** : `apps/web`, la base, le déploiement, le cron des exports et les pages de données des serveurs.
- **2b, outils**, un à la fois et chacun avec son cadrage court, dans cet ordre : carte du serveur, trajets, coûts et temps de développement, simulateur de combat, simulateur de chasse (moteur et worker), simulateur de flood. Chaque outil sort d'abord sa logique de l'extension vers `packages/game`.

## 2a

### Serveurs

S1 à S5, les seuls qui publient leur export (S1 à S4 en HTTP seulement, S5 en HTTPS ; relevé le 2026-10-22). La liste des serveurs, avec adresse et protocole, vit dans `packages/game` : un nouveau serveur s'ajoute en une ligne.

### Ce que garde la base

- **L'état courant** de chaque joueur et de chaque alliance, réécrit chaque heure : position, alliance, colonisateur, TDC, scores, vacances, banni, diplomatie. Un joueur s'identifie par serveur et id (le pseudo peut changer).
- **Un relevé par jour**, celui de minuit heure de Paris, pour les courbes des scores. Le passé est repris en relevés quotidiens depuis le premier export disponible (2026-09-30 sur S2).
- **Le Journal des Changements**, gardé pour toujours, détecté en comparant chaque relevé horaire au précédent : joueur nouveau, disparu, pseudo changé, alliance rejointe ou quittée, colonisé ou libéré, vacances, banni ou débanni ; alliance créée, disparue, pacte ou guerre ajouté ou retiré. Pas les variations de TDC ni de scores : les courbes s'en chargent. Le journal commence au premier passage du cron.

### Cron

Un script de `apps/web/scripts/`, lancé chaque heure par GitHub Actions, lit les exports publics et écrit dans Neon avec Prisma ; il ne télécharge une version que si elle a changé. À la fin, il appelle une route de revalidation du site protégée par un secret : les pages sont reconstruites une fois par heure, sans requête vers la base à chaque visite. Seul le cron écrit ; le site (production et aperçus Vercel) lit avec un rôle Postgres en lecture seule.

### Changements partagés avec l'extension

Le modèle des Changements des Suivis (`apps/extension/src/features/watchlist/changes.ts`, `describe.ts`) passe dans `packages/game` et gagne les types du site. Les Suivis les montrent aussi (pseudo changé, colonisé ou libéré…), avec des notifications activables une à une comme aujourd'hui.

### Pages

Toutes en français :

- `/s5` : nombre de joueurs, d'alliances, de colonisés, en vacances, de bannis ; TDC total ; les 10 premiers joueurs et alliances ; courbe du nombre de joueurs ; derniers Changements.
- `/s5/joueurs` : tableau triable, recherche par pseudo, filtre par alliance, pagination côté serveur.
- `/s5/joueurs/[id]` : fiche (alliance, position, colonisateur, scores), courbes, Journal du joueur.
- `/s5/alliances` et `/s5/alliances/[tag]` : membres, totaux, pactes et guerres, courbes, Journal. Le tag se lit sans tenir compte de la casse (comme `sameTag`) et redirige vers celle de l'export.
- Mentions légales (éditeur : Axel Lavoie ; hébergeur : Vercel) et Confidentialité (ni cookie ni mesure d'audience).

Les outils et les pages de serveur sont indexés par les moteurs de recherche ; les pages joueur et alliance sont en `noindex`.

### Look

shadcn/ui, neutre, en clair et sombre selon le système, avec un accent tiré du logo (brun `#5b3a1e`, crème `#f6efd9`), à vérifier en simulant protanopie et deutéranopie (ADR 0003). Courbes avec les charts de shadcn (Recharts). La carte de 2b, trop lourde pour Recharts (20 000 joueurs sur S2), se décidera dans son cadrage, sans doute ECharts pour elle seule.

### L'extension en 2a

Elle ne lit rien sur le site : sans compte, elle ne contacte que Fourmizzz (ADR 0005). Un lien « Voir sur optizzz.fr » viendra une fois les pages en ligne.

### Environnements

- Local : Postgres dans Docker (`apps/web/docker-compose.yml`, port 5433 : le 5432 est souvent pris) et le script du cron lancé sur un serveur (`pnpm --filter @optizzz/web ingest -- --server s5`).
- Mise en place de Vercel (racine `apps/web`), Neon, rôles Postgres, secrets GitHub et domaine `optizzz.fr` : `bash scripts/setup-site.sh`, un assistant pas à pas.

### Code

| Fichier                                                       | Rôle                                                                                |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `packages/game/src/servers.ts` (+ test)                       | Les serveurs et l'adresse de leur export                                            |
| `packages/game/src/exports.ts`, `export-versions.ts` (+ test) | Schémas de l'export public, ses versions, le premier export de chaque jour de Paris |
| `packages/game/src/changes.ts` (+ test)                       | Les Changements, partagés avec les Suivis, et leur texte                            |
| `apps/web/prisma/schema.prisma`                               | État courant, relevés quotidiens, Journal                                           |
| `apps/web/src/ingest/diff.ts` (+ test)                        | Le Journal entre deux relevés d'un serveur                                          |
| `apps/web/src/ingest/days.ts` (+ test)                        | Les jours qui manquent aux courbes (10 par passage)                                 |
| `apps/web/src/ingest/ingest.ts`, `scripts/ingest.ts`          | Un passage du cron : téléchargement, écriture, reconstruction des pages             |
| `.github/workflows/ingest.yml`                                | Le cron horaire (et les migrations)                                                 |
| `apps/web/src/server/queries.ts`                              | Ce que lisent les pages                                                             |
| `apps/web/src/app/`                                           | Les pages ; `api/revalidate` pour le cron, `api/trpc` pour la recherche de joueur   |
| `scripts/setup-site.sh`                                       | Mise en ligne pas à pas                                                             |

Vérifié en local le 2026-10-22 : S5 (1 857 joueurs) et S2 (20 559 joueurs, 29 s par passage avec 10 jours d'historique) relus, Journal noté sur un changement provoqué, pages en clair, sombre et largeur de téléphone.

## 2b

Chaque outil garde son état dans l'adresse (`?a=…`) pour se partager en lien, sans compte. Plus tard, l'extension pourra ouvrir le site pré-rempli (rapport de combat, armée).
