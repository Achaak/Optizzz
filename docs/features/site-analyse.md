# Site : TDC horaire et floods probables

Décidé lors d'une session de cadrage (`/grill-me`) le 2026-11-20, avec `analyse-joueurs.md` et `analyse-alliances.md`. Base et cron : `site-public.md`.

## But

Garder le TDC de chaque heure et en déduire les floods probables. L'extension ne peut pas le faire : sur S2, l'export horaire pèse 4,2 Mo, soit environ 100 Mo par jour. Le cron du site le lit déjà chaque heure.

## Ce que garde la base

- **`PlayerHour`** (serveur, joueur, `since` et `at` : les deux exports, TDC, `delta`) : une ligne seulement quand le TDC a changé depuis l'export précédent. L'écart est gardé pour ne pas relire la ligne d'avant à chaque case de la grille. **30 jours glissants**, purgés par le cron. Les nuits (`PlayerDay`) gardent le long terme.
- **`ProbableFlood`** (serveur, heure, victime, attaquants, candidats, montant, sûreté `sure` | `combination` | `candidates` | `unknown`) : écrit par le cron à chaque heure, gardé 30 jours. Les attaquants et les candidats gardent leur alliance du moment.
- Schéma `public`, écrit par le seul cron (ADR 0008).

## Résolution des floods, à chaque heure

Le défenseur perd ce que l'attaquant prend (`min(fourmis, 20 % de son TDC)`, `../research/combat.md`). Un écart horaire additionne tout ce qui s'est passé dans l'heure : plusieurs floods de plusieurs joueurs, des chasses rentrées.

Sur les seuls joueurs dont le TDC a bougé entre deux exports, et seulement quand ces deux exports sont à 3 heures au plus l'un de l'autre : au-delà (le cron a manqué des passages), les sommes mêlent trop de mouvements. Vu le 2026-11-20 sur la base locale, en retard de plusieurs jours : 460 pertes sur 552 restaient en « candidats ».

1. **Pertes** : baisse de plus de 1 % de son TDC. **Gains** : toute hausse.
2. **Candidats** d'une perte : les gagnants dont la victime était à portée au début de l'heure (`inRange`, 50 % inclus, 300 % exclu).
3. **Passe 1, un pour un** : une perte et un gain exactement égaux (au cm² : l'attaquant gagne ce que la victime perd ; 2 % de marge jusqu'au 2026-11-20), chacun n'ayant que l'autre comme candidat → `sure`.
4. **Passe 2, plusieurs pour un** : pour une perte restante, une combinaison de 2 à 4 gagnants restants dont la somme fait exactement la perte ; pour un gain restant, de même avec 2 à 4 perdants dont la somme fait exactement le gain. Une seule combinaison → `combination`. Les combinaisons ne sont cherchées qu'entre les 20 plus gros mouvements plausibles (un gain qui ne dépasse pas la perte, une perte qui ne dépasse pas le gain) : sans limite, des milliards de sommes par heure sur S2.
5. **Passe 3** : ce qui reste avec au moins un candidat → `candidates` ; sans candidat → `unknown`.
6. Si tous les candidats d'une perte sont de la même alliance, elle est notée (« par l'alliance ABC, sans savoir qui »), quelle que soit la sûreté.

Coût mesuré le 2026-11-20 sur deux exports réels consécutifs : S2 (20 645 joueurs), 11 pertes, 13 ms ; S4 (216 785 joueurs), 13 pertes, 55 ms ; toutes « sûres ». Les gains d'une perte sont trouvés par dichotomie sur le TDC de départ.

Un gain mêlé de chasses ne correspond à rien : la perte reste sans coupable plutôt qu'avec un faux. La logique est pure, dans `packages/game/src/analysis/floods.ts` (+ test sur des heures construites à la main).

## Reprise

Les deux tables partent vides au déploiement (2026-11-20). L'API de Fourmizzz garde ses exports horaires : `pnpm backfill` (sur le VPS : `deploy/backfill.sh`, en arrière-plan) relit ceux des 30 derniers jours, jusqu'au dernier export lu par le cron, et écrit chaque heure comme le cron (`writeHour`, partagée). Une heure qui a déjà des mouvements est sautée : la reprise peut tourner à côté du cron, qui n'écrit que les heures suivantes, et se relancer. Deux secondes entre deux téléchargements.

Relevé le 2026-11-20 : S5 publie un export par heure depuis un mois (732 sur 30 jours, 0,43 Mo chacun, ≈ 315 Mo) ; S1 à S4 seulement depuis le 14/11 environ (≈ 135 chacun ; 8,5, 4,3, 10 et 44 Mo, soit ≈ 1,1 Go, 580 Mo, 1,4 Go et 5,9 Go). Les pages suivent au passage suivant du cron.

