# Feature : Analyse des joueurs

Décidé lors d'une session de cadrage (`/grill-me`) le 2026-11-20, avec `analyse-alliances.md`, `recrutement.md` et `site-analyse.md`. Sources : `../research/fourmizzz-api-exports.md`, `../research/combat.md` (portée, prise).

## But

Juger un joueur d'un coup d'œil sur son profil : peut-on se prendre l'un l'autre, joue-t-il encore, quand son TDC bouge, qui le floode et qui il floode, progresse-t-il vite pour sa taille.

## Où vit chaque outil

| Outil                  | Données                                  | Jeu (`Membre.php`)                   | Site (fiche joueur)   |
| ---------------------- | ---------------------------------------- | ------------------------------------ | --------------------- |
| Portée dans les 2 sens | dernier export + TDC en direct           | ligne dans « Informations »          | oui (sans « vous »)   |
| Inactif probable       | nuits en cache (Historique)              | ligne dans « Informations »          | oui                   |
| Quand son TDC bouge    | `PlayerHour` du site (`site-analyse.md`) | une phrase dans l'encart « Analyse » | les deux grilles      |
| Floods probables       | `ProbableFlood` du site                  | 3 lignes dans l'encart « Analyse »   | la liste sur 30 jours |
| Rang relatif           | nuits en cache (Historique)              | une phrase dans l'encart « Analyse » | oui                   |

Ce qui vient du site est lu sur une route publique (`/api/[server]/players/[id]/analysis`, ouverte à toutes les origines comme `/api/[server]/map`) : aucune permission en plus, aucun Compte Optizzz, rien sur le joueur qui regarde. Site injoignable : l'encart dit « Analyse horaire indisponible (optizzz.fr ne répond pas) » et garde ce qui se calcule en local.

Tout est visible par n'importe qui : l'export est public et quiconque le lit chaque heure fait le même calcul. L'encart et la fiche le disent en une phrase : « Calculé d'après l'export public de Fourmizzz, relevé chaque heure. »

## Portée dans les deux sens

- Règle : `inRange` de `packages/game/src/attack.ts` (50 % inclus, 300 % exclu), sur le TDC en direct du profil et le mien (`#quantite_tdc`).
- Ligne « Portée : » sous « Production max » : « vous pouvez l'attaquer · il peut vous attaquer », « vous pouvez l'attaquer · il ne peut pas vous attaquer », etc. Sur mon propre profil : rien.
- Ligne « Votre alliance : » quand j'en ai une : « 7 membres peuvent l'attaquer, il peut en attaquer 9 · le plus proche : Pseudo, 12 cases ». TDC des membres : dernier export (en direct pour moi). On ne connaît la Vitesse d'attaque que pour moi : distance en cases pour les membres, mon trajet seulement (« votre trajet : 3 h 12 ») en infobulle.
- Site, fiche joueur : « À portée de 214 joueurs, en a 198 à sa portée », et les alliances qui ont le plus de membres à portée.

## Inactif probable

