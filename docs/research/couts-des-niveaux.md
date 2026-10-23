# Coûts et durées des niveaux

Ce que coûte et dure chaque niveau d'un bâtiment ou d'une recherche, **hors bonus** (Architecture et Salle d'analyse à 0). Table du code : `packages/game/src/level-costs.ts` (`LEVEL_BASES`, `levelCost`, `levelsCost`), seule source des croissances d'un niveau à l'autre : les features partent de la ligne affichée (bonus compris) et lui appliquent le rapport de la table (`levelsFrom`, `levelsAhead`, `levelTimeRatio`).

## Sources

- **Toolzzz** (`https://www.toolzzz.fr/couts.php`, sans Architecture), relevé le **2026-10-23** : pour chaque bâtiment et recherche, niveaux 1 à 50, l'infobulle de chaque case (`<b>Nom&nbsp;N</b>`) donne la « Durée totale » et les « Coût total » cumulés (img `alt` `nou`, `mat`, `ouv`) ; la case montre la durée et le coût du niveau seul. Source de données seulement, aucun code repris.
- **Le jeu**, relevé le **2026-10-23** sur S5 et S2, en lecture seule (GET de `construction.php` et `laboratoire.php`, rien envoyé) : la ligne de chaque bâtiment ou recherche donne le coût et la durée du prochain niveau, bonus du joueur compris (S5 : Architecture 10, Salle d'analyse 7 ; S2 : Architecture 20, Salle d'analyse 19).

## Niveau 1

| Bâtiment               | Matériaux | Durée             |
| ---------------------- | --------: | ----------------- |
| Champignonnière        |        90 | 2m 0s (120 s)     |
| Entrepôt de Nourriture |       600 | 3m 0s (180 s)     |
| Entrepôt de Matériaux  |       600 | 3m 0s (180 s)     |
| Couveuse               |       600 | 3m 0s (180 s)     |
| Solarium               |     2 000 | 16m 40s (1 000 s) |
| Laboratoire            |     1 400 | 5m 0s (300 s)     |
| Salle d'analyse        |     1 400 | 5m 0s (300 s)     |
| Salle de combat        |       300 | 2m 0s (120 s)     |
| Caserne                |       800 | 3m 20s (200 s)    |
| Dôme                   |     3 500 | 6m 40s (400 s)    |
| Loge Impériale         |     5 000 | 8m 20s (500 s)    |
| Étable à pucerons      |     1 500 | 8m 20s (500 s)    |
| Étable à cochenilles   |    10 000 | 2m 30s (150 s)    |

Les bâtiments ne coûtent que des matériaux.

| Recherche                      | Ouvrières | Nourriture |  Matériaux | Durée                  |
| ------------------------------ | --------: | ---------: | ---------: | ---------------------- |
| Technique de ponte             |         0 |        120 |        120 | 2m 0s (120 s)          |
| Bouclier Thoracique            |        80 |        200 |        300 | 2m 0s (120 s)          |
| Armes                          |        80 |        300 |        200 | 2m 0s (120 s)          |
| Architecture                   |         0 |        100 |        200 | 3m 20s (200 s)         |
| Communication avec les animaux |        80 |        200 |        500 | 2m 0s (120 s)          |
| Vitesse de chasse              |        50 |      4 000 |      2 500 | 3m 20s (200 s)         |
| Vitesse d'attaque              |         0 |      3 000 |      1 000 | 3m 20s (200 s)         |
| Génétique                      |     1 000 |      3 000 |     10 000 | 3m 0s (180 s)          |
| Acide                          |     5 000 |    100 000 |    300 000 | 2H 46m 40s (10 000 s)  |
| Poison                         |   250 000 | 40 000 000 | 15 000 000 | 13H 53m 20s (50 000 s) |

Recoupé dans le jeu : les niveaux 1 que S5 et S2 montrent (Caserne, Dôme, Loge, Étables, Armes, Communication, Génétique, Acide, Poison) ont ces coûts, et leurs durées × 0,9 par niveau d'Architecture ou de Salle d'analyse (Génétique 1 : 180 s × 0,9⁷ = 1m 26s sur S5 ; Poison 1 : 50 000 s × 0,9⁷ = 6H 38m 35s).

## D'un niveau au suivant

- **Coût** : × 2, sauf la **Champignonnière** : × 1,85, et le jeu **tronque** chaque niveau à l'unité : coût du niveau N = ⌊90 × 1,85^(N−1)⌋ (90, 166, 308, 569, 1 054…). Vu dans le jeu : niveau 9 = 12 348 (fixture `construction-costs.html`), 17 = 1 694 299 (S5), 18 = 3 134 453 (S2) ; un arrondi donnerait 12 349 et 3 134 454. Toolzzz arrondit ses cumuls, si bien que ses coûts par niveau de Champignonnière (différences de cumuls) sont parfois d'une unité au-dessus (167 au niveau 2, 3 134 454 au 18).
- **Durée** : × 1,6 pour un bâtiment, × 1,7 pour une recherche, puis × 1,3, × 1,2 et × 1,12 à partir des niveaux ci-dessous (Toolzzz). Le jeu applique son bonus (× 0,9 par niveau d'Architecture ou de Salle d'analyse) à la durée non arrondie, puis **arrondit à la seconde** (Champignonnière 17 sur S5 : 221 360,9 s × 0,9¹⁰ = 77 183,8 → 21H 26m 24s).

| Bâtiment ou recherche                     | × 1,3 dès | × 1,2 dès | × 1,12 dès |
| ----------------------------------------- | --------: | --------: | ---------: |
| Champignonnière                           |        24 |        32 |         38 |
| Entrepôts, Couveuse                       |        23 |        31 |         37 |
| Solarium                                  |        19 |        27 |         34 |
| Laboratoire                               |        22 |        30 |         36 |
| Salle d'analyse                           |        22 |        30 |          — |
| Salle de combat                           |        24 |        31 |          — |
| Caserne                                   |        22 |        31 |          — |
| Dôme                                      |        21 |        29 |          — |
| Loge Impériale                            |        20 |        29 |          — |
| Étable à pucerons                         |        20 |        31 |          — |
| Étable à cochenilles                      |        23 |        31 |          — |
| Technique de ponte                        |        21 |        29 |         36 |
| Architecture                              |        20 |        29 |         35 |
| Bouclier, Armes, Communication, Génétique |        21 |        29 |          — |
| Vitesse de chasse, Vitesse d'attaque      |        20 |        29 |          — |
| Acide                                     |        13 |        29 |          — |
| Poison                                    |         — |         — |          — |

- Le **× 1,3** tombe au niveau qui suit le premier niveau de plus de 30 jours (2 592 000 s hors bonus), pour tous sauf le Poison, que Toolzzz laisse à × 1,7 jusqu'à son niveau 20. **Vérifié dans le jeu sur S2** : Solarium 20 (7J 27m 4s), Architecture 21 (7J 10H 21m 43s), Technique de ponte 21 (5J 19H 56m 44s), tous au-delà du premier × 1,3.
- Les **× 1,2 et × 1,12** ne suivent ni une durée ni un écart de niveaux communs (Salle d'analyse sans × 1,12 alors que le Laboratoire, de même base, l'a) : repris de Toolzzz tels quels, **pas vérifiés dans le jeu** (aucun compte relevé n'en est là).
- Toolzzz s'arrête avant 50 pour quelques-uns : Étable à pucerons 48, Étable à cochenilles 41, Génétique 47, Acide 30, Poison 20. Ce sont peut-être les niveaux maximaux du jeu ; non vérifié. La table d'Optizzz calcule au-delà sans limite.
- Cumul d'un niveau à un autre : somme des niveaux (coûts tronqués un à un, comme le jeu les fait payer). Toolzzz additionne des durées déjà arrondies : ses « Durée totale » peuvent différer de quelques secondes.

## Recoupement

Le 2026-10-23, `levelCost` a été comparé aux 1 086 niveaux de Toolzzz (23 bâtiments et recherches) : coûts et durées à une unité près partout (l'écart d'une unité : les arrondis de Toolzzz décrits plus haut). Les tests (`level-costs.test.ts`) gardent des niveaux témoins de Toolzzz et du jeu, Champignonnière comprise.
