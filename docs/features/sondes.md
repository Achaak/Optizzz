# Feature : Sondes

Demandée le 2026-10-16. Page : `../research/fourmizzz-pages.md` (« Armee.php », « Déplacer »).

## But

Toujours laisser des fourmis sur son Terrain de chasse, son Dôme et sa Loge : une attaque sur un lieu vide ne livre aucun combat, et le rapport ne montre pas l'armée de l'attaquant. Avec au moins une fourmi (la « sonde »), il y a combat et on voit ce qui arrive. Le joueur choisit combien de chaque unité chaque lieu garde (« anti-sonde » réglable, demandé le 2026-10-19).

## Décisions (2026-10-16)

- **Lieux** : le Dôme et la Loge par défaut ; le Terrain de chasse s'allume dans « Fonctionnalités » (options `probes.field`, éteinte par défaut, `probes.nest`, `probes.lodge`).
- **Sondes réglables (2026-10-19)** : pour chaque lieu surveillé, un nombre par unité, réglé dans l'encart d'Armée (« Régler les sondes ») et mémorisé par serveur. Par défaut, **une JSN** par lieu (l'unité la moins chère : une sonde perdue donne des trophées à l'attaquant, `../research/combat.md`). Un lieu est en place quand il a au moins le nombre voulu de chaque unité ; 0 partout = rien à garder. Les fourmis manquantes viennent des lieux qui en ont le plus en trop, sans jamais prendre les sondes d'un autre lieu surveillé ; un lieu non surveillé peut être vidé. Pas d'unité de remplacement : il manque des JSN, l'encart le dit.
- Quels lieux sont surveillés reste dans « Fonctionnalités » ; combien sur chacun, dans l'encart d'Armée (à côté de la garnison, là où l'on regarde ses troupes).
- **Envoi d'une chasse ou d'une attaque** : le jeu ne dit pas de quel lieu partent les fourmis. Règle retenue : un envoi laisse toujours **à la maison** au moins toutes les sondes, unité par unité (celles qui restent de toute façon comptant), puis elles sont **replacées automatiquement** sur leurs lieux.

## Comportement

- **Sur `Armee.php`**, au-dessus de la garnison, toujours un encart. Sondes en place : « ✓ Sondes en place : Dôme 10 JSN · Loge 1 JSN. » Sinon : « ⚠ Il manque des sondes sur la Loge. », un bouton « Placer les sondes » et les déplacements prévus (« 1 000 JSN du Terrain de chasse vers la Loge »). Un déplacement par unité et par lieu, l'un après l'autre (relecture d'`Armee.php`, POST du formulaire « Déplacer son armée » avec le jeton du moment), puis la page se recharge. Si le jeu ne prend pas un déplacement, l'encart le dit. Trop peu de fourmis à la maison : l'encart le dit. Dessous, « Régler les sondes » (replié) : un tableau unité × lieu surveillé (les unités possédées ou déjà demandées), « Enregistrer » mémorise et recharge la page.
- **Lanceur de chasse** : l'armée proposée est celle du jeu moins la réserve, moins ce qu'il faut pour les sondes (rappel sous la réserve). Après le lancement, les sondes sont replacées avant le rechargement de la page.
- **Plan de flood** : l'armée planifiée garde les sondes (« Sondes gardées au nid : 2 JSN. » dans le résumé) ; les troupes de la Loge non comptées restent à la maison et servent de sondes. « Remplir » ne met donc jamais les sondes dans le formulaire.
- **Attaque envoyée depuis le formulaire du jeu** (avec ou sans le Plan de flood) : marquée dans le `sessionStorage` de l'onglet ; à la page suivante, les sondes sont replacées en arrière-plan (sur `Armee.php`, la page se recharge pour montrer la garnison à jour). Le formulaire du jeu, pré-rempli avec toute l'armée, n'est pas modifié : sans « Remplir », toute l'armée peut partir.
- Interrupteur « Sondes » coupé (ou tous les lieux décochés) : rien sur Armée, aucune sonde gardée ni replacée.

## Non vérifié

Le POST du formulaire de déplacement n'a pas encore réussi sur le jeu. Premier essai (2026-10-16) : « Le jeu n'a pas pris le déplacement », car le formulaire était mal lu (HTML mal formé, voir la recherche) et rien n'était envoyé ; corrigé, à réessayer.

## Code

| Fichier                                       | Rôle                                                                                                    |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `src/game/probes.ts` (+ test)                 | Lieux sans sonde, déplacements à faire, fourmis à garder lors d'un envoi                                |
| `src/data/probes.ts` (+ test)                 | Formulaire « Déplacer son armée », placement des sondes, marque après envoi, sondes voulues par serveur |
| `src/data/garrison.ts` (+ test)               | Garnison d'`Armee.php` (ancien et nouveau balisage)                                                     |
| `src/features/probes/index.ts` (+ test)       | La feature, lieux surveillés (`watchedPlaces`)                                                          |
| `src/features/probes/mount.ts` (+ test)       | L'encart sur Armée : état, bouton, réglage                                                              |
| `src/features/hunt-launcher/HuntLauncher.tsx` | Sondes gardées et replacées après le lancement                                                          |
| `src/features/flood/mount.ts` (+ test)        | Sondes gardées dans le plan                                                                             |
