# Feature : Modèles de ponte

Décidé lors d'une session de cadrage (`/grill-me`) le 2026-10-18, sur la demande d'un joueur : « produire 100 JSN, 50 JS et 10 artilleuses sur 24 h » sans remonter la file de ponte unité par unité. Voir aussi `laying-planner.md` et `roadmap.md`.

## But

Mémoriser une ponte d'armée habituelle (plusieurs unités) et la mettre dans la file du jeu en un clic, après avoir vu ce qu'elle coûtera, combien de temps elle durera et quand elle finira.

## Comportement

- **Où** : encart repliable « Modèles de ponte » en haut de `Reine.php`, au-dessus des unités. L'état (ouvert / replié) est mémorisé. Replié : une ligne par modèle, avec sa durée et son bouton « Lancer ».
- **Catalogue** : feature « Modèles de ponte », séparée du Planificateur de ponte ; chacune se coupe seule. Les calculs (coût et durée d'une unité, payable, entretien) sont ceux du planificateur (`laying-planner/laying.ts`), réutilisés, pas recopiés.
- **Un modèle** : un nom et des lignes ordonnées. Une ligne = une unité pondable (ouvrières comprises) et une destination, **Loge par défaut** (Terrain, Dôme, Loge). Deux modes :
  - **quantités fixes** (100 JSN, 50 JS, 10 artilleuses) ;
  - **répartition + cible** (10 : 5 : 1) : les quantités se calculent avec la vitesse de ponte actuelle, chaque ligne arrondie à l'unité ; la durée réelle est affichée (« 23 h 58 »).
- **Rotations** (ajoutées le 2026-10-18 à la demande du joueur : « faire 10 fois sur 24 h ») : combien de fois les lignes se relaient dans la file, 1 par défaut. Avec 10, la file alterne JSN, JS, artilleuses, JSN, JS… dix fois, pour que les unités sortent mélangées tout au long de la ponte. En quantités fixes, les nombres sont ceux d'**une** rotation (pondue N fois) ; avec une cible, la cible couvre **toutes** les rotations, et le total de chaque ligne est réparti aussi également que les unités le permettent (les premières rotations prennent l'unité en trop). Une ligne vide dans une rotation n'est pas envoyée. Chaque rotation fait une ponte par ligne : 3 lignes × 10 rotations = 30 pontes, une par seconde.
- **Cibles** (mode répartition, et « Mettre à l'échelle » d'un modèle en quantités fixes, toutes les lignes par le même facteur) :
  - une **durée de ponte** du modèle lui-même (« 24 h ») ;
  - une **heure de fin** (« jusqu'à demain 8 h 00 »), après la file en cours ;
  - **ce que la nourriture paie maintenant**.
- **Parts** (mode répartition) : une part de **nombre d'unités**, pas de temps (« 10 : 5 » = deux fois plus de la première unité, quelle que soit sa durée de ponte) ; la colonne « Pondues » donne aussi le pourcentage des unités de chaque ligne. Des parts qui font 100 se lisent comme des pourcentages. Précisé le 2026-10-21 : un joueur, qui avait essayé avec la même unité sur toutes les lignes (où temps et nombre se confondent), croyait les parts en temps.
- **Coût** (demandé le 2026-10-21) : une colonne « Coût » (nourriture) dans la liste des modèles et dans les lignes de l'éditeur.
- **Gérer** : créer à la main ou « Créer depuis la file en cours » (les pontes de la file deviennent les lignes), renommer, dupliquer, réordonner les lignes, supprimer. Mémorisés par serveur, sur cet appareil, sans partage, sans limite de nombre.
- **Aperçu** avant le lancement : quantité par ligne, coût, durée, fin de ponte (après la file en cours), payable (maintenant / « dans 3 h 10 » / jamais), bilan de nourriture après entretien. Une ligne de **plus de 7 jours** n'est ni plafonnée ni coupée : un avertissement dit que le jeu pourrait la refuser.
- **Refus avant le lancement** (bouton désactivé, raison écrite) :
  - nourriture insuffisante pour tout le modèle : « payable dans … », et un bouton « Réduire à ce que vous pouvez payer » (même facteur pour toutes les lignes) ;
  - unité verrouillée sur ce serveur : la ligne montre l'exigence manquante (« Requis : … »).
  - Jamais de modèle lancé à moitié sans l'avoir voulu.
- **Lancement**, au clic seulement, jamais planifié (`roadmap.md`, « Actions de jeu ») :
  - le bouton récapitule (« Lancer 3 pontes : 160 unités, 24 h, 1,2 M de nourriture ») ; pas de boîte de confirmation en plus ;
  - une ponte par ligne, dans l'ordre des lignes : relecture de `Reine.php` pour un jeton `t` neuf, puis POST du formulaire du jeu ; 1 s entre deux ;
  - état par ligne ; arrêt au premier échec (jeton refusé, file pleine, nourriture qui a bougé), « Relancer le reste » ; tout parti : rechargement de la page.

## Inconnu

- La limite de la file de ponte du jeu (non affichée sur `Reine.php`), que les rotations atteindront plus vite. On la découvrira par un refus ; la noter dans `docs/research/fourmizzz-pages.md`.
- La réponse du jeu à une ponte de plus de 7 jours envoyée directement (le curseur s'arrête à 7 jours).
- La réponse du jeu à un POST refusé (le succès est vérifié le 2026-10-18 sur S2 : une ligne de plus dans la file, sans fusion avec la précédente).

## Code

| Fichier                                                             | Rôle                                                                                     |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `apps/extension/src/features/laying-templates/template.ts` (+ test) | Plan d'un modèle : quantités selon la cible, coût, durée, fins, payable, bilan, blocages |
| `apps/extension/src/features/laying-templates/pages.ts` (+ test)    | File de ponte de `Reine.php` → lignes de modèle                                          |
| `apps/extension/src/features/laying-templates/launch.ts` (+ test)   | Lancement : jeton neuf, POST, ponte vue dans la file renvoyée, arrêt au premier échec    |
| `apps/extension/src/features/laying-templates/storage.ts` (+ test)  | Modèles et état de l'encart, par serveur ; ce qui est illisible est écarté               |
| `apps/extension/src/features/laying-templates/LayingTemplates.tsx`  | L'encart (liste, éditeur, aperçu, état du lancement)                                     |
| `apps/extension/src/entrypoints/laying-templates.content/index.tsx` | Script dédié à `Reine.php` (React), monté avant le tableau des unités                    |

- Succès d'une ponte : la page renvoyée par le POST a une nouvelle dernière ligne de cette unité dans « Pontes en cours » (ou une dernière ligne de cette unité qui a grandi, au cas où le jeu fusionnerait, ce qu'il n'a pas fait sur S2).
- Coût et durée d'une unité : `ncaste` / `tcaste` (`packages/game/src/army/units.ts`, ouvrière : 5 de nourriture, 60 s) × la vitesse lue dans le script de la page.
- Tests vitest aux quatre interfaces ci-dessus (fixture `__fixtures__/reine.html`, fetch simulé, fakeBrowser). L'encart se vérifie dans le jeu (vérifié le 2026-10-18 sur S5, et lancé sur S2 : 100 JSN en Loge).
