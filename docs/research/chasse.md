# Chasse : mécaniques et validation

Ce qu'on sait du déroulement d'une chasse, d'où on le tient, et ce que les rapports réels confirment. Le moteur du lanceur (`src/features/hunt-launcher/engine/`) suit ce document.

Sources :

- **Calystene**, simulateur de chasse v2.00.38 (userscript, 2014-2024, aucune licence) : <http://alliancead2.free.fr/Outils/Repository/HuntSimv2.00/Simulator_2.00.00.html>. On lui doit la formule de difficulté et les **tables de pertes** par ratio (statistiques sur plus de 1 500 chasses simulées par ratio), reprises en citant la source.
- **Chasse à zéro perte** (<https://fourmizzz-zero-perte.pages.dev/>, auteur inconnu, aucune licence) : reconstruction du simulateur officiel à partir d'environ 30 000 relevés sur le serveur de test (tirage des proies, combat, promotions). Résumé détaillé : `bot-fourmizzz/research/fourmizzz-zero-perte.md`. Les règles sont réécrites ici, pas le code.
- **Rapports réels** : 35 combats de chasse sur s5, du 05/10/26 au 07/10/26 (JSN + SN), relevés dans la messagerie. Fixture : `src/features/hunt-launcher/__fixtures__/hunt-reports.ts`.

## Difficulté

Le TDC est celui **au moment du combat** (pas au lancement) ; sous 50 cm², le jeu compte 50.

```
palier(tdc)          = 1,04 ^ arrondi(10 × log10(max(tdc, 50) / 50))
difficulté(tdc, s)   = (s + max(tdc, 50) × 0,01) × palier(tdc) × 3
nourriture visée     = 0,8 × difficulté
```

- Le palier monte de 4 % chaque fois que le TDC est multiplié par 10^0,1 ≈ 1,259.
- Plusieurs chasses lancées ensemble ont la même durée ; elles reviennent dans l'ordre du lancement et la n-ième combat au TDC laissé par les précédentes : `tdc + (n − 1) × s` pour des surfaces égales.
- **Vérifié** : rapport du 07/10 11h08, 118 cm², « les carcasses rapportent 794 » ; TDC au combat reconstitué = 3 886 (4 496 aujourd'hui moins les gains revenus depuis) → nourriture visée = 793,1. L'écart d'une unité vient du tirage des proies (ci-dessous) ou d'un TDC à quelques cm² près.

## Durée

`secondes = arrondi((tdc au lancement + s) × 0,9 ^ Vitesse de chasse)`. Nombre de chasses simultanées : `Vitesse de chasse + 1`.

## Proies

Valeur `d` d'une proie = `√(vie × dégâts) / 1,1` arrondie à 0,05 ; nourriture = 0,8 × d. Tirage (règle reconstituée par Zéro perte) : tant qu'il reste de la nourriture à couvrir, un type au hasard parmi les 17, un pourcentage entre 45 et 75 de la nourriture visée, autant de proies de ce type que ça couvre (limité au reste) ; si le type ne rentre pas une fois, un paquet de petites araignées valant 5 % du total.

| Proie            | Dégâts    | Vie       |
| ---------------- | --------- | --------- |
| Petite araignée  | 13        | 50        |
| Araignée         | 19        | 75        |
| Chenille         | 30        | 100       |
| Criquet          | 42        | 100       |
| Guêpe            | 50        | 140       |
| Cigale           | 70        | 200       |
| Abeille          | 115       | 220       |
| Dionée           | 70        | 700       |
| Hanneton         | 140       | 450       |
| Scarabée         | 230       | 1 000     |
| Mante religieuse | 1 200     | 800       |
| Lézard           | 700       | 5 000     |
| Souris           | 1 400     | 5 000     |
| Mulot            | 3 000     | 8 000     |
| Alouette         | 10 000    | 30 000    |
| Rat              | 50 000    | 100 000   |
| Tamanoir         | 1 000 000 | 5 000 000 |

- Les rapports montrent des petites chasses (≈ 80-125 cm² à ≈ 3 900 cm² de TDC) faites de 4 à 40 proies des 10 premiers types, ce qui va dans le sens de ce tirage.

## Combat

- Chaque tour, les deux camps frappent avec l'attaque de leurs survivants (unités fractionnaires : vie restante / vie d'une unité). Les dégâts s'appliquent **dans l'ordre des listes** : proies dans l'ordre du tableau ci-dessus, nos unités dans l'ordre JSN, SN, NE, JS, S, C, CE, A, AE, SE, Tk, TkE, Tu, TuE. Les premières de la liste encaissent tout.
- Attaque × (1 + 0,1 × Armes), vie × (1 + 0,1 × Bouclier).
- **Surpuissance au premier tour** : si notre attaque dépasse la vie totale des proies, leurs dégâts sont multipliés par 0,1 (rapport > 3), 0,3 (> 2), 0,5 (> 1,5).
- Victoire si toutes les proies sont mortes et qu'il nous reste quelqu'un. En cas de défaite, toute l'armée envoyée est perdue.
- **Vérifié** (`engine/combat.test.ts`, Armes déduites du bonus affiché : « 6 358 (+ 2 544) » = Armes 4) :
  - sur les 35 rapports : notre attaque affichée = Σ effectif × attaque, bonus = × 0,1 × Armes **arrondi au supérieur** ; « L'ennemie inflige N » = dégâts bruts des proies × la surpuissance, **arrondis au supérieur** (07/10 11h08 : 43 petites araignées × 13 = 559 → × 0,1 = 55,9 → « 56 ») ;
  - sur les 7 rapports du 07/10 (Bouclier connu) : « en tue N » = **arrondi inférieur** de dégâts / vie d'une JSN avec Bouclier (55,9 / 11,2 = 4,99 → 4) : le rapport ne compte que les unités tombées à 0.
- **Pertes réelles** (Zéro perte, d'après des joueurs du jeu réel ; non vérifiable dans les rapports) : une unité qui a perdu **plus de la moitié** de sa vie ne rentre pas, même si le rapport dit « 0 tuée ». Le lanceur compte les pertes ainsi (prudent) et affiche aussi le chiffre du rapport.

## Promotions

Sur une victoire, chaque type promouvable (JSN→SN, SN→NE, JS→S, S→SE, A→AE, Tu→TuE) gagne `arrondi inférieur(q × survivants du type)` avec :

```
D = Σ proies × d          W = Σ unités envoyées × poids
r = 13,2 × D / (W × √((1 + 0,1 Bouclier)(1 + 0,1 Armes)))
q = (1 + 0,1 × Étable à cochenilles) × r²
```

Poids : JSN 85, SN 125, NE 170, JS 227, S 312, C 434, CE 592, A 295, AE 349, SE 460, Tk 642, TkE 990, Tu 909, TuE 1 000.

- **Vérifié** sur les 7 rapports du 07/10 ; par exemple 11h08, 1 921 JSN + 119 SN contre 43 petites araignées, Armes 4, Bouclier 4, cochenilles 0 → q × 1 916 survivantes = 5,3 → « 5 Jeunes Soldates Naines sont devenues des Soldates Naines ». Les SN envoyées à la chasse suivante (124 = 119 + 5) le confirment.
- Envoyer moins d'unités augmente la part promue (`q` varie comme 1/W²).

## Pertes selon Calystene (recoupement)

`pertes = coef[ratio] × difficulté / (10 + Bouclier) × 10`, en JSN, avec `ratio = attaque avec Armes / difficulté` et le ratio de référence = le plus grand de la liste ≤ ratio réel.

| Ratio             | 1   | 2   | 3   | 4   | 5   | 6    | 6,5  | 7    | 7,5  | 8    | 8,5  | 9   | 10   |
| ----------------- | --- | --- | --- | --- | --- | ---- | ---- | ---- | ---- | ---- | ---- | --- | ---- |
| Réplique 10 % (%) | 0   | 0   | 0   | 1,6 | 9,3 | 34,5 | 57,8 | 75,3 | 83,7 | 87,4 | 93,7 | 96  | 98,9 |

Coefficients min / moyen / max : `src/features/hunt-launcher/engine/calystene.ts`. Les tables ignorent la composition de l'armée et la règle de la demi-vie ; on les affiche en petit pour voir si les deux modèles divergent.

## Ce que ça change pour le joueur

- **Chasser à zéro perte ne vaut pas le coup.** Les JSN encaissent en premier ; le terme fixe `0,01 × TDC` de la difficulté (45 cm² à 4 500 cm²) attire des proies qui en blessent une à plus de la moitié de sa vie, même pour 1 cm². Mesure du moteur (Armes = Bouclier = 4, Vitesse de chasse 3, 4 créneaux), en cm²/h :

  | TDC    | Armée                   | Zéro perte | Zéro perte 9 fois sur 10 | 1 % de pertes         |
  | ------ | ----------------------- | ---------- | ------------------------ | --------------------- |
  | 500    | 2 112 JSN + 146 SN      | 481        | 481                      | 2 515                 |
  | 500    | 3 000 Tueuses           | 2 908      | 3 249                    | 13 178                |
  | 4 496  | 2 112 JSN + 146 SN      | 0          | 0                        | 184                   |
  | 4 496  | 300 Tanks + 100 Tueuses | 9          | 34                       | 344                   |
  | 4 496  | 3 000 Tueuses           | 87         | 122                      | 2 789                 |
  | 4 496  | 20 000 JSN + 2 000 Tk   | 0          | 0                        | 3 605                 |
  | 50 000 | toutes                  | 0          | 0                        | > 0 si l'armée suffit |

  Le lanceur n'a donc pas d'objectif « zéro perte ».

- Pour la même raison, **une grosse chasse vaut souvent mieux que plusieurs petites** : chaque chasse paie ce terme fixe. Le lanceur compare tous les nombres de chasses et garde celui qui rapporte le plus de cm² par heure.
- Les pertes simulées et les tables de Calystene concordent : 1 chasse de 136 cm² à 4 496 cm² avec 2 112 JSN + 146 SN → 7,4 JSN perdues (simulation) contre 8,4 (Calystene).

## À vérifier

- La règle de la demi-vie (pertes fantômes) sur un vrai compte : comparer l'armée avant/après sans ponte entre les deux.
- La question « chasse si longue ? » (`validation_chasse_longue`) : le POST direct de l'armée ne passe pas par elle ; la limite de durée qui la déclenche n'est pas connue.
