# Feature : Lanceur de chasse

Décidé lors d'une session de cadrage (`/grill-me`) le 2026-10-07. Inspiré du simulateur de chasse de Calystene (v2.00.38) et de « Chasse à zéro perte » ; ni copie de code ni copie d'interface. Mécaniques et sources : `../research/chasse.md`.

## But

Dire au joueur **combien chasser, avec quoi, et lancer en un clic** : le plus de cm² possible dans la limite de pertes qu'il accepte, sur tous ses créneaux de chasse libres.

## Comportement

- **Accès** : encart repliable « Lanceur de chasse » sur `Ressources.php`, sous `#boite_tdc`. Script dédié (React + ECharts), monté dans un Shadow DOM. Replié, il montre le résumé.
- **Données** :
  - Armes, Bouclier, Vitesse de chasse : mémorisés quand le joueur passe sur `laboratoire.php` ; Étable à cochenilles : sur `construction.php` (feature légère `game-levels`). Rien en mémoire → lecture de la page en `fetch`.
  - Armée et jeton : un `GET AcquerirTerrain.php` (terrain + fourmilière + loge, comme le formulaire du jeu), moins une **réserve par unité** saisie par le joueur et mémorisée. Avertissement si le plan vide toute la garnison.
  - TDC de calcul : TDC actuel + gains des chasses en cours ; modifiable (flood attendu…).
  - Créneaux libres : Vitesse de chasse + 1 − chasses en cours.
- **Moteur** : combat simulé (Monte Carlo, ~2 000 tirages de proies en recherche, 10 000 pour le plan affiché), règle de la demi-vie pour les pertes.
- **Objectifs** (mémorisés par serveur) :
  - **Rendement** (par défaut, 1 %) : pertes (9 fois sur 10) ≤ X % de la valeur en nourriture de l'armée envoyée ;
  - **Ratio** : ratio attaque / difficulté choisi (1 à 10, 8 par défaut), comme Calystene.
- **Pas d'objectif « zéro perte »** (retiré le 2026-10-07 après mesure) : les JSN encaissent en premier, et le terme fixe `0,01 × TDC` de la difficulté en blesse une à plus de la moitié de sa vie à tout TDC un peu grand. Avec 2 112 JSN à 4 496 cm², zéro perte ne permet aucune chasse ; même avec des tanks ou des tueuses en tête, on chasse 4 à 30 fois moins qu'en acceptant 1 % de pertes, et plus rien vers 50 000 cm² (détail : `../research/chasse.md`).
- **Plan** : pour chaque nombre de chasses possible, la plus grande surface qui respecte l'objectif ; on garde le plan qui rapporte le plus de cm² par heure (la durée dépend de la surface). L'armée est répartie au prorata de la difficulté de chaque chasse. Surfaces égales, sauf si des surfaces différentes rapportent plus de 3 % de plus.
- **Affichage** :
  - résumé : « 1 chasse de 182 cm² · +182 cm² · retour aujourd'hui 17 h 38 · ≈ 13 pertes » ;
  - une ligne par chasse : surface, TDC au combat, difficulté, ratio, pertes (moyenne, 9 fois sur 10, pire tirage), recoupement Calystene, unités envoyées (modifiables : la chasse est re-simulée), promotions attendues, durée, heure de retour ;
  - totaux : cm², cm²/jour, nourriture rapportée ;
  - alerte de palier quand le TDC d'une chasse franchit un palier de difficulté ;
  - curseur surface ↔ pertes avec sa courbe ;
  - conseil de ponte : ce que donneraient +10 % / +25 % de l'unité la plus nombreuse ;
  - « attendre le retour » : avec Compte+ (troupes en chasse connues), plan si l'on attend le retour des chasses en cours, comparé au plan immédiat ;
  - chasses en cours avec leur compte à rebours.
- **Lancement**, au clic seulement, jamais planifié :
  - « Lancer N chasses de X cm² » : une chasse après l'autre (GET du jeton, POST du formulaire), 1 s entre deux, arrêt au premier échec, état par ligne, rechargement de la page à la fin ; bouton désactivé pendant le lancement ;
  - « Lancer » par ligne, dans l'ordre.

## Hors v1

« Annuler toutes les chasses », lecture automatique des rapports, plusieurs armées (colonies).

## Code

| Fichier                                                           | Rôle                                                                   |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `src/features/game-levels/`                                       | Feature légère : niveaux lus sur laboratoire / construction, mémorisés |
| `src/entrypoints/hunt-launcher.content/index.tsx`                 | Script dédié à `Ressources.php` : monte l'encart après `#boite_tdc`    |
| `src/features/hunt-launcher/engine/units.ts`, `prey.ts`           | Unités (ordre des dégâts, `uniteN`, poids XP) et proies                |
| `engine/difficulty.ts`, `draw.ts`, `combat.ts`                    | Difficulté et durée, tirage des proies, combat et promotions           |
| `engine/evaluate.ts`, `calystene.ts`                              | Monte Carlo d'une chasse, tables de pertes de Calystene                |
| `engine/planner.ts`, `extras.ts`                                  | Choix du plan ; courbe, conseil de ponte, attente du retour            |
| `engine/requests.ts`, `engine.worker.ts`, `client.ts`             | Requêtes au moteur, Web Worker (repli en ligne si refusé)              |
| `pages.ts`, `launch.ts`, `settings.ts`, `view.ts`                 | Lecture des pages, lancement, réglages, textes                         |
| `HuntLauncher.tsx`, `HuntTable.tsx`, `LossCurve.tsx`, `style.css` | Vue React                                                              |

Tests vitest aux interfaces : combat rejoué sur les 35 rapports réels (`__fixtures__/hunt-reports.ts`), difficulté, tirage, évaluation, planificateur (propriétés : armée, créneaux, objectif, meilleur rendement horaire), extras, pages (fixtures), lancement (fetch simulé), niveaux et réglages (fakeBrowser), textes. La vue elle-même se vérifie dans le jeu.
