# Promotions (XP) après une chasse

D'où vient la formule des promotions qu'utilise le moteur (`promotions` dans `src/game/army/combat.ts`, section « Promotions » de `chasse.md`), ce que chaque source en dit et ce que les rapports réels confirment. Recherche du 2026-10-18.

## Formule retenue

Sur une **victoire**, pour chaque type promouvable :

```
D = Σ proies × d                    (d : valeur d'une proie, prey.ts)
W = Σ unités envoyées × poids       (tous les types envoyés, élites comprises)
r = 13,2 × D / (W × √((1 + 0,1 Bouclier)(1 + 0,1 Armes)))
q = min(1, (1 + 0,1 × Étable à cochenilles) × r²)
promues(type) = arrondi inférieur(q × survivantes du type)
```

La formule du projet est **confirmée** sur les rapports réels. Elle est équivalente à celle du code : `min(floor(left), floor(share × left))` revient à plafonner `q` à 1. Deux réserves :

- l'Étable n'a jamais été vue ailleurs qu'au niveau 0 dans nos rapports ;
- il est probable que **Concierge → Concierge d'élite et Tank → Tank d'élite** soient aussi promouvables à la chasse, alors que le projet (et Zéro perte) les traite comme non promouvables (voir « Écarts »).

## Sources

- **Zzzelp** (flaviendelangle, 2014-2017, aucune licence dans le dépôt) : <https://github.com/flaviendelangle/Zzzelp>. Simulateur de combat **entre joueurs** côté serveur. C'est la source la plus ancienne de la forme de la formule et des poids :
  - `Class/Combat.php`, `get_RatioXP` : `ratio = (puissance adverse / notre puissance × 0,66)² × (1 + 0,1 cochenilles) × (1 + 0,1 Armes adverses)/(1 + 0,1 nos Armes) × (Bouclier et lieu adverses)/(1 + 0,1 notre Bouclier)` ;
  - `get_UnitesXP` : `(int)(survivantes × min(ratio, 1))` par type, pour JSN, SN, JS, S, **C**, A, **Tk**, Tu ;
  - `Class/Armee.php`, `get_PuissanceXP` : poids `85, 125, 170, 227, 312, 434, 592, 295, 349, 460, 642, 990, 909, 1000` dans l'ordre JSN … TuE, sur tous les types de l'armée.
