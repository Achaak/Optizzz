# Feature : Coût du déblocage

Idée d'un joueur (Hardware) le 2026-11-19 : sur la Reine, mettre sous les unités pas encore débloquées ce que coûte leur déblocage, d'après les niveaux déjà faits. Étendue le même jour à Construction et Laboratoire. Cadrée le 2026-11-19.

## But

Savoir ce qu'il reste à payer (ouvrières, nourriture, matériaux) pour débloquer une unité, ou le niveau suivant d'un bâtiment ou d'une recherche, sans additionner soi-même les niveaux manquants de chaque prérequis.

## Comportement

- **Reine** (`Reine.php`) : sous chaque unité dont un « Requis » manque (`verificationNonOK`), une ligne « Pour débloquer : » avec les niveaux à faire et leur coût. Exemple S5 (Salle de combat 1) : Soldate Naine → Salle de combat 3, soit les niveaux 2 et 3.
- **Construction et Laboratoire** : la même ligne sous chaque bâtiment ou recherche dont le niveau suivant attend un prérequis (« Pour débloquer le niveau 9 : »). Le coût du niveau lui-même n'est pas repris : le jeu l'affiche déjà.
- **Ce qui est compté** : les niveaux manquants de chaque prérequis, et ceux de leurs propres prérequis (Tank → Génétique 15 → Laboratoire 18). Un prérequis demandé par deux chemins n'est compté qu'une fois, au plus haut niveau demandé.
- **Prérequis des niveaux plus hauts** : la ligne « Requis » d'une ligne ne montre que ce que demande son niveau suivant. D'un niveau au suivant, le niveau demandé monte de un (règle relevée sur S5 et S2, voir `../research/fourmizzz-pages.md`, « Prérequis ») : Génétique 1 demande Laboratoire 4, donc Génétique 15 demande Laboratoire 18.
- **Coût d'un niveau** : celui que la ligne du prérequis affiche, grandi comme la table des niveaux le dit (`packages/game/src/level-costs.ts`), comme les Conseils.
- **Affichage** : une étiquette « Déblocage », puis deux lignes.
  - Les niveaux à faire, du niveau actuel au niveau demandé, ceux qu'un prérequis demande à son tour entre parenthèses après lui : « **Acide** 0 → 5 (Armes 7 → 10, Génétique 0 → 8) · **Caserne** 0 → 13 (Salle de combat 1 → 13) ». Un prérequis demandé deux fois est rangé sous celui qui le demande le plus haut.
  - Le coût, ouvrières, nourriture et matériaux, chacun avec l'icône du jeu (nommée pour les lecteurs d'écran) et en gras ; les montants nuls sont omis, les nombres arrondis suivent le réglage « Nombres arrondis » (le nombre exact au survol).
  - Sur Construction et Laboratoire, l'infobulle dit quel niveau attend (« Pour lancer le niveau 9 ») : le « Requis » du jeu juste au-dessus le dit déjà.
  - Aucune durée : la construction et le laboratoire travaillent en parallèle, un total induirait en erreur.
- **Inconnu** : un prérequis absent des deux pages, ou une page qui ne répond pas, et le coût est écrit « au moins ».
- **Données** : la Reine relit `construction.php` et `laboratoire.php` en arrière-plan (`fetchGamePage`, requête partagée avec les autres features) ; Construction relit le Laboratoire et inversement. Un niveau en cours compte comme fait.
- Entrée « Coût du déblocage » dans « Fonctionnalités », avec une option par page : la Reine, Construction et Laboratoire.

## Limites

- La règle « un niveau de plus à chaque niveau » est vérifiée sur onze lignes à deux niveaux différents (S5 et S2), pas encore sur Caserne, Génétique, Acide et Poison au-delà du niveau 1.
- Les niveaux de Laboratoire sont comptés en entier, bien qu'ils servent aussi aux autres recherches.

## Code

| Fichier                                             | Rôle                                                                    |
| --------------------------------------------------- | ----------------------------------------------------------------------- |
| `packages/game/src/requirements.ts`                 | `unlockCost` : niveaux à faire et coût, prérequis des prérequis compris |
| `packages/game/src/pages/level-rows.ts`             | Les « Requis » d'une ligne, remplis ou non                              |
| `packages/game/src/pages/queen.ts`                  | `readLockedUnits` : les unités verrouillées de la Reine                 |
| `apps/extension/src/features/unlock-costs/mount.ts` | Texte et ligne                                                          |
| `apps/extension/src/features/unlock-costs/index.ts` | Les trois pages, relecture des deux autres                              |