- Règle : **TDC, Fourmilière et Technologie identiques à chaque nuit depuis au moins 3 nuits**, ou bien **seules des baisses de TDC** sur ces nuits (il se fait flooder sans répondre), scores inchangés.
- En vacances ou banni : jamais « inactif », l'état du jeu suffit.
- Texte : « Inactif probable depuis 5 j » ; quand il ne fait que perdre : « Inactif probable depuis 5 j (rien n'a bougé sauf des pertes) ». Infobulle : la règle.
- Ailleurs : pastille « inactif 5 j » dans les Cibles à portée (triable, jamais masquée : une cible qui ne riposte pas est une bonne cible ; `cibles.md`), dans les Suivis (`suivis.md`) et dans la liste des joueurs du site (filtre « inactifs probables »).
- La règle vit dans `packages/game` (pure, partagée avec le site et Recrutement).

## Quand son TDC bouge

Un gain arrive au retour d'une chasse ou à l'arrivée d'un flood, des heures après le clic ; une perte vient d'un flood subi ; un score monte à la fin d'un chantier lancé parfois la veille. Aucun signal ne dit « connecté » : l'outil ne s'appelle donc pas « Activité ».

- **Deux grilles**, « Hausses » et « Baisses », basculées par un onglet : 7 lignes (lundi → dimanche) × 24 heures de Paris, les 4 dernières semaines additionnées (`PlayerHour`, gardé 30 jours). Une case compte les heures où le TDC a monté (ou baissé). Une seule teinte, plus ou moins foncée ; le nombre au survol et pour les lecteurs d'écran (ADR 0003).
- **Phrase en tête** : « Plage calme habituelle : 2 h – 9 h », la plus longue suite d'heures sans hausse sur au moins 3 semaines sur 4. Pas de plage nette : « Pas de plage calme nette sur 4 semaines. »
- **Note** sous la grille : « Un gain arrive au retour d'une chasse ou d'un flood, souvent des heures après le clic. »
- Joueur entré dans l'export il y a moins de 7 jours : la grille, avec « Seulement N jours relevés ».

## Floods probables

Règle d'appariement : `site-analyse.md` (trois passes : un pour un, combinaisons de 2 à 4, candidats).

- Une ligne par perte ou par gain apparié, la plus récente d'abord : « **aujourd'hui entre 13 h et 14 h** · −1 248 300 · probablement par Pseudo » ; « · probablement par Pseudo et Autre » ; « · par l'alliance ABC, sans savoir qui » ; « · candidats : X, Y, Z » ; « · coupable inconnu ». Dans l'autre sens : « +1 248 300 · probablement pris à Pseudo ».
- Le mot « probable » partout ; l'infobulle de chaque ligne dit sa sûreté (« un seul joueur à portée a gagné la même chose », « une seule combinaison de joueurs à portée fait la somme », « plusieurs possibilités »).
- Jeu : les 3 dernières sur 7 jours, « Tout voir sur optizzz.fr » ; site : 30 jours, filtrables (pris / perdus).

## Rang relatif

- Les **joueurs de sa taille** : ceux dont le TDC était entre la moitié et le double du sien au début de la période, sans les inactifs probables, les joueurs en vacances ni les bannis.
- Mesure : % de gain de TDC sur la période (7 j dans l'encart, la période de la Progression ailleurs).
- Texte : « Progresse plus vite que 80 % des 214 joueurs de sa taille sur 7 j. » Moins de 10 joueurs de sa taille : rien.
- Aussi une colonne « Rang parmi sa taille » dans le tableau de la Progression des membres (`historique.md`) et sur la fiche joueur du site.

## Encart « Analyse » sur le profil

Sous l'encart « Progression » de l'Historique (ou sous « Informations » quand l'Historique est coupé) :

1. Plage calme habituelle (une phrase).
2. Floods probables sur 7 j (3 lignes).
3. Rang relatif (une phrase).
4. « Calculé d'après l'export public… » et « Voir la fiche sur optizzz.fr ».

La grille entière n'est que sur le site.

## Interrupteur

Feature « Analyse des joueurs » dans « Fonctionnalités », allumée par défaut, options « Portée », « Inactif probable » (profil, Cibles, Suivis), « Encart Analyse ».

## Fichiers

| Fichier                                                         | Rôle                                                                  |
| --------------------------------------------------------------- | --------------------------------------------------------------------- |
| `packages/game/src/analysis/reach.ts` (+ test)                  | Portée dans les deux sens, membres à portée, attaquant le plus proche |
| `packages/game/src/analysis/inactivity.ts` (+ test)             | Inactif probable d'après une suite de nuits                           |
| `packages/game/src/analysis/peers.ts` (+ test)                  | Joueurs de sa taille, rang relatif                                    |
| `apps/extension/src/data/nights.ts`                             | Les 8 dernières nuits (cache de l'Historique), inactivité d'un joueur |
| `apps/extension/src/features/player-analysis/mount.ts` (+ test) | Lignes « Portée », « Votre alliance », « Activité » sous « Etat »     |
| `apps/extension/src/features/player-analysis/index.ts`          | Export, TDC en direct, nuits                                          |
| `apps/extension/src/features/history/series.ts` (+ test)        | `periodRanks`, `rankText` : rang relatif dans la Progression          |
| `apps/extension/src/data/site-analysis.ts` (lot 3)              | Lecture de la route publique du site, zod                             |

## Ordre

Lot 1 (cache de l'extension, fait le 2026-11-20) : Portée, Inactif probable (profil, Cibles, Suivis), Rang relatif. Tant que l'encart « Analyse » n'existe pas, le rang relatif est une phrase sous « Sur la période » de l'encart « Progression », sur l'onglet TDC, et la ligne « Activité » n'apparaît que pour un inactif probable (« son TDC a monté hier à 21 h » attend les données horaires). Lot 3 (après `site-analyse.md`) : la plage calme et les floods dans l'encart.
