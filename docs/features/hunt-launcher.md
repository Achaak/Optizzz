# Feature : Lanceur de chasse

Décidé lors d'une session de cadrage (`/grill-me`) le 2026-10-07. Inspiré du simulateur de chasse de Calystene (v2.00.38) et de « Chasse à zéro perte » ; aucun code repris. Mécaniques et sources : `../research/chasse.md`.

Refait le 2026-10-18 sur le retour d'un joueur, qui trouvait celui de Calystene plus pratique : l'encart reprend l'**organisation** de son simulateur (vos données, paramètres, informations, pertes selon le TdC à l'arrivée, lancement), sans son code. Le moteur ne change pas ; ce qui servait à vérifier le plan (Calystene, promotions, courbe, conseils) passe dans « Détails ».

## But

Dire au joueur **combien chasser, avec quoi, et lancer en un clic** : le plus de cm² possible dans la limite de pertes qu'il accepte, sur tous ses créneaux de chasse libres.

## Comportement

- **Accès** : encart repliable « Lanceur de chasse » sur `Ressources.php`, sous `#boite_tdc` et à sa largeur (728 px). Script dédié (React + ECharts), monté dans un Shadow DOM. Replié, il montre le résumé.
- **Données** :
  - Armes, Bouclier, Vitesse de chasse : mémorisés quand le joueur passe sur `laboratoire.php` ; Étable à cochenilles : sur `construction.php` (feature légère `game-levels`). Rien en mémoire → lecture de la page en `fetch`. Niveau toujours illisible → message « Niveaux inconnus : passez par… » et aucun plan (jamais de niveau 0 supposé).
  - Armée et jeton : un `GET AcquerirTerrain.php` (terrain + fourmilière + loge, comme le formulaire du jeu), moins une **réserve par unité** saisie par le joueur et mémorisée, et moins les **anti-sondes** (`sondes.md`), replacées sur leurs lieux après le lancement. Avertissement si le plan vide toute la garnison, rappelé dans le bouton (« Lancer la chasse (230 cm², toute l'armée) »). Si le jeu répond « Vous n'avez pas d'armée a envoyer » (armée en chasse, ou aucune), l'encart le dit et montre les chasses en cours.
  - TDC de calcul : TDC actuel + gains des chasses en cours ; modifiable (flood attendu…).
  - Créneaux libres : Vitesse de chasse + 1 − chasses en cours.
- **Moteur** : combat simulé (Monte Carlo, 1 000 tirages de proies en recherche, 10 000 pour le plan affiché), règle de la demi-vie pour les pertes.
- **Objectifs** (mémorisés par serveur) :
  - **Ratio** (par défaut depuis le 2026-10-18, 8) : ratio attaque / difficulté choisi dans la liste de Calystene (1 à 10). Chaque option dit ce qu'elle donnerait : réplique 10 % (tables de Calystene), pertes moyennes, cm² chassés et découpage (« 8 → réplique 87 %, pertes moy. 12, 230 cm² (2 × 115) ») ;
  - **Rendement** (1 %) : pertes (9 fois sur 10) ≤ X % de la valeur en nourriture de l'armée envoyée.
- **Répartition** (mémorisée par serveur, « Mêlée » par défaut), ajoutée le 2026-10-18 à la demande d'un joueur :
  - **Mêlée** : le même mélange d'unités dans chaque chasse, au prorata de sa difficulté ;
  - **Par vagues** : l'ordre du simulateur de Calystene (`ComputeHuntDispatch`, v2.00.38). On remplit les chasses de la dernière à la deuxième avec les troupes qui peuvent encore monter (Tu, Tk, A, C, S, JS, SN, dans cet ordre) derrière **juste assez de JSN pour qu'elles rentrent indemnes**, trouvé par simulation au lieu des 2 × pertes max de Calystene ; puis les unités qui ne montent plus. La première chasse prend le reste : les élites et le gros des JSN. Mêmes surfaces que la répartition mêlée ;
  - les vagues ne sont gardées que si elles sont aussi sûres d'être gagnées, ne perdent pas plus de troupes (hors JSN) et en promeuvent au moins autant que la répartition mêlée. Sinon l'encart reste mêlé et le dit. Une seule chasse, ou rien d'autre que des JSN : rien ne change, l'encart le dit ;
  - mesures (`../research/promotions.md`) : promotions totales à peu près égales en médiane, plus de troupes promues et moins de JSN ; au ratio 5, le tampon de Calystene laissait abîmer tanks et tueuses, d'où le tampon simulé.
- **Pas d'objectif « zéro perte »** (retiré le 2026-10-07 après mesure) : les JSN encaissent en premier, et le terme fixe `0,01 × TDC` de la difficulté en blesse une à plus de la moitié de sa vie à tout TDC un peu grand. Avec 2 112 JSN à 4 496 cm², zéro perte ne permet aucune chasse ; même avec des tanks ou des tueuses en tête, on chasse 4 à 30 fois moins qu'en acceptant 1 % de pertes, et plus rien vers 50 000 cm² (détail : `../research/chasse.md`).
- **Plan** : pour chaque nombre de chasses possible, la plus grande surface qui respecte l'objectif ; on garde le plan qui rapporte le plus de cm² par heure (la durée dépend de la surface). L'armée est répartie au prorata de la difficulté de chaque chasse. Surfaces égales, sauf si des surfaces différentes rapportent plus de 3 % de plus.
- **Deux affichages** (choix mémorisé par serveur), ajoutés le 2026-10-18 pour que le joueur qui ne cherche pas de complexité n'ait qu'un choix à faire :
  - **simple** (par défaut) : trois choix, **Prudent** (ratio 10), **Équilibré** (8) et **Rapide** (6) ; une case « Faire monter mes troupes » (répartition par vagues), montrée seulement si l'armée a des troupes promouvables autres que les JSN ; quatre chiffres clés (terrain gagné et découpage, retour, pertes moyennes et leur temps de ponte, promotions : troupes et JSN → SN) ; le tableau des chasses, sans colonnes à cocher, et le bouton de lancement. Si un réglage avancé s'écarte de ce que montre la vue simple (ratio hors des trois, niveaux, TdC, nombre ou surface imposés, réserve, chasses changées à la main), une ligne le dit, avec un lien vers la vue avancée ;
  - **avancé** : tout ce qui suit. « Revenir à l'affichage simple » en haut.
- **Affichage avancé**, en parties repliables (état mémorisé), dans l'ordre du simulateur de Calystene ; le titre replié montre le résumé « 1 chasse de 182 cm² · +182 cm² · retour aujourd'hui 17 h 38 · ≈ 13 pertes » :
  - **Vos données** : niveaux lus (Armes, Bouclier, Vitesse de chasse, Étable à cochenilles), modifiables pour un essai, avec « revenir aux niveaux lus » ; vitesse de ponte lue sur la Reine. Armée **envoyée** par unité avec « (N max) » ; le reste est la réserve mémorisée ;
  - **Paramètres de chasse** : TdC au lancement (fixe la durée) et TdC à l'arrivée (combat), modifiables ; objectif ; répartition ; **Nombre de chasses** et **TdC par chasse**, chacun avec « Auto ». Surface fixée : l'objectif ne la limite plus, nombre de chasses en Auto = celui du plan calculé. « Retour souhaité » (jour + heure de Paris) : la plus grande surface revenue à temps, « Utiliser » la met dans TdC par chasse ;
  - **Informations sur la chasse** : TdC chassé, découpage, durée, retour, rentabilité (cm²/jour), nourriture, ratio, difficulté, ratio de référence de Calystene ; pertes min / moyenne / 9 fois sur 10 / pire tirage en unités, en **temps de ponte** (vitesse de la Reine) et en part de la durée de chasse ; palier de difficulté ; alerte si la chasse peut être perdue ;
  - **Pertes selon le TdC à l'arrivée** (replié) : les mêmes chasses si le TdC à l'arrivée valait 0,5 à 2 fois celui prévu ;
  - **Lancement des chasses** : n°, surface, unités, statut et « Lancer » par ligne, ligne T des totaux ; colonnes en plus à cocher (unités sans effectif, difficulté, ratio réel, pertes moyennes, pertes max, retour, « Modifier les chasses » pour changer surface et unités ligne par ligne) ;
  - **Détails** (replié) : pertes selon Calystene par chasse, promotions, curseur surface ↔ pertes avec sa courbe, conseil de ponte (+10 % / +25 % de l'unité la plus nombreuse), « attendre le retour » (Compte+) ;
  - chasses en cours avec leur compte à rebours.
- **Saisie** : les champs (niveaux, unités envoyées, TdC, nombre et surface des chasses, pertes) gardent ce que le joueur tape ; la valeur est prise en compte après une pause, à Entrée ou en quittant le champ, bornée au minimum affiché. Les boutons « Lancer » sont désactivés pendant le recalcul, pour ne jamais lancer le plan d'avant.
- **Lancement**, au clic seulement, jamais planifié :
  - « Lancer N chasses de X cm² » : une chasse après l'autre (GET du jeton, POST du formulaire), 1 s entre deux, arrêt au premier échec, état par ligne ; bouton désactivé pendant le lancement. Toutes parties : rechargement de la page. Une partie seulement : le plan est figé (plus de recalcul, l'armée lue au chargement n'est plus la bonne), les échecs peuvent être relancés, et un lien propose de recharger la page ;
  - « Lancer » par ligne, dans l'ordre.

## Hors v1

« Annuler toutes les chasses », lecture automatique des rapports, plusieurs armées (colonies).

## Code

| Fichier                                                                                                                                                        | Rôle                                                                    |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `apps/extension/src/features/game-levels/`                                                                                                                     | Feature légère : niveaux lus sur laboratoire / construction, mémorisés  |
| `apps/extension/src/entrypoints/hunt-launcher.content/index.tsx`                                                                                               | Script dédié à `Ressources.php` : monte l'encart après `#boite_tdc`     |
| `packages/game/src/army/units.ts`, `prey.ts`, `combat.ts` (partagés)                                                                                           | Unités (ordre des dégâts, `uniteN`, poids XP), proies, combat           |
| `apps/extension/src/features/hunt-launcher/engine/difficulty.ts`, `draw.ts`                                                                                    | Difficulté, durée et surface pour un retour, tirage des proies          |
| `engine/evaluate.ts`, `calystene.ts`                                                                                                                           | Monte Carlo d'une chasse, tables de pertes de Calystene                 |
| `engine/planner.ts`, `extras.ts`                                                                                                                               | Choix du plan ; courbe, ponte, attente, liste des ratios, TdC d'arrivée |
| `engine/requests.ts`, `engine.worker.ts`, `client.ts`                                                                                                          | Requêtes au moteur, Web Worker (repli en ligne si refusé)               |
| `pages.ts`, `launch.ts`, `settings.ts`, `view.ts`                                                                                                              | Lecture des pages, lancement, réglages, textes                          |
| `SimpleView.tsx`                                                                                                                                               | Affichage simple : trois choix, chiffres clés                           |
| `HuntLauncher.tsx` (état, parties), `PlayerData.tsx`, `HuntParameters.tsx`, `HuntResult.tsx`, `HuntTable.tsx`, `HuntDetails.tsx`, `LossCurve.tsx`, `style.css` | Vue React                                                               |

Tests vitest aux interfaces : combat rejoué sur les 35 rapports réels (`packages/game/src/army/__fixtures__/hunt-reports.ts`), difficulté, tirage, évaluation, planificateur (propriétés : armée, créneaux, objectif, meilleur rendement horaire), extras, pages (fixtures), lancement (fetch simulé), niveaux et réglages (fakeBrowser), textes. La vue elle-même se vérifie dans le jeu.
