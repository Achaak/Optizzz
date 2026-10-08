# Feature : Cibles à portée

Décidé lors d'une session de cadrage (`/grill-me`) le 2026-10-08. Relevés de la page : `../research/fourmizzz-pages.md` (« ennemie.php ») ; règles d'attaque : `../research/combat.md` ; exports : `../research/fourmizzz-api-exports.md`.

## But

Voir d'un coup d'œil qui je peux attaquer, du plus proche au plus loin, avec le trajet, ce qu'une victoire rapporte, l'état du joueur et la diplomatie avec mon alliance.

## Ce que la page Ennemies fait déjà

Elle filtre 50 à 300 % de mon TDC et trie (TDC, distance, alliance, pseudo), mais par formulaire POST, sur 200 lignes au plus, un état à la fois. Elle ne montre ni trajet, ni arrivée, ni pactes et guerres en clair, et sans Compte+ pas de page suivante (S5 : 722 joueurs à portée, 200 affichés).

## Comportement

- **Où** : `ennemie.php`, encart repliable « Cibles à portée (N) » au-dessus du formulaire du jeu, déplié par défaut ; replié ou non est mémorisé par serveur. Rien sur le formulaire d'attaque (`ennemie.php?Attaquer=…`). Les lignes du jeu ne sont pas touchées.
- **Qui** : TDC entre 50 % (inclus) et 300 % (exclu) de mon TDC en direct (`#quantite_tdc`). Sont masqués : moi, mon alliance, les bannis.
- **Données** : exports publics des joueurs et des alliances (horaires, en cache). Pour les joueurs que le tableau du jeu affiche, son TDC en direct et son état remplacent ceux de l'export ; la protection débutant (« Nouveau ») n'est connue que pour eux. Position et alliance d'après l'export ; Vitesse d'attaque mémorisée (`game-levels`).
- **Colonnes** :
  - Pseudo : lien vers le profil, suivi de ⚔ si le joueur peut m'attaquer en retour (mon TDC entre 50 et 300 % du sien, soit le sien entre 33 et 200 % du mien) ;
  - Alliance : avec « · Pacte (PNA) » (la description du pacte en infobulle) ou « · Guerre » ;
  - TDC, puis % de mon TDC ;
  - Prise max : `floor(20 % de son TDC)` ; l'infobulle rappelle qu'il faut au moins autant de fourmis ;
  - Flood max (si « Plan de flood » est activé et mon armée connue par `Armee.php`) : le total d'un flood avec mes attaques possibles et mon armée, sa défense collée comprise (« — » si mon armée ne suffit pas) ; triable ; voir `flood.md` ;
  - Distance en cases, puis Trajet et Arrivée si l'attaque part maintenant ;
  - État : libre, colonisé par X, en vacances, protection débutant ;
  - Attaquer : lien vers `ennemie.php?Attaquer=<id>&lieu=1`, le formulaire du jeu, où le joueur choisit son armée et valide lui-même. Seulement pour les cibles attaquables maintenant : libres ou colonisées, hors pacte.
- **Couleurs** : comme le jeu, fond rouge pour une guerre (déclarée d'un côté ou de l'autre), bleu pour un pacte. Les joueurs en vacances ou protégés sont grisés.
- **Filtres** :
  - « Masquer les pactes », cochée par défaut ;
  - « Seulement les attaquables maintenant », décochée par défaut.
- **Tri** : par distance ; un clic sur « TDC » ou « Flood max » trie du plus gros au plus petit, un clic sur « Distance » ou « Trajet » revient à la distance. On voit les 50 premiers, puis « Voir plus (N restants) ».
- Les séries d'attaques (flood) relèvent de l'étape 9 (« Chaîne de TDC »).

## Code

| Fichier                                     | Rôle                                                                               |
| ------------------------------------------- | ---------------------------------------------------------------------------------- |
| `src/features/alliance-map/api.ts` (+ test) | Exports des joueurs et des alliances (`loadAlliancesExport`), en cache, zod        |
| `src/features/targets/targets.ts` (+ test)  | Lecture de `#tabEnnemie`, portée, prise max, diplomatie, état, liste des cibles    |
| `src/features/targets/mount.ts` (+ test)    | L'encart : tableau, filtres, tri, « voir plus », liens                             |
| `src/features/targets/index.ts`             | La feature (interrupteur `targets`), chargement des exports et des niveaux         |
| `src/features/targets/__fixtures__/*.html`  | `ennemie.php` relevée sur S2 (tous les états) et S5 (« Nouveau »), pseudos fictifs |

## Plus tard

- Les classes des lignes alliées et ennemies du jeu (couleurs bleue et rouge), pas encore vues.
- La protection débutant des joueurs absents du tableau du jeu : ni l'export ni une page en GET ne la donnent en bloc.