Depuis le 2026-11-20, un flood n'est apparié qu'au cm² près (l'attaquant gagne exactement ce que la victime perd) ; les floods trouvés avant avec 2 % de marge se recalculent sans rien télécharger : `pnpm backfill -- --floods` (`./backfill.sh --floods` sur le VPS) relit les mouvements de `PlayerHour` (le TDC et son écart donnent celui d'avant) et remplace les floods de chaque heure. Les alliances sont alors celles du jour, celles des relevés n'étant pas gardées.

## Route publique

`GET /api/[server]/players/[id]/analysis`, ouverte à toutes les origines (`access-control-allow-origin: *`, comme `/api/[server]/map`), mise en cache jusqu'au passage suivant du cron :

- `quietHours` (la plage calme, seulement à partir de 7 jours relevés), `grid.rises` et `grid.falls` (7 × 24, heures de Paris ; un écart compte pour l'heure de l'export de départ, 13 h pour « entre 13 h et 14 h », et un écart de plus de 75 minutes n'y compte pas), `days` (jours relevés par le site, au plus 28) ;
- `floods` sur 30 jours (heure, montant, sens, attaquants ou victimes, candidats, alliance, sûreté) ;
- rien sur qui la lit. Validée par zod côté extension (`apps/extension/src/data/site-analysis.ts`).

## Pages

- **Fiche joueur** (`/[server]/players/[id]`) : tuiles Portée (combien peuvent l'attaquer, combien il peut attaquer), État (inactif probable d'après ses nuits), Plage calme, Rang relatif sur 7 j ; les deux grilles « Quand son TDC bouge » ; les floods probables sur 30 jours (Tous, Perdus, Pris) ; les 5 alliances qui l'ont le plus à portée. Le rang relatif du site écarte les joueurs dont rien n'a bougé de la semaine, au lieu de la règle des 3 nuits (calculée en une requête sur tout le serveur).
- **Fiche alliance** (`/[server]/alliances/[tag]`) : Face-à-face (champ « Face-à-face avec… », prérempli par l'alliance de mon Espace quand je suis connecté), Bloc diplomatique, Colonies, Floods probables par alliance (`analyse-alliances.md`).
- **Liste des joueurs** (`/[server]/players`) : case « Inactifs probables » : les joueurs dont les scores n'ont pas changé depuis au moins 3 nuits, ni en vacances ni bannis. Ceux qui n'ont fait que perdre du TDC n'y sont pas (une perte ouvre une nouvelle nuit).
- Visibles par tout visiteur, avec « Calculé d'après l'export public de Fourmizzz, relevé chaque heure. »
- Maquettes : rangée « C+ · Analyse » du canevas des maquettes du site.

## Ordre

Lot 3 (fait le 2026-11-20) : `PlayerHour`, la résolution des floods, la grille et les floods sur les fiches, puis les routes publiques et l'encart « Analyse » de l'extension.

## Fichiers

| Fichier                                                        | Rôle                                                                        |
| -------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `packages/game/src/analysis/floods.ts` (+ test)                | Résolution des floods d'une heure                                           |
| `packages/game/src/analysis/activity.ts` (+ test)              | Grilles hausses et baisses, plage calme                                     |
| `packages/game/src/analysis/alliance-floods.ts` (+ test)       | Floods par alliance adverse, schéma de la route                             |
| `packages/game/src/analysis/player-analysis.ts` (+ test)       | Schéma de la route d'un joueur, texte et date d'un flood                    |
| `apps/web/src/ingest/ingest.ts` (+ test sur Postgres)          | Écriture de `PlayerHour` et `ProbableFlood` (`writeHour`), purge à 30 jours |
| `apps/web/src/ingest/backfill.ts` (+ test sur Postgres)        | Reprise des 30 derniers jours (`pnpm backfill`, `deploy/backfill.sh`)       |
| `apps/web/src/server/queries.ts`                               | `playerHourly`, `playerReach`, `playerPeerRank`, `allianceFloodRows`        |
| `apps/web/src/lib/analysis/player-analysis.ts`                 | La réponse de la route et de la fiche                                       |
| `apps/web/src/app/api/[server]/players/[id]/analysis/route.ts` | Route publique d'un joueur                                                  |
| `apps/web/src/components/player/`, `alliance/floods-panel.tsx` | Grilles, floods, tableau par alliance                                       |
