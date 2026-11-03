# Outil du site : temps de trajet

Décidé lors d'une session de cadrage (`/grill-me`) le 2026-10-23 (ticket 04). Socle commun : `site-outils.md`. Formule : `../research/temps-de-trajet.md`, codée dans `packages/game/src/travel.ts`.

## Adresse

`/tools/travel`. État dans `#p=` (`site-outils.md`) : serveur, les deux bouts, Vitesse d'attaque, heure de départ si elle est fixée.

## Saisie

- **Serveur**, puis **deux bouts** : chacun est un joueur (sélecteur de joueur du socle, par pseudo) ou une position (x, y) ; on peut mélanger (un joueur vers une position). Sans serveur, seules les positions sont possibles.
- **Vitesse d'attaque** de l'expéditeur (celui du premier bout), pré-remplie avec « Mes niveaux ».
- Bouton **« Inverser »** : échange les deux bouts (la Vitesse d'attaque reste celle saisie : c'est celle du nouvel expéditeur à saisir).
- **Départ** : « maintenant » par défaut, ou une heure donnée (jour et heure de Paris).

## Résultat

- Distance, arrondie à l'entier supérieur comme sur les profils du jeu (« Distance : 29 »), le temps utilisant la distance exacte.
- Temps de trajet, écrit comme Optizzz (`time-format`) : arrondi en dessous, comme le jeu.
- Arrivée, heure de Paris (« aujourd'hui 13 h 36 »), recalculée chaque minute quand le départ est « maintenant ».
- Une ligne : « Même temps pour une attaque et pour un convoi. »

## Doit

- Donner le même résultat que l'extension pour les mêmes entrées (`travel.ts` partagé, aucune formule recopiée).
- Marcher en clair, en sombre et sur téléphone.

## Mode « Vers des alliances »

Décidé lors d'une session de cadrage le 2026-11-03 (chantier 13 du lot `plans/lot-2026-11/`). Depuis un expéditeur et sa Vitesse d'attaque, le trajet vers tous les membres d'une ou plusieurs alliances, du plus proche au plus loin. Outil public, sans compte.

- **Où** : dans `/tools/travel`, une bascule « Vers un point | Vers des alliances » à la place du bloc « Destination ». Serveur, expéditeur, Vitesse d'attaque et départ restent communs. « Inverser » n'existe pas dans ce mode. Sans serveur, la bascule « Vers des alliances » est grisée (« choisissez un serveur ») ; changer de serveur vide la liste des alliances.
- **Alliances** : recherche par tag sur le serveur choisi (dès une lettre) ; chaque alliance choisie est une étiquette retirable « TAG · 42 membres ✕ » ; 10 au plus. Pas de « Sans alliance » (jusqu'à 209 000 joueurs sur s4 : c'est le travail des Cibles de l'extension).
- **Expéditeur** : un joueur ou une position. Il est retiré du tableau s'il est membre d'une alliance choisie.
- **Vitesse d'attaque** : comme le mode « Vers un point » et les autres outils (« Mes niveaux », « Reprendre mes niveaux »).
- **Tableau**, trié par trajet (pas d'en-tête triable : la distance donne le même ordre) : Joueur (lien vers sa page du site), Alliance, Distance (cases, arrondie au-dessus), Trajet (« 10H 1m 2s »), Arrivée (heure de Paris depuis le départ choisi, suivie chaque minute depuis « maintenant »), TDC, Portée.
- **Portée**, en mot, d'après le TDC de l'expéditeur (`inRange` : 50 % inclus à 300 % exclu) : « à portée », « trop petit », « trop gros ». Seulement quand l'expéditeur est un joueur ; avec une position, la colonne et le filtre disparaissent. Filtre « Seulement à portée », décoché par défaut.
- **Bannis** masqués ; **en vacances** affichés, ligne grisée et « en vacances » écrit dans la colonne Portée (le texte porte l'information, pas la couleur).
- **Téléphone** (375 px) : Joueur, Trajet et Arrivée en colonnes ; alliance, distance, TDC et portée en petite ligne sous le pseudo ; pas de défilement horizontal.
- **Lignes** : les 50 premières, puis « Voir plus (N restants) » ; le titre donne le total (« 87 membres, 3 alliances »).
- **Copier le tableau** : texte brut, une ligne par membre affiché par le filtre (`Pseudo · TAG · 29 cases · 10H 1m 2s · arrivée aujourd'hui 13 h 36`), pour Discord ; en plus de « Copier le lien ». Pas de CSV.
- **État** : version `2.` de `travelFormat`, avec `m` (le mode) et `t` (les tags, comme l'export les écrit, relus sans regarder la casse) ; les liens `1.` restent lus.
- **Données** : tRPC `alliances.search` (tag, nombre de membres) et `players.byAlliances` (serveur, 10 tags au plus : id, pseudo, alliance, position, TDC, vacances ; sans les bannis). Le calcul (`travel.ts`, `inRange`) se fait dans le navigateur.

## Code

Fait le 2026-10-23 (ticket 06). Pas de bouton dans l'extension pour cet outil.

| Fichier                                                             | Rôle                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/app/tools/travel/page.tsx`                            | La page, dans le gabarit du socle (`ToolPage`)                                                                                                                                                                                                                                                                         |
| `apps/web/src/components/tools/travel/travel-state.ts` (+ test)     | L'état (`travelFormat`, version 2 ; la version 1 reste lue) : `s` serveur, `a` et `b` les bouts (un id de joueur ou `[x, y]`), `v` Vitesse d'attaque, `d` départ (« 2026-10-23T20:15 », heure de Paris ; null : maintenant) ; `swapEnds` (« Inverser ») ; changer de serveur oublie les joueurs et garde les positions |
| `apps/web/src/components/tools/travel/travel-result.ts` (+ test)    | Distance, temps et arrivée avec `distance` et `travelTime` de `packages/game/src/travel.ts`, comme l'extension ; le départ à une heure de Paris (`fromParisParts`)                                                                                                                                                     |
| `apps/web/src/components/tools/travel/travel-alliances.ts` (+ test) | Vers des alliances : `allianceTrips` (trajets triés, expéditeur retiré, portée par `inRange`), `rangeWord`, `tripsText` (« Copier le tableau »)                                                                                                                                                                        |
| `apps/web/src/components/tools/travel/travel-alliances-view.tsx`    | `AlliancePicker` (recherche par tag, étiquettes) et `AllianceTripsTable` (filtre « Seulement à portée », 50 lignes puis « Voir plus », copie)                                                                                                                                                                          |
| `apps/web/src/server/api/routers/alliances.ts`, `players.ts`        | tRPC `alliances.search` et `players.byAlliances` (sans les bannis)                                                                                                                                                                                                                                                     |
| `apps/web/src/components/tools/travel/travel-tool.tsx`              | Le formulaire (`ServerSelect`, deux `PlayerPicker`, « Mes niveaux » pour la Vitesse d'attaque) et le résultat ; l'arrivée depuis « maintenant » suit l'horloge à chaque minute                                                                                                                                         |

Le schéma reste dans le site : l'outil ne s'ouvre pas depuis l'extension. Le temps s'écrit comme le jeu sur un profil (`formatGameDuration` : « 10H 1m 2s »), à la seconde : des écritures de `time-format`, c'est celle qui garde l'arrondi en dessous (`formatDuration` arrondit à la minute au-dessus).
