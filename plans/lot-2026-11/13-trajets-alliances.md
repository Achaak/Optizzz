# 13 · Trajets vers des alliances entières (outil public)

Priorité 2 · effort S-M · dépend de : rien · conflits : aucun (outil du site isolé).

## But

Depuis un joueur (et sa Vitesse d'attaque), la distance et le trajet vers **tous les membres** d'une ou plusieurs alliances choisies, triés du plus proche au plus loin. Outil public, sans compte : il attire de nouveaux joueurs.

## Ce qui existe déjà

- `/tools/travel` (`docs/features/site-trajets.md`) : deux bouts (joueur ou position), Vitesse d'attaque, départ.
- `packages/game/src/travel.ts`, sélecteur de joueur du socle des outils (`components/tools/player-picker.tsx`), état dans `#p=` (`site-outils.md`).
- Les Cibles de l'extension (`cibles.md`) font un travail voisin dans le jeu.

## À cadrer

1. Un mode « Vers des alliances » dans `/tools/travel` (proposition) ou un nouvel outil ?
2. Choix des alliances : liste à cocher avec le nombre de membres, recherche par tag, « Sans alliance » ?
3. Colonnes : joueur, alliance, distance, trajet, arrivée si départ maintenant, TDC, portée d'attaque (50 % – 300 %) ?
4. Vitesse d'attaque : « Mes niveaux » pour soi ; pour un autre joueur de départ, saisie seule ?
5. Limite de lignes (une alliance de 600 « Sans alliance ») et export / copie ?

## Proposition par défaut

Bascule « Vers un point | Vers des alliances » dans `/tools/travel`, alliances choisies par tag (plusieurs), tableau trié par trajet, portée d'attaque en mot, état dans `#p=`.

## Maquette

Modifier l'artboard « C · Temps de trajet » du canevas.

## Fini quand

Calcul pur testé, état de l'adresse testé, vue montée, doc dans `site-trajets.md`, vérifié dans le navigateur sur la base locale (clair, sombre, 375 px).
