# Feature : Sondes

Demandée le 2026-10-16. Page : `../research/fourmizzz-pages.md` (« Armee.php », « Déplacer »).

## But

Toujours laisser au moins une fourmi sur son Terrain de chasse, son Dôme et sa Loge : une attaque sur un lieu vide ne livre aucun combat, et le rapport ne montre pas l'armée de l'attaquant. Avec une fourmi (la « sonde »), il y a combat et on voit ce qui arrive.

## Décisions (2026-10-16)

- **Lieux** : le Dôme et la Loge par défaut ; le Terrain de chasse s'allume dans « Fonctionnalités » (options `probes.field`, éteinte par défaut, `probes.nest`, `probes.lodge`).
- **Une sonde = un lieu avec au moins une fourmi**, quelle qu'elle soit. Pour en placer une, on prend l'unité **la moins chère** (nourriture de ponte, en pratique une JSN) : une sonde perdue donne des trophées à l'attaquant (`../research/combat.md`). On la prend là où il y en a le plus, sans jamais vider un autre lieu surveillé ; un lieu non surveillé peut être vidé.
- **Envoi d'une chasse ou d'une attaque** : le jeu ne dit pas de quel lieu partent les fourmis. Règle retenue : un envoi laisse toujours au moins autant de fourmis **à la maison** que de lieux surveillés (les moins chères d'abord, celles qui restent de toute façon comptant), puis elles sont **replacées automatiquement** sur les lieux vides.

## Comportement

- **Sur `Armee.php`**, au-dessus de la garnison, quand un lieu surveillé est vide : « ⚠ Pas de sonde sur le Dôme et la Loge : … », un bouton « Placer les sondes » et les déplacements prévus (« 1 JSN du Terrain de chasse vers la Loge »). Un déplacement à la fois (relecture d'`Armee.php`, POST du formulaire « Déplacer son armée » avec le jeton du moment), puis la page se recharge. Si le jeu ne prend pas un déplacement, l'encart le dit. Trop peu de fourmis à la maison : l'encart le dit, sans bouton. Toutes les sondes en place : rien.
- **Lanceur de chasse** : l'armée proposée est celle du jeu moins la réserve, moins ce qu'il faut pour les sondes (rappel sous la réserve). Après le lancement, les sondes sont replacées avant le rechargement de la page.
- **Plan de flood** : l'armée planifiée garde les sondes (« 3 sondes gardées » dans le résumé) ; les troupes de la Loge non comptées restent à la maison et servent de sondes. « Remplir » ne met donc jamais les sondes dans le formulaire.
- **Attaque envoyée depuis le formulaire du jeu** (avec ou sans le Plan de flood) : marquée dans le `sessionStorage` de l'onglet ; à la page suivante, les sondes sont replacées en arrière-plan (sur `Armee.php`, la page se recharge pour montrer la garnison à jour). Le formulaire du jeu, pré-rempli avec toute l'armée, n'est pas modifié : sans « Remplir », toute l'armée peut partir.
- Interrupteur « Sondes » coupé (ou tous les lieux décochés) : rien sur Armée, aucune sonde gardée ni replacée.

## Non vérifié

Le POST du formulaire de déplacement n'a pas encore réussi sur le jeu. Premier essai (2026-10-16) : « Le jeu n'a pas pris le déplacement », car le formulaire était mal lu (HTML mal formé, voir la recherche) et rien n'était envoyé ; corrigé, à réessayer.

## Code

| Fichier                                       | Rôle                                                                        |
| --------------------------------------------- | --------------------------------------------------------------------------- |
| `src/game/probes.ts` (+ test)                 | Lieux sans sonde, déplacements à faire, fourmis à garder lors d'un envoi    |
| `src/data/probes.ts` (+ test)                 | Formulaire « Déplacer son armée », placement des sondes, marque après envoi |
| `src/data/garrison.ts` (+ test)               | Garnison d'`Armee.php` (ancien et nouveau balisage)                         |
| `src/features/probes/index.ts` (+ test)       | La feature, lieux surveillés (`watchedPlaces`)                              |
| `src/features/probes/mount.ts` (+ test)       | L'avertissement et le bouton sur Armée                                      |
| `src/features/hunt-launcher/HuntLauncher.tsx` | Sondes gardées et replacées après le lancement                              |
| `src/features/flood/mount.ts` (+ test)        | Sondes gardées dans le plan                                                 |
