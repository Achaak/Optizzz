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

- Une ligne ajoutée au tableau des coûts de chaque élément pas encore payable, dans le style du jeu : horloge, « dans 3 h 12 · vers 18 h 40 », puis ce qui manque par ressource. La ressource qui bloque le plus longtemps est mise en avant.
- Sur Construction, la ligne Compte+ du jeu reste en place ; la nôtre se place dessous.
- Cas particuliers :
  - ouvrières manquantes (recherches) : « il manque N ouvrières », sans délai ;
  - coût au-delà de la capacité : « Entrepôt trop petit (capacité X) » ;
  - solde de nourriture négatif et nourriture manquante : « jamais au rythme actuel ».
- **File d'attente** (lue par `work-queue`) : un élément mis en file est payé tout de suite. Place libre → délai des ressources. File pleine (ou, sans Compte+, un chantier en cours) → max(ressources, fin du **premier** élément de la file), avec ce qui bloque : « ressources » ou « file pleine jusqu'à 14 h 16 ».
- Chaque élément est calculé seul, à partir du stock actuel. Décompte rafraîchi à la minute.

## 2. Famine et entrepôt plein (en-tête, toutes les pages)

- Sous la jauge de nourriture : « Famine dans 9 h 32 », sinon « Entrepôt plein dans 4 h » ; pareil pour les matériaux (entrepôt plein).
- Couleurs : neutre au-delà de 24 h, orange en dessous de 24 h, rouge en dessous de 6 h.
- Infobulle : solde par jour (détail récolte, champignonnière, armée, taxe), retours de chasse prévus, ouvrières à mettre sur la nourriture pour rester à l'équilibre.

## 3. Simulation sur Ressources

- Un curseur répartit min(TDC, ouvrières) entre nourriture et matériaux, avec deux nombres modifiables.
- Bouton « équilibre nourriture » : le minimum d'ouvrières sur la nourriture pour que le stock ne tombe jamais à zéro (retours de chasse compris), le reste sur les matériaux.
- La famine et l'entrepôt plein se recalculent en direct.
- « Appliquer » : remplit `#RecolteNourriture` / `#RecolteMateriaux` et déclenche `#ChangeRessource`. Première action de jeu d'Optizzz, toujours sur un clic du joueur.

## Format

« 2 j 4 h », « 3 h 12 », « 12 min », « plus de 30 j » au-delà. Heure « vers 18 h 40 », avec « demain » ou le jour de la semaine si ce n'est pas aujourd'hui.

## Hors v1

Achats planifiés (stock réservé), délai des ouvrières via la ponte, optimisation « payable au plus tôt », armée au Dôme ou en Loge, butin d'attaque et convois entrants, répartition automatique sans clic, tribut côté colonisateur, simulation sur Construction et Laboratoire.

## À vérifier

Récolte taxée paquet par paquet ou en continu ; nombre de places de la file Compte+.
