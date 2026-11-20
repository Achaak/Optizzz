# Site : TDC horaire et floods probables

Décidé lors d'une session de cadrage (`/grill-me`) le 2026-11-20, avec `analyse-joueurs.md` et `analyse-alliances.md`. Base et cron : `site-public.md`.

## But

Garder le TDC de chaque heure et en déduire les floods probables. L'extension ne peut pas le faire : sur S2, l'export horaire pèse 4,2 Mo, soit environ 100 Mo par jour. Le cron du site le lit déjà chaque heure.

## Ce que garde la base

- **`PlayerHour`** (serveur, joueur, heure UTC de l'export, TDC) : une ligne seulement quand le TDC a changé depuis l'export précédent. **30 jours glissants**, purgés par le cron. Les nuits (`PlayerDay`) gardent le long terme.
- **`ProbableFlood`** (serveur, heure, victime, attaquants, candidats, montant, sûreté `sure` | `combination` | `candidates` | `unknown`) : écrit par le cron à chaque heure, gardé 30 jours. Les attaquants et les candidats gardent leur alliance du moment.
- Schéma `public`, écrit par le seul cron (ADR 0008).

## Résolution des floods, à chaque heure

Le défenseur perd ce que l'attaquant prend (`min(fourmis, 20 % de son TDC)`, `../research/combat.md`). Un écart horaire additionne tout ce qui s'est passé dans l'heure : plusieurs floods de plusieurs joueurs, des chasses rentrées.

Sur les seuls joueurs dont le TDC a bougé entre deux exports :

1. **Pertes** : baisse de plus de 1 % de son TDC. **Gains** : toute hausse.
2. **Candidats** d'une perte : les gagnants dont la victime était à portée au début de l'heure (`inRange`, 50 % inclus, 300 % exclu).
3. **Passe 1, un pour un** : une perte et un gain égaux à 2 % près, chacun n'ayant que l'autre comme candidat → `sure`.
4. **Passe 2, plusieurs pour un** : pour une perte restante, une combinaison de 2 à 4 gagnants restants dont la somme fait la perte à 2 % près ; pour un gain restant, de même avec 2 à 4 perdants. Une seule combinaison → `combination`.
5. **Passe 3** : ce qui reste avec au moins un candidat → `candidates` ; sans candidat → `unknown`.
6. Si tous les candidats d'une perte sont de la même alliance, elle est notée (« par l'alliance ABC, sans savoir qui »), quelle que soit la sûreté.

Un gain mêlé de chasses ne correspond à rien : la perte reste sans coupable plutôt qu'avec un faux. La logique est pure, dans `packages/game/src/analysis/floods.ts` (+ test sur des heures construites à la main).

## Route publique

`GET /api/[server]/players/[id]/analysis`, ouverte à toutes les origines (`access-control-allow-origin: *`, comme `/api/[server]/map`), mise en cache jusqu'au passage suivant du cron :

- `quietHours` (la plage calme), `grid.rises` et `grid.falls` (7 × 24, heures de Paris), `days` (jours relevés) ;
- `floods` sur 30 jours (heure, montant, sens, attaquants ou victimes, candidats, alliance, sûreté) ;
- rien sur qui la lit. Validée par zod côté extension (`apps/extension/src/data/site-analysis.ts`).

Pour les alliances : `GET /api/[server]/alliances/[tag]/floods`, le tableau par alliance adverse sur 7 jours.

## Pages

- **Fiche joueur** (`/[server]/players/[id]`) : Portée, Inactif probable, les deux grilles « Quand son TDC bouge » avec la plage calme, les floods probables sur 30 jours, le rang relatif, son maître et ses colonies (`analyse-joueurs.md`).
- **Fiche alliance** (`/[server]/alliances/[tag]`) : Face-à-face (champ « Face-à-face avec… », prérempli par l'alliance de mon Espace quand je suis connecté), Bloc diplomatique, Colonies, Floods probables par alliance (`analyse-alliances.md`).
- **Liste des joueurs** (`/[server]/players`) : filtre « inactifs probables ».
- Visibles par tout visiteur, avec « Calculé d'après l'export public de Fourmizzz, relevé chaque heure. »
- Maquettes : rangée « C+ · Analyse » du canevas des maquettes du site.

## Ordre

Lot 3 : `PlayerHour`, la résolution des floods, la grille et les floods sur les fiches, puis la route publique et l'encart « Analyse » de l'extension.
