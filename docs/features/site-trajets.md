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

## Code

Fait le 2026-10-23 (ticket 06). Pas de bouton dans l'extension pour cet outil.

| Fichier                                                          | Rôle                                                                                                                                                                                                                                                                                          |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/app/tools/travel/page.tsx`                         | La page, dans le gabarit du socle (`ToolPage`)                                                                                                                                                                                                                                                |
| `apps/web/src/components/tools/travel/travel-state.ts` (+ test)  | L'état (`travelFormat`, version 1) : `s` serveur, `a` et `b` les bouts (un id de joueur ou `[x, y]`), `v` Vitesse d'attaque, `d` départ (« 2026-10-23T20:15 », heure de Paris ; null : maintenant) ; `swapEnds` (« Inverser ») ; changer de serveur oublie les joueurs et garde les positions |
| `apps/web/src/components/tools/travel/travel-result.ts` (+ test) | Distance, temps et arrivée avec `distance` et `travelTime` de `packages/game/src/travel.ts`, comme l'extension ; le départ à une heure de Paris (`fromParisParts`)                                                                                                                            |
| `apps/web/src/components/tools/travel/travel-tool.tsx`           | Le formulaire (`ServerSelect`, deux `PlayerPicker`, « Mes niveaux » pour la Vitesse d'attaque) et le résultat ; l'arrivée depuis « maintenant » suit l'horloge à chaque minute                                                                                                                |

Le schéma reste dans le site : l'outil ne s'ouvre pas depuis l'extension. Le temps s'écrit comme le jeu sur un profil (`formatGameDuration` : « 10H 1m 2s »), à la seconde : des écritures de `time-format`, c'est celle qui garde l'arrondi en dessous (`formatDuration` arrondit à la minute au-dessus).
