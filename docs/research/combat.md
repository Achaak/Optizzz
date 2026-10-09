# Combat entre joueurs : règles et sources

Ce que le simulateur de combat (`src/game/army/battle.ts`) suppose, d'où ça vient, et ce qui n'est pas vérifié. Le combat de chasse, vérifié sur de vrais rapports, est dans `chasse.md`.

## Sources

- **Tutoriel officiel** « Les Combats » et « Attaque & Défense » (`tutorial.php?partie=tuto-combat`, `tuto-attaque-defense`, lus le 2026-10-07).
- **Reine.php** (s5, 2026-10-07) : vie / attaque / défense de chaque unité.
- **Calystene** (`http://alliancead2.free.fr/Scripts/Utilities_CArmy.js`) : tables vie / attaque / défense des 14 unités. Seule source pour la Concierge d'élite et le Tank d'élite, absents de la Reine.
- **Outiiil** de Hraesvelg (v1.3.7, recensé sur `http://alliancead2.free.fr/public.php`) : mêmes tables, calcul des bonus de vie, lecture des rapports de combat. Chiffres et règles relus, pas de code repris.

## Unités

| Unité               | Vie | Attaque | Défense | Source                                         |
| ------------------- | --- | ------- | ------- | ---------------------------------------------- |
| Jeune Soldate Naine | 8   | 3       | 2       | Reine                                          |
| Soldate Naine       | 10  | 5       | 4       | Reine                                          |
| Naine d'Elite       | 13  | 7       | 6       | Reine                                          |
| Jeune Soldate       | 16  | 10      | 9       | Reine                                          |
| Soldate             | 20  | 15      | 14      | Reine                                          |
| Concierge           | 30  | 1       | 25      | Reine                                          |
| Concierge d'élite   | 40  | 1       | 35      | Calystene, Outiiil                             |
| Artilleuse          | 10  | 30      | 15      | Reine                                          |
| Artilleuse d'élite  | 12  | 35      | 18      | Reine                                          |
| Soldate d'élite     | 27  | 24      | 23      | Reine                                          |
| Tank                | 35  | 55      | 1       | Reine, Outiiil (Calystene : 30 de vie, ancien) |
| Tank d'élite        | 50  | 80      | 1       | Calystene, Outiiil                             |
| Tueuse              | 50  | 50      | 50      | Reine                                          |
| Tueuse d'élite      | 55  | 55      | 55      | Reine                                          |

## Règles

- Coups simultanés (tutoriel). L'attaquant frappe avec ses dégâts **en attaque**, le défenseur avec ses dégâts **en défense** ; Armes : +10 % par niveau sur les deux.
- Vie : +10 % par niveau de Bouclier ; le défenseur ajoute le bonus du lieu, **sur la vie** (Outiiil, forum ; le tutoriel dit « de défense ») : TDC 0, Fourmilière 10 % + 5 % par niveau de Dôme, Loge 30 % + 15 % par niveau de Loge. Les bonus s'additionnent (vie × (1 + 0,1 × Bouclier + lieu)).
- Les plus faibles meurent en premier, dans l'ordre de la ponte (tutoriel).
- Surpuissance au premier coup : 1,5 / 2 / 3 fois la vie des défenseurs → riposte à 50 / 30 / 10 % (tutoriel).
- Lieux : attaquer la Fourmilière passe d'abord par le TDC ; la Loge, par le TDC puis la Fourmilière (tutoriel). Les survivants passent d'un lieu au suivant.
- Gains : TDC, 20 % du TDC adverse, 1 cm² par fourmi au plus ; Fourmilière, 30 % + 1 % par niveau d'étable à pucerons de la nourriture et des matériaux, 1 ressource par point d'attaque survivant au plus, plus le TDC ; Loge, la colonie (tutoriel).
- Portée : TDC adverse entre 50 % et 300 % du sien (tutoriel) ; 50 % inclus, 300 % exclu d'après les bornes préremplies d'`ennemie.php` (5 055 → 2 528 à 15 164). Revérifiée avant chaque attaque d'une série, les deux TDC bougeant (Toolzzz).
- Attaques simultanées : Vitesse d'attaque + 1, moins les attaques en route. **Vérifié le 2026-10-08** sur le simulateur de flood du jeu (`simulateurFlood.php`, Compte+) : champs cachés `joueur0VA = 4` et `joueur0attaquesDispo = 5` sans attaque en cours ; son aide parle de « la limite de votre vitesse d'attaque ». (Toolzzz, `Attaquer.js`, compte `niveau + 2 − lignes « Vous allez attaquer »`, sans doute avec une ligne d'en-tête.) L'aide des recherches ne parle, elle, que du temps de trajet (−10 % par niveau, attaques et convois).
- Lieu visé (aide « Attaque & Défense ») : attaquer la Fourmilière, c'est d'abord attaquer le TDC ; attaquer la Loge, c'est attaquer le TDC, puis la Fourmilière, puis la Loge. Une attaque sur la Fourmilière ou la Loge prend donc aussi du TDC si elle gagne sur le TDC.
- Prise sur le TDC : Toolzzz calcule `min(fourmis envoyées, floor(TDC adverse × 0,2))` ; « par fourmi » = fourmis envoyées ou survivantes, non tranché. Le forum officiel est privé (connexion requise), non consulté.

## Supposé, à vérifier sur un vrai rapport ([#1](https://github.com/Achaak/Optizzz/issues/1))

- **Tours** : on reprend le moteur de la chasse (tours jusqu'à la chute d'un camp). Outiiil lit des rapports d'attaque à plusieurs échanges « Vous infligez … et tuez … », ce qui va dans ce sens.
- La riposte sur le TDC, « plus dure » selon le forum, sans formule connue : traitée comme ailleurs.
- Fourmis mortes : celles tombées à 0 ; pas de règle de la demi-vie (vue en chasse seulement). Un camp vaincu perd tout ce qui a combattu.
- Plafond de TDC compté sur les fourmis **survivantes** ; plafond de pillage partagé au prorata entre nourriture et matériaux.
- Une attaque de la Loge rapporte-t-elle aussi le TDC et le pillage des lieux traversés ? Le simulateur n'affiche que la colonie.
- Promotions en combat entre joueurs : formule inconnue, non simulées.
