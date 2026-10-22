# Feature : Anti-sondes

Demandée le 2026-10-16 ; appelée « Sondes » jusqu'au 2026-10-21, où un joueur a rappelé que le mot du jeu est « anti-sonde » (la sonde est la fourmi qu'envoie l'attaquant). Page : `../research/fourmizzz-pages.md` (« Armee.php », « Déplacer »).

## But

Toujours laisser des fourmis sur son Terrain de chasse, son Dôme et sa Loge : une attaque sur un lieu vide ne livre aucun combat, et le rapport ne montre pas l'armée de l'attaquant. Avec au moins une fourmi (l'« anti-sonde »), il y a combat et on voit ce qui arrive. Le joueur choisit combien de chaque unité chaque lieu garde (« anti-sonde » réglable, demandé le 2026-10-19).

## Décisions (2026-10-16)

- **Lieux** : le Dôme et la Loge par défaut (une JSN chacun), le Terrain de chasse au choix.
- **Tout se règle sur Armée (2026-10-22)** : jusque-là, les lieux surveillés se cochaient dans « Fonctionnalités » (options `probes.field`, éteinte par défaut, `probes.nest`, `probes.lodge`) et le tableau d'Armée ne montrait que les lieux cochés. Des joueurs n'y comprenaient rien : le Terrain de chasse semblait avoir disparu, et la Loge gardait une anti-sonde dont ils ne voulaient pas. Désormais le tableau montre toujours les trois lieux ; un lieu à 0 partout ne garde rien. « Fonctionnalités » n'a plus que l'interrupteur « Anti-sondes ». Les anciens réglages sont repris : un lieu décoché garde 0.
- **Anti-sondes réglables (2026-10-19)** : pour chaque lieu, un nombre par unité, réglé dans l'encart d'Armée (« Régler les anti-sondes ») et mémorisé par serveur. Par défaut, **une JSN** par lieu (l'unité la moins chère : une anti-sonde perdue donne des trophées à l'attaquant, `../research/combat.md`). Un lieu est en place quand il a au moins le nombre voulu de chaque unité ; 0 partout = rien à garder. Les fourmis manquantes viennent des lieux qui en ont le plus en trop, sans jamais prendre les anti-sondes d'un autre lieu surveillé ; un lieu non surveillé peut être vidé. Pas d'unité de remplacement : il manque des JSN, l'encart le dit.
- **Envoi d'une chasse ou d'une attaque** : le jeu ne dit pas de quel lieu partent les fourmis. Règle retenue : un envoi laisse toujours **à la maison** au moins toutes les anti-sondes, unité par unité (celles qui restent de toute façon comptant), puis elles sont **replacées automatiquement** sur leurs lieux.

## Comportement

- **Sur `Armee.php`**, au-dessus de la garnison, toujours un encart. Anti-sondes en place : « ✓ Anti-sondes en place : Dôme 10 JSN · Loge 1 JSN. » Sinon : « ⚠ Il manque des anti-sondes sur la Loge. », un bouton « Placer les anti-sondes » et les déplacements prévus (« 1 000 JSN du Terrain de chasse vers la Loge »). Un déplacement par unité et par lieu, l'un après l'autre (relecture d'`Armee.php`, POST du formulaire « Déplacer son armée » avec le jeton du moment), puis la page se recharge. Si le jeu ne prend pas un déplacement, l'encart le dit. Trop peu de fourmis à la maison : l'encart le dit.
- **Replacer l'armée** (retour de joueur du 2026-10-19) : quand une armée revient, ses fourmis restent sur le lieu d'où elles sont parties. Le bouton « Replacer l'armée » met **toute l'armée en Loge**, sauf les anti-sondes des autres lieux surveillés, qui sont remises en place en même temps ; la Loge garde au moins les siennes. Les déplacements prévus sont écrits à côté (« 900 JSN du Terrain de chasse vers la Loge »), envoyés comme ceux des anti-sondes, puis la page se recharge. Le bouton n'apparaît que s'il y a quelque chose à déplacer. Trop peu de fourmis : les anti-sondes passent d'abord (Terrain, puis Dôme), la Loge prend le reste. Dessous, « Régler les anti-sondes » : un tableau unité × lieu (Terrain de chasse, Dôme, Loge ; les unités possédées ou déjà demandées), « Enregistrer » mémorise et recharge la page. Replié, sauf quand aucun lieu ne garde d'anti-sonde : l'encart dit alors « Aucune anti-sonde : choisissez ci-dessous combien de fourmis garder sur chaque lieu. »
- **Lanceur de chasse** : l'armée proposée est celle du jeu moins la réserve, moins ce qu'il faut pour les anti-sondes (rappel sous la réserve). Après le lancement, les anti-sondes sont replacées avant le rechargement de la page.
- **Plan de flood** : l'armée planifiée garde les anti-sondes (« Anti-sondes gardées au nid : 2 JSN. » dans le résumé) ; les troupes de la Loge non comptées restent à la maison et servent d'anti-sondes. « Remplir » ne met donc jamais les anti-sondes dans le formulaire.
- **Attaque envoyée depuis le formulaire du jeu** (avec ou sans le Plan de flood) : marquée dans le `sessionStorage` de l'onglet ; à la page suivante, les anti-sondes sont replacées en arrière-plan (sur `Armee.php`, la page se recharge pour montrer la garnison à jour). Le formulaire du jeu, pré-rempli avec toute l'armée, n'est pas modifié : sans « Remplir », toute l'armée peut partir.
- **Rythme des déplacements** (retour de joueur du 2026-10-21) : envoyés l'un après l'autre sans pause, le jeu en a pris deux puis ignoré le troisième, à chaque essai (« Replacer l'armée » : les JSN déplacées, puis au second essai les SN et les NdÉ, le reste toujours au Dôme). Depuis, chaque déplacement part d'une relecture d'`Armee.php` (jeton neuf), une seconde après le précédent, comme les pontes et les chasses ; un déplacement que la garnison relue ne montre pas est renvoyé une fois, puis l'encart dit l'échec.
- Interrupteur « Anti-sondes » coupé : rien sur Armée, aucune anti-sonde gardée ni replacée. Tous les lieux à 0 : aucune anti-sonde gardée ni replacée, mais l'encart reste sur Armée pour les régler.

## Non vérifié

Le POST du formulaire de déplacement marche (2026-10-21, chez un joueur : deux déplacements pris de suite), mais le jeu en a ignoré un sur trois envoyés sans pause. Le rythme d'une seconde et le renvoi (ci-dessus) ne sont pas encore vérifiés sur le jeu : on ne sait pas si le jeu limite le nombre de déplacements par minute ou refuse un jeton déjà servi. Premier essai (2026-10-16) : rien n'était envoyé, le formulaire était mal lu (HTML mal formé, voir la recherche).

## Code

| Fichier                                       | Rôle                                                                                                                                                 |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/game/probes.ts` (+ test)                 | Lieux sans anti-sonde, déplacements à faire (anti-sondes, `storeMoves`), fourmis à garder lors d'un envoi                                            |
| `src/data/probes.ts` (+ test)                 | Formulaire « Déplacer son armée », placement des anti-sondes, `storeArmy`, marque, anti-sondes voulues par serveur (et reprise des anciens réglages) |
| `src/data/garrison.ts` (+ test)               | Garnison d'`Armee.php` (ancien et nouveau balisage)                                                                                                  |
| `src/features/probes/index.ts` (+ test)       | La feature, `loadProbePlan` pour le Lanceur de chasse et le Plan de flood                                                                            |
| `src/features/probes/mount.ts` (+ test)       | L'encart sur Armée : état, bouton, réglage                                                                                                           |
| `src/features/hunt-launcher/HuntLauncher.tsx` | Anti-sondes gardées et replacées après le lancement                                                                                                  |
| `src/features/flood/mount.ts` (+ test)        | Anti-sondes gardées dans le plan                                                                                                                     |
