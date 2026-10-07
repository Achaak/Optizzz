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
- **Sources** : `Ressources.php` rechargée en arrière-plan à chaque affichage de Construction et Laboratoire ; ailleurs, cache de moins de 15 min (mémorisé par serveur), relu en arrière-plan sinon.

## 1. Délais sur Construction et Laboratoire

- Une ligne sous la description de chaque élément pas encore payable (la colonne des coûts est trop étroite) : « ⏳ Disponible dans 3 h 12 (aujourd'hui 18 h 40) · manque 12 400 matériaux ».
- Sur Construction, la ligne Compte+ du jeu reste en place ; la nôtre se place dessous.
- Cas particuliers :
  - ouvrières manquantes (recherches) : « il manque N ouvrières », sans délai ;
  - coût au-delà de la capacité : « Entrepôt trop petit (capacité X) » ;
  - solde de nourriture négatif et nourriture manquante : « jamais au rythme actuel ».
- **File d'attente** (lue par `work-queue`) : un élément mis en file est payé tout de suite. Place libre → délai des ressources. File pleine (ou, sans Compte+, un chantier en cours) → max(ressources, fin du **premier** élément de la file), avec ce qui bloque : « ressources » ou « file pleine jusqu'à 14 h 16 ».
- Chaque élément est calculé seul, à partir du stock actuel. Décompte rafraîchi à la minute.

## 2. Famine et entrepôt plein (en-tête, toutes les pages)

- Sous la jauge de nourriture : « Famine dans 9 h 32 », sinon « Entrepôt plein dans 4 h », sinon le solde « Solde : +3 223 / jour » ; sous la jauge des matériaux : « Entrepôt plein dans … ».
- Couleurs : neutre au-delà de 24 h, orange en dessous de 24 h, rouge en dessous de 6 h.
- Infobulle (toujours présente) : solde par jour (détail récolte, champignonnière, armée, taxe), retours de chasse prévus, ouvrières à mettre sur la nourriture pour rester à l'équilibre.

## 3. Simulation sur Ressources

- Part de la répartition du jeu ; les ouvrières qui pourraient récolter (min(TDC, ouvrières)) sans être affectées sont affichées à part (« 100 ouvrières sans travail »).
- Deux nombres modifiables : la nourriture prend d'abord les ouvrières sans travail, puis sur les matériaux. Un curseur fait passer des ouvrières de l'un à l'autre.
- Bouton « équilibre nourriture » : le minimum d'ouvrières sur la nourriture pour que le stock ne tombe jamais à zéro (retours de chasse compris), toutes les autres sur les matériaux (plus aucune sans travail).
- Boîte dans le style du jeu (titre rouge en italique, bordure brune, icônes pomme et bois du jeu).
- Une barre sous le curseur montre la part nourriture / matériaux / sans travail.
- Tableau « Par jour » : nourriture et matériaux, actuel → simulé, écart en vert ou en rouge.
- La famine et les entrepôts pleins se recalculent en direct, une ligne chacun, colorée selon l'urgence.
- « Revenir à l'actuel » remet la répartition du jeu ; « Appliquer » reste grisé tant qu'elle n'a pas changé.
- « Appliquer » : remplit `#RecolteNourriture` / `#RecolteMateriaux` et déclenche `#ChangeRessource`. Première action de jeu d'Optizzz, toujours sur un clic du joueur.

## Format

« 2 j 4 h », « 3 h 12 », « 12 min », « plus de 30 j » au-delà. Heure « vers 18 h 40 », avec « demain » ou le jour de la semaine si ce n'est pas aujourd'hui.

## Hors v1

Achats planifiés (stock réservé), délai des ouvrières via la ponte, optimisation « payable au plus tôt », armée au Dôme ou en Loge, butin d'attaque et convois entrants, répartition automatique sans clic, tribut côté colonisateur, simulation sur Construction et Laboratoire.

## Code

| Fichier                                                  | Rôle                                                                    |
| -------------------------------------------------------- | ----------------------------------------------------------------------- |
| `src/features/resource-forecast/pages.ts`                | Lecture : `#data`, Ressources, coûts, capacités des entrepôts           |
| `src/features/resource-forecast/forecast.ts`             | Moteur : payable quand, famine, entrepôts pleins, équilibre, file       |
| `src/features/resource-forecast/income.ts`               | Revenus et capacités lus en arrière-plan, cache par serveur             |
| `src/features/resource-forecast/mount-costs.ts`          | Ligne de délai dans les tableaux de coûts                               |
| `src/features/resource-forecast/mount-outlook.ts`        | Famine et entrepôt plein sous les jauges de l'en-tête                   |
| `src/features/resource-forecast/mount-simulator.ts`      | Simulateur de répartition sur Ressources                                |
| `src/features/resource-forecast/index.ts`                | Feature du registre (script léger), style, rafraîchissement à la minute |
| `src/utils/number-format.ts`, `src/utils/time-format.ts` | Nombres « 12 348 », durées et heures                                    |

Les prévisions partent de l'instant où la page a été chargée (le stock de `#data` ne bouge pas ensuite) ; le rafraîchissement ne fait qu'avancer les décomptes. La page Ressources avec Compte+ n'a pas de `var champi` (la page colonisée en a une) : la production de la champignonnière se lit alors dans le résumé.

Tests vitest aux interfaces : `pages` (fixtures), `forecast`, `income` (fetch simulé + fakeBrowser), `mount-costs`, `mount-outlook`, `mount-simulator` (fixtures, happy-dom).

## À vérifier

Récolte taxée paquet par paquet ou en continu ; nombre de places de la file Compte+.
