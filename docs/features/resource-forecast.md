# Feature : Prévisions de ressources

Décidé lors d'une session de cadrage (`/grill-me`) le 2026-10-07. Faits du jeu : `../research/ressources-et-entretien.md`.

## But

Savoir quand on pourra payer un bâtiment ou une recherche, quand on tombera en famine ou quand un entrepôt sera plein, et tester une autre répartition des ouvrières avant de la valider.

## Modèle commun (logique pure, testée)

- **Stocks** : `div#data` (valeurs exactes, nourriture décimale).
- **Taux par jour** lus sur `Ressources.php` :
  - récolte nourriture et matériaux, **par paquets** toutes les 30 min à partir de `reste(…, "retour_ouvrieres")` ;
  - champignonnière moins armée, **en continu** (l'armée en déplacement est déjà comptée) ;
  - taxe de colonie `pourcentagePillage` quand elle est présente, sur la récolte et la champignonnière.
- **Chasses en cours** : à leur retour, le TDC gagné met au travail des ouvrières sans travail (min(gain, ouvrières sans travail)). Avec Compte+, elles vont selon `choixOuvriere` ; sans, elles restent sans travail.
- **Capacités des entrepôts** : lues sur `construction.php` (« Capacité actuelle »). Le stock ne dépasse jamais la capacité.
- **Sources** : `Ressources.php` rechargée en arrière-plan à chaque affichage de Construction et Laboratoire ; ailleurs, cache de moins de 15 min (mémorisé par serveur), relu en arrière-plan sinon. Une page relue au même moment par une autre feature n'est lue qu'une fois (`apps/extension/src/utils/game-page.ts`). Sans revenus lisibles ni mémorisés (session expirée, maintenance), rien n'est affiché (avertissement en console seulement).

## 1. Délais sur Construction et Laboratoire

- Une ligne sous la description de chaque élément pas encore payable (la colonne des coûts est trop étroite), en texte normal : « ⏳ Disponible dans 3 h 12 (aujourd'hui 18 h 40) · manque 12 400 matériaux ».
- Avec Compte+, le jeu affiche déjà le temps avant de pouvoir payer (icône horloge, `horloge.png`, dans le tableau des coûts) : notre ligne ne donne alors que l'heure et ce qui manque, « ⏳ Disponible aujourd'hui 18 h 40 · manque 12 400 matériaux », sans deuxième décompte arrondi autrement.
- Cas particuliers :
  - ouvrières manquantes (recherches) : « Il manque N ouvrières », sans délai ;
  - coût au-delà de la capacité : « Entrepôt trop petit (capacité X) » ;
  - solde de nourriture négatif et nourriture manquante : « jamais au rythme actuel ».
- **File d'attente** (lue par `work-queue`) : un élément mis en file est payé tout de suite. Place libre → délai des ressources. File pleine (ou, sans Compte+, un chantier en cours) → max(ressources, fin du **premier** élément de la file), avec ce qui bloque : « Disponible dans 3 h 12 (aujourd'hui 18 h 40) · file pleine ».
- Chaque élément est calculé seul, à partir du stock actuel, une seule fois au chargement ; seul le décompte est rafraîchi à la minute.

## 2. Famine et entrepôt plein (en-tête, toutes les pages)

- Sous la jauge de nourriture : « Famine dans 9 h 32 », sinon « Entrepôt plein dans 4 h », sinon le solde « Solde : +3 223 / jour » ; sous la jauge des matériaux : « Entrepôt plein dans … ».
- Couleurs : neutre au-delà de 24 h, orange en dessous de 24 h, rouge en dessous de 6 h (`apps/extension/src/utils/urgency.ts`, la même échelle que le simulateur et le badge des Alertes).
- Infobulle (toujours présente), une ligne par information : solde par jour (détail récolte, champignonnière, armée, taxe), ouvrières à mettre sur la nourriture pour rester à l'équilibre, « Capacité des entrepôts inconnue : ouvrez Construction… » tant que Construction n'a pas été lue (pas d'alerte d'entrepôt plein sans elle), retours de chasse prévus. C'est une infobulle d'Optizzz : celle du jeu (jQuery UI, sur la cellule de la jauge) aplatissait les lignes, elle ne s'ouvre plus au-dessus de notre ligne.

## 3. Répartition des ouvrières sur Ressources

Retravaillée le 2026-10-19 : le formulaire du jeu et son résumé en prose (« Chaque jour, vous récoltez… ») étaient redondants avec la simulation, qui n'était pas assez claire.

- Le panneau « Répartition des ouvrières » **remplace** dans la boîte Récoltes le formulaire du jeu et son résumé : ils sont masqués (classe `optizzz-harvest-replaced`), pas retirés. « Afficher le formulaire du jeu » les remontre. Couper l'option rend la page du jeu intacte.
- **Curseur** : nourriture à gauche, matériaux à droite ; sa piste se colore selon les parts (nourriture, matériaux, sans travail rayé en gris). Aux deux bouts, l'icône, le nom, le nombre modifiable (écrit comme le jeu, « 108 966 », saisie lue comme un nombre du jeu) et la part des ouvrières en %. La nourriture prend d'abord les ouvrières sans travail, puis sur les matériaux.
- Les ouvrières qui pourraient récolter (min(TDC, ouvrières)) sans être affectées : « 100 ouvrières sans travail : … ».
- **Raccourcis** (pastilles, pressées quand la répartition affichée est la leur) : « Répartition actuelle » (celle du jeu) et « Juste assez de nourriture » : le minimum d'ouvrières sur la nourriture pour que le stock ne tombe jamais à zéro (retours de chasse compris), toutes les autres sur les matériaux. Grisé, avec une infobulle, quand même toutes les ouvrières sur la nourriture ne suffisent pas.
- **Tableau « Par jour »**, une colonne par ressource (dans l'ordre du curseur), une ligne par poste comme le résumé du jeu : récolte du terrain, champignonnière, armée, « Pillage de <pseudo> (22 %) » (arrondi à l'unité inférieure comme le jeu, ligne absente sans tribut), **solde**. Le solde dit l'écart avec la répartition actuelle, en note neutre (le signe dit le sens, pas la couleur : ADR 0003).
- Ligne « À venir » : famine (ou « Pas de famine ») et entrepôt plein, colorés selon l'urgence (même échelle que l'en-tête), avec « actuellement : … » quand la répartition simulée change la date. Capacité inconnue : « ouvrez Construction ».
- **Nouvelles ouvrières** (choix segmenté, seulement si le jeu montre l'affectation automatique) : nourriture, matériaux ou sans travail ; il compte dans la simulation (retours de chasse) et part avec « Appliquer ».
- Une phrase dit ce que fera « Appliquer » (« À appliquer : nourriture 0 → 20 000, matériaux 108 966 → 88 966. ») ; le bouton reste grisé tant que rien n'a changé.
- « Appliquer » : remplit `#RecolteNourriture` / `#RecolteMateriaux`, coche le `choixOuvriere` choisi et déclenche `#ChangeRessource`. Toujours sur un clic du joueur.

## 4. Niveaux suivants sur Construction et Laboratoire

Ajouté le 2026-10-17 : savoir combien coûtent et durent plusieurs niveaux d'un coup (« combien pour arriver au niveau 15 ? »).

- Sous chaque bâtiment ou recherche qui peut être lancé (pas les lignes « Requis »), un dépliable fermé « Coût des 5 niveaux suivants » : un tableau dense, une ligne par niveau, « Jusqu'au niveau » (N), une colonne par ressource que coûte le premier niveau (Nourriture, Matériaux, Ouvrières : un bâtiment n'a que Matériaux), « Durée » et « Tout payable » (maintenant, l'heure où le stock couvrira le total, « manque N ouvrières », « entrepôt trop petit » ou « jamais au rythme actuel »). Tous des cumuls ; chiffres alignés à droite, sans retour à la ligne.
- Le premier niveau est celui que le jeu affiche, après ceux déjà en file. Les suivants s'en déduisent (`docs/research/fourmizzz-pages.md`, « Temps des chantiers ») : le coût double à chaque niveau, le temps est multiplié par 1,6 (bâtiment) ou 1,7 (recherche), au bonus actuel d'Architecture ou de la Salle d'analyse. Une note sous le tableau le dit (« Cumuls estimés : coût × 2 et durée × 1,6 à chaque niveau… »).
- **Champignonnière** : son coût est multiplié par 1,85 à chaque niveau (arrondi comme le jeu), pas par 2 ; la note le dit (« coût × 1,85 »). Ajoutée le 2026-10-17.
- Les durées comptent × 1,6 / × 1,7 à chaque niveau : au-delà d'un niveau de 30 jours, le jeu passe à × 1,3 (voir la recherche), les durées très longues sont donc surestimées.
- « Tout payé » ne compte ni la file d'attente ni les niveaux payés un par un : c'est le moment où le stock couvre le total.
- Calculé une fois au chargement, à partir du même état que les délais.
- Option « Coût des niveaux suivants sur Construction et Laboratoire », allumée par défaut.

## Format

« 2 j 4 h », « 3 h 12 », « 12 min », « plus de 30 j » au-delà. Heure « aujourd'hui 18 h 40 », « demain 18 h 40 » ou le jour de la semaine.

## Hors v1

Achats planifiés (stock réservé), délai des ouvrières via la ponte, optimisation « payable au plus tôt », armée au Dôme ou en Loge, butin d'attaque et convois entrants, répartition automatique sans clic, tribut côté colonisateur, simulation sur Construction et Laboratoire.

## Code

| Fichier                                                                                | Rôle                                                                        |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `packages/game/src/pages/resources.ts`                                                 | Lecture : `#data`, Ressources, coûts, capacités des entrepôts               |
| `packages/game/src/forecast.ts`                                                        | Moteur : payable quand, famine, entrepôts pleins, équilibre, file           |
| `apps/extension/src/data/income.ts`                                                    | Revenus et capacités lus en arrière-plan, cache par serveur                 |
| `apps/extension/src/features/resource-forecast/mount-costs.ts`                         | Ligne de délai dans les tableaux de coûts                                   |
| `apps/extension/src/features/resource-forecast/mount-outlook.ts`                       | Famine et entrepôt plein sous les jauges de l'en-tête                       |
| `apps/extension/src/features/resource-forecast/mount-simulator.ts`                     | Simulateur de répartition sur Ressources                                    |
| `apps/extension/src/features/resource-forecast/mount-levels.ts`                        | Dépliable « Niveaux suivants » ; cumul dans `packages/game/src/speed-up.ts` |
| `apps/extension/src/features/resource-forecast/index.ts`                               | Feature du registre (script léger), style, rafraîchissement à la minute     |
| `packages/game/src/format/number-format.ts`, `packages/game/src/format/time-format.ts` | Nombres « 12 348 », durées et heures                                        |

Les prévisions partent de l'instant où la page a été chargée (le stock de `#data` ne bouge pas ensuite) ; le rafraîchissement ne fait qu'avancer les décomptes. La page Ressources avec Compte+ n'a pas de `var champi` (la page colonisée en a une) : la production de la champignonnière se lit alors dans le résumé.

Tests vitest aux interfaces : `pages` (fixtures), `forecast`, `income` (fetch simulé + fakeBrowser), `mount-costs`, `mount-outlook`, `mount-simulator` (fixtures, happy-dom).

## À vérifier

Récolte taxée paquet par paquet ou en continu ; nombre de places de la file Compte+.
