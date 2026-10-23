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
