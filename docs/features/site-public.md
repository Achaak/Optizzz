# Site public (étape 2 du Site Optizzz)

Décidé lors d'une session de cadrage (`/grill-me`) le 2026-10-22. Étape 2 de `site-optizzz.md` : le site sans compte. Ni comptes ni chiffrement ici.

## Découpage

- **2a, fondation** : `apps/web`, la base, le déploiement, le cron des exports et les pages de données des serveurs.
- **2b, outils** : carte du serveur (`site-carte.md`), puis, cadrés ensemble le 2026-10-23 (`site-outils.md`), trajets, coûts et temps de développement, simulateur de combat, simulateur de chasse (moteur et worker), simulateur de flood, qui avancent en parallèle sur un socle commun. Chaque outil sort d'abord sa logique de l'extension vers `packages/game`. Les coûts et durées de tous les niveaux, hors bonus, sont prêts pour l'outil des coûts : `packages/game/src/level-costs.ts` (`docs/research/couts-des-niveaux.md`).

## 2a

### Serveurs

S1 à S5, les seuls qui publient leur export (S1 à S4 en HTTP seulement, S5 en HTTPS ; relevé le 2026-10-22). La liste des serveurs, avec adresse et protocole, vit dans `packages/game` : un nouveau serveur s'ajoute en une ligne.

### Ce que garde la base

- **L'état courant** de chaque joueur et de chaque alliance, réécrit chaque heure : position, alliance, colonisateur, TDC, scores, vacances, banni, diplomatie. Un joueur s'identifie par serveur et id (le pseudo peut changer).
- **Un relevé par jour**, celui de minuit heure de Paris, pour les courbes des scores. Le passé est repris en relevés quotidiens depuis le premier export disponible (2026-09-30 sur S2).
- **Le Journal des Changements**, gardé pour toujours, détecté en comparant chaque relevé horaire au précédent : joueur nouveau, disparu, pseudo changé, alliance rejointe ou quittée, colonisé ou libéré, vacances, banni ou débanni ; alliance créée, disparue, pacte ou guerre ajouté ou retiré. Pas les variations de TDC ni de scores : les courbes s'en chargent. Le journal commence au premier passage du cron.

### Cron

Un script de `apps/web/scripts/`, lancé chaque heure sur le VPS (ADR 0009, minuterie systemd `deploy/systemd/optizzz-ingest.timer`), lit les exports publics et écrit dans la base avec Prisma ; il ne télécharge une version que si elle a changé. Écrit quand la base était chez Neon (5 Go par mois au plus sortis de la base), le cron ne relit pas l'état précédent dans la base, il retélécharge l'export précédent depuis l'API (la base seulement s'il n'est plus publié), et il demande les jours déjà gardés par un `groupBy` (le `distinct` de Prisma télécharge toutes les lignes et dédoublonne en mémoire). À la fin, il appelle une route de revalidation du site protégée par un secret : les pages sont reconstruites une fois par heure, sans requête vers la base à chaque visite. Seul le cron écrit les données des serveurs ; le site les lit. Depuis les Comptes Optizzz (ADR 0008), le site de production écrit dans le seul schéma `accounts`, avec le rôle `optizzz_app`.

### Changements partagés avec l'extension

Le modèle des Changements des Suivis (`apps/extension/src/features/watchlist/changes.ts`, `describe.ts`) passe dans `packages/game` et gagne les types du site. Les Suivis les montrent aussi (pseudo changé, colonisé ou libéré…), avec des notifications activables une à une comme aujourd'hui.

### Pages

Toutes en français, à des adresses en anglais depuis le 2026-10-23 (`site-outils.md`) :

- `/s5` : nombre de joueurs, d'alliances, de colonisés, en vacances, de bannis ; TDC total ; les 10 premiers joueurs et alliances ; courbe du nombre de joueurs ; derniers Changements.
- `/s5/players` : tableau triable, recherche par pseudo, filtre par alliance, pagination côté serveur.
- `/s5/players/[id]` : fiche (alliance, position, colonisateur, scores), courbes, Journal du joueur.
- `/s5/alliances` et `/s5/alliances/[tag]` : membres, totaux, pactes et guerres, courbes, Journal. Le tag se lit sans tenir compte de la casse (comme `sameTag`) et redirige vers celle de l'export.
- Mentions légales (`/legal` ; éditeur : Axel Lavoie ; hébergeur : Scaleway, depuis le 2026-10-30) et Confidentialité (`/privacy` ; ni mesure d'audience, ni cookie du site hors du cookie de session posé à la connexion d'un Compte Optizzz ; publicité AdSense sans pistage depuis le 2026-10-30, `site-publicite.md`).

Les outils et les pages de serveur sont indexés par les moteurs de recherche ; les pages joueur et alliance sont en `noindex`.

### Look

Revu le 2026-10-30 (`site-refonte.md`) : direction « Campagne », sombre d'abord avec un bouton système/clair/sombre, titres condensés, chiffres en police à chasse fixe, ambre et bleu vérifiés en simulant protanopie et deutéranopie (ADR 0003), sur une base shadcn/ui. Courbes avec les charts de shadcn (Recharts). La carte de 2b, trop lourde pour Recharts (20 000 joueurs sur S2), se décidera dans son cadrage, sans doute ECharts pour elle seule.

### L'extension en 2a

Elle ne lit rien sur le site en 2a. Depuis la révision de l'ADR 0005 (2026-10-22), elle pourra le faire sans compte, pour les données publiques, sans rien envoyer du joueur ; chaque feature qui s'en servira le décidera dans son cadrage.

### Environnements

- Local : Postgres dans Docker (`apps/web/docker-compose.yml`, port 5433 : le 5432 est souvent pris) et le script du cron lancé sur un serveur (`pnpm --filter @optizzz/web ingest -- --server s5`).
- Production : un VPS Scaleway (ADR 0009) avec le site, Postgres, le cron et les sauvegardes, déployé par `.github/workflows/deploy.yml` à chaque push sur `main` ; mise en place et bascule : `bash scripts/setup-vps.sh`, un assistant pas à pas.

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
| `deploy/ingest.sh`, `deploy/systemd/optizzz-ingest.*`         | Le cron horaire, sur le VPS (ADR 0009)                                              |
| `apps/web/src/server/queries.ts`                              | Ce que lisent les pages                                                             |
| `apps/web/src/app/`                                           | Les pages ; `api/revalidate` pour le cron, `api/trpc` pour la recherche de joueur   |
| `scripts/setup-vps.sh`, `.github/workflows/deploy.yml`        | Mise en ligne pas à pas, puis déploiement (et migrations) à chaque push sur `main`  |

Vérifié en local le 2026-10-22 : S5 (1 857 joueurs) et S2 (20 559 joueurs, 29 s par passage avec 10 jours d'historique) relus, Journal noté sur un changement provoqué, pages en clair, sombre et largeur de téléphone.

## 2b

Cadrage : `site-outils.md` (socle) et une page par outil. Chaque outil garde son état dans le fragment de l'adresse (`#p=…`, jamais envoyé au serveur) pour se partager en lien, sans compte ; le simulateur de combat, le Lanceur de chasse et le Plan de flood de l'extension ouvrent l'outil du site pré-rempli, au clic.

Les adresses du site passent en anglais (`/tools`, `/s5/players`, `/s5/map`, `/privacy`…), sans redirection depuis les anciennes ; ce que lit le visiteur reste en français (décidé le 2026-10-23, `site-outils.md`).