- **Chasse à zéro perte** (<https://fourmizzz-zero-perte.pages.dev/>, auteur inconnu, aucune licence) : fonction `promotions` du script de la page, présentée comme la « règle exacte du simulateur officiel » (environ 30 000 relevés sur le serveur de test). C'est la formule du projet mot pour mot : mêmes poids, 13,2, cochenilles en facteur linéaire, plafond par `min(survivantes, …)`, survivantes en unités fractionnaires (« unités restantes en points de vie »), promotions JSN→SN, SN→NE, JS→S, S→SE, A→AE, Tu→TuE. La page n'a **aucun champ** Étable à cochenilles et n'affiche jamais les promotions : cette partie de son moteur n'a jamais servi.
- **Tutoriel officiel** (serveur de test, accessible sans compte) :
  - <https://test.fourmizzz.fr/tutorial.php?partie=tuto-combat> : les fourmis progressent « à l'intérieur de leur classe », l'expérience vient de « n'importe quel combat (chasse ou attaque) » et est « proportionnelle à sa difficulté » ;
  - <https://test.fourmizzz.fr/tutorial.php?partie=tuto-construction> : l'Étable à cochenilles augmente de 10 % par niveau le nombre d'unités militaires qui progressent.
- **Rapports de chasse** (texte du jeu, `docs/research/fourmizzz-pages.md`) : « Les unités survivantes ont appris de cette bataille : - 5 Jeunes Soldates Naines sont devenues des Soldates Naines ».
- **Calystene** (<http://alliancead2.free.fr>) :
  - le simulateur de chasse v2.00.38 (`Outils/Repository/HuntSimv2.00/CalysteneHuntingSimulator_LastVersion.user.js`) ne calcule **pas** les promotions ; il envoie en priorité les unités « Xp-ables » (`nXpPriorities` : Tu, **Tk**, A, **C**, S, JS, SN ; les JSN partent à part, comme tampon de pertes) ;
  - l'Analyseur de chasse (`Outils/Repository/HuntAnalyser_v0.00.11.html`) ne fait que lire les lignes « sont devenues » ;
  - l'Optimiseur d'Xp (`XP v1.04.xls`, 2013-2017, sans macros) porte sur l'XP des attaques avec une sonde et ne contient aucune formule de chasse.
- **Toolzzz** (<https://github.com/GuiEpi/toolzzz>, lu pour les idées, rien copié) : aucune formule de chasse. `ORDRE_XP_CHASSE` (`public/js/content.js`) reprend l'ordre de Calystene, Tk et C compris. `public/js/class/Combat.js` garde en commentaire la formule de combat de Zzzelp (« 0,66 », cochenilles) et promeut C→CE et Tk→TkE dans les rapports de combat (`ajouterXP`). Outiiil (<https://github.com/Hraesvelg/Outiiil>) a le même commentaire.
- **Forum** : le fil « Formule XP » (<https://fourmizzz.cforum.info/t13380-Formule-XP.htm>) et « l'XP » (`t5223`) ne s'affichent qu'une fois connecté ; pas lus.

## Chaque élément, sa source, sa confiance

| Élément                                                    | Valeur                                                                           | Source                                                                                             | Confiance                                                                                                                                                                                  |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Forme `q ∝ (D/W)²`                                         | carré du rapport puissance proies / puissance armée                              | Zzzelp (combat), Zéro perte (chasse)                                                               | **vérifiée sur rapports** (35/35, voir le rejeu)                                                                                                                                           |
| Coefficient                                                | 13,2                                                                             | Zéro perte. Remarque : 13,2 = 0,66 × 20, le 0,66 du combat chez Zzzelp                             | **vérifié** : les 7 rapports du 07/10 à niveaux connus l'encadrent dans [13,18 ; 13,62[                                                                                                    |
| Poids JSN / SN                                             | 85 / 125                                                                         | Zzzelp, Zéro perte                                                                                 | **vérifié** pour le rapport des deux : JSN fixé à 85, le poids SN doit tomber entre 83 et 127                                                                                              |
| Poids des 12 autres types                                  | 170 … 1 000                                                                      | Zzzelp, Zéro perte                                                                                 | **affirmé par deux sources**, Zéro perte les tenant sans doute de Zzzelp. Jamais vu sur rapport                                                                                            |
| W compte tous les types envoyés (élites, non promouvables) | oui                                                                              | Zzzelp (`get_PuissanceXP` sur les 14 types), Zéro perte                                            | **affirmé** ; nos rapports n'ont que JSN + SN                                                                                                                                              |
| Armes et Bouclier                                          | `1/((1 + 0,1 B)(1 + 0,1 A))` sur q                                               | Zzzelp (nos Armes et notre Bouclier au dénominateur ; les proies n'ont pas de niveaux), Zéro perte | **vérifiée** : le produit à A = B = 4 (07/10) ; ni sans facteur, ni avec un seul des deux (0/8) ; « Bouclier² seul » ou « Armes² seules » ne donnent aucun historique de Bouclier possible |
| Étable à cochenilles                                       | `× (1 + 0,1 E)` sur q, pas dans r                                                | Zzzelp, Zéro perte, tutoriel (« +10 % du nombre qui progresse »)                                   | **affirmée par trois sources concordantes**, **jamais vérifiée** (E = 0 partout)                                                                                                           |
| Plafond                                                    | q ≤ 1 (au plus toutes les survivantes)                                           | Zzzelp (`Majoration(ratio, 1)`), Zéro perte (`min(rem, …)`)                                        | **affirmé**, jamais atteint (q ≈ 0,003 dans nos rapports)                                                                                                                                  |
| Ordre plafond / Étable                                     | plafond après l'Étable                                                           | Zzzelp                                                                                             | **affirmé**                                                                                                                                                                                |
| Arrondi                                                    | inférieur, par type, par combat                                                  | Zzzelp (`(int)`), Zéro perte (`Math.floor`)                                                        | **vérifié** (arrondi au plus proche : 7/8 le 07/10 avec le Bouclier relevé)                                                                                                                |
| Survivantes comptées                                       | survivantes du type, blessées comprises (Zéro perte : en points de vie restants) | rapport (« Les unités survivantes ont appris »), Zzzelp (armée après combat), Zéro perte           | **affirmé**. Les rapports ne départagent pas « envoyées », « non tuées », « rentrées » et « fractionnaires » : 4 à 6 morts sur 2 000 changent q × n de moins de 0,02                       |
| Une seule promotion par combat                             | les JSN promues ne repassent pas SN→NE                                           | Zzzelp (chaque type calculé sur l'armée de fin, en parallèle), Toolzzz `ajouterXP`                 | **supposé** ; non testable ici (q × SN < 1)                                                                                                                                                |
| Types promouvables                                         | JSN→SN, SN→NE, JS→S, S→SE, A→AE, Tu→TuE (+ C→CE, Tk→TkE ?)                       | voir « Écarts »                                                                                    | **incertain** pour C et Tk                                                                                                                                                                 |
| Défaite                                                    | aucune promotion                                                                 | Zéro perte, projet                                                                                 | **supposé** (pas de rapport de défaite)                                                                                                                                                    |

## Rejeu sur les rapports réels

Fixture : `src/game/army/__fixtures__/hunt-reports.ts`, 35 combats du 05/10 au 07/10/26, **seulement JSN + SN**. Le test existant (`combat.test.ts`) ne rejoue les promotions que sur les 8 combats datés du 07/10, Bouclier 4. Pour ce rejeu, un test vitest temporaire a appelé `fight` (survivantes fractionnaires comme dans le code) pour chaque Bouclier de 0 à 6 ; le fichier a été supprimé ensuite.

Niveaux couverts :

- **Armes** (déduite du bonus du rapport) : 2 (05/10 14h11 → 20h26), 3 (05/10 21h01 → 06/10 20h01), 4 (06/10 20h49 → 07/10).
- **Bouclier** : 4, lu sur `laboratoire.php` le 07/10, inconnu avant.
- **Étable à cochenilles : 0 partout.** Le facteur Étable n'est donc pas vérifié du tout.
- Armée : 689 à 2 055 JSN et 35 à 140 SN ; q × survivantes entre 1,5 et 6,7 (1 à 6 promues).

Résultats :

- **Bouclier 4 sur les 8 combats du 07/10 : 8/8 exacts.** Celui de 00h42 tombe juste et colle aussi avec Bouclier 3. Le plus serré : 10h06, q × n = 5,015 pour 5 promues.
- **Sur les 35 combats : 35/35 exacts** avec un Bouclier qui ne fait que monter : 2 jusqu'au 05/10 22h53, 3 du 05/10 23h32 au 06/10 23h23, 4 au plus tard le 07/10 08h41 (00h42 : 3 ou 4). Avec un Bouclier fixe on n'a au mieux que 30/35 (Bouclier 3). C'est une **cohérence**, pas une preuve : l'historique du Bouclier est déduit, pas relevé. Plusieurs cas sont serrés (06/10 22h32 : 4,004 ; 09h09 : 3,009).
- Variantes rejetées :
  - sans facteur Armes / Bouclier : 0/8 le 07/10 ;
  - avec Bouclier seul ou Armes seules (puissance 1) : 0/8 ;
  - arrondi au plus proche : 7/8 le 07/10 avec le Bouclier relevé (4) ; il ne passe 8/8 qu'avec un Bouclier 5 que le laboratoire dément.
- Variantes qu'on ne peut pas départager (mêmes résultats partout) : survivantes = envoyées, non tuées, rentrées ou fractionnaires ; W sur toutes les unités ou sur les seules promouvables (ici les mêmes).
- Aucun rapport ne montre de ligne SN→NE, comme le prévoit la formule (q × 140 SN ≈ 0,4).

Les morts du rapport (« en tue N ») contredisent parfois l'historique du Bouclier ci-dessus (05/10 20h26, 06/10 00h24). C'est une limite du décompte des morts (`reportedDead`), pas des promotions.

## Écarts entre sources

- **Concierge et Tank.** Zéro perte et le projet (`promotesTo: null` pour C et Tk dans `units.ts`) ne les promeuvent pas. Trois sources disent le contraire :
  - Zzzelp les promeut au combat (indices 5 et 10 de `get_UnitesXP`) ;
  - Toolzzz, dans ses rapports de combat (`tableXP`) ;
  - Calystene et Toolzzz les classent « Xp-ables » pour la chasse.

  Le tutoriel dit que l'XP vient de « n'importe quel combat (chasse ou attaque) ». Et la Concierge d'élite et le Tank d'élite ne se pondent pas (absents de la Reine) : la promotion est le seul moyen de les avoir. **Il est probable que C→CE et Tk→TkE existent aussi à la chasse.** Zéro perte n'affiche aucune promotion : son `PROMO_TO` n'a sans doute jamais été confronté à un relevé.

- **Coefficient** : 13,2 (Zéro perte) contre 0,66 au combat (Zzzelp). Ce ne sont pas les mêmes unités : au combat, la puissance adverse se mesure avec les mêmes poids que la nôtre ; à la chasse, avec la valeur `d` des proies. Si une proie pesait 20 × d, les deux reviendraient au même. Ce n'est qu'une hypothèse, mais elle explique le 13,2.
- **Niveaux de l'adversaire** : au combat, Zzzelp multiplie par les Armes et le Bouclier (et le lieu) de l'adversaire. Les proies n'en ont pas, d'où le seul facteur `1/((1 + 0,1 A)(1 + 0,1 B))`.
- **Calystene** ne donne aucune formule de promotion de chasse. Il ne contredit rien, mais ne confirme rien non plus.

## Ce qu'il faudrait changer

La formule de `promotions` et la section « Promotions » de `chasse.md` sont justes. À faire, sans urgence :

1. `docs/research/chasse.md`, section « Promotions » :
   - remplacer « Vérifié sur les 7 rapports du 07/10 » par « 8 combats du 07/10 (Bouclier 4) ; 35/35 avec Bouclier 2 → 3 → 4 au fil des 05-07/10, niveaux antérieurs déduits » ;
   - écrire le plafond `q ≤ 1` ;
   - préciser que l'Étable n'est vérifiée qu'à 0 ;
   - citer Zzzelp comme source d'origine des poids et de la forme ;
   - renvoyer à ce fichier.
2. `src/game/army/units.ts` (pas `combat.ts`) : passer `promotesTo` de C à `"CE"` et de Tk à `"TkE"` **une fois qu'un rapport l'aura confirmé** (voir plus bas). `promotions` n'a pas à changer, elle suit `promotesTo`. Les poids de C et Tk comptent déjà dans W.
3. `src/game/army/units.ts`, commentaire d'en-tête : les poids viennent de Zzzelp (`Armee.php`, `get_PuissanceXP`), repris par Zéro perte.
4. Le test des promotions (`combat.test.ts`) pourrait couvrir les 35 combats avec l'historique de Bouclier ci-dessus, en le présentant comme déduit.

## Faut-il chercher à optimiser l'XP ? (mesures du 2026-10-18)

Simulations d'Optizzz (moteur de `src/features/hunt-launcher/engine/`, formule ci-dessus, Étable extrapolée au-delà de 0) sur 408 situations : armées de 1 000 à 5 millions de fourmis (JSN seules, début, milieu, tanks, tueuses), TdC de 1 000 à 5 millions de cm², niveaux bas (A2 B2 É0) à hauts (A20 B20 É15), et Étable 20.

- **Baisser le ratio** : en nourriture, les promotions en plus ne couvrent jamais les pertes en plus (médiane 16 % en niveaux bas, 49 % avec Étable 20, en passant de 8 à 7 ; moins encore plus bas). En temps de ponte, seul le passage de 8 à 7 s'équilibre, avec Étable 15–20 et une armée de JSN.
- **Une chasse au lieu de plusieurs** : +70 % de promotions vers 1 000 fourmis (l'arrondi par chasse), rien au-delà de 100 000 ; moins de cm² par heure.
- **Répartition par vagues de Calystene** (486 situations à 2 chasses ou plus) : promotions totales ×1,01 en médiane, +8 à +11 % pour les armées de milieu de jeu et de tueuses, pertes en JSN inchangées. Au ratio 5, son tampon (2 × pertes max de ses tables) laisse abîmer tanks et tueuses sous la règle de la demi-vie dans ~ 50 % des cas ; le lanceur cherche donc le tampon par simulation (`engine/waves.ts`).
- **Séparer tanks et JSN** : 4 à 5 fois moins de promotions et 40 % de pertes en plus, faute de JSN devant les tanks.

## Ce qui reste inconnu, et quoi relever

Pour chaque rapport, noter le jour même Armes, Bouclier et Étable à cochenilles (`laboratoire.php`, `construction.php`).

- **Étable à cochenilles > 0** (priorité) : n'importe quelle chasse gagnée, avec beaucoup de promues (petite armée bien au-dessus de la difficulté, gros q × n). On pourra alors distinguer `× (1 + 0,1 E)` d'un facteur dans r (`× (1 + 0,1 E)²`). Mieux encore : deux chasses identiques avant et après un niveau d'Étable.
- **Armes ≠ Bouclier, connus** : séparer les deux exposants. Le 07/10 (4 et 4) ne mesure que leur produit.
- **Concierges ou Tanks à la chasse** : une chasse avec quelques centaines de Tanks ou de Concierges, en assez petit nombre pour que q × n dépasse 1. On saura s'il apparaît une ligne « Tanks sont devenues des Tanks d'élite ».
- **Élites ou autres types envoyés** (TuE, AE, NE…) : vérifier leur poids dans W, et les poids des types promouvables (JS, S, A, Tu).
- **Grosse armée, grand q** : chasses où q × n vaut plusieurs centaines, pour tester le 13,2 et l'arrondi plus finement que notre intervalle [13,18 ; 13,62[.
- **SN→NE ou S→SE en nombre** : savoir si des unités promues dans le combat peuvent l'être une seconde fois (une JSN qui finirait NE), en comparant les lignes du rapport à l'armée avant et après.
- **Survivantes blessées** : seule une chasse à grosses pertes par rapport à l'armée (beaucoup de blessées) départagera « survivantes fractionnaires » et « non tuées ».
- **Plafond q = 1** : une très petite armée qui gagne de justesse ; à voir si toutes les survivantes sont promues.
