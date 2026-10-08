# Feature : Chantiers en cours

Décidé lors d'une session de cadrage (`/grill-me`) le 2026-10-07.

## But

Remplacer les lignes « - Champignonnière 9 se termine dans : … » du jeu par un tableau lisible des constructions et recherches en cours ou en file d'attente.

## Comportement

- **Pages** : `construction.php` et `laboratoire.php`, même tableau.
- **Les lignes du jeu sont masquées, pas supprimées** : leurs `reste()` continuent de tourner sans erreur.
- **Colonnes** :

| Colonne       | Contenu                                                                   |
| ------------- | ------------------------------------------------------------------------- |
| Élément       | « Champignonnière 8 → 9 »                                                 |
| État          | « en cours », « en attente », « terminé » (la page n'est pas rechargée)   |
| Progression   | barre de 0 à 100 %                                                        |
| Temps restant | décompte en direct (« 2 j 4 h », « 3 h 12 », « 12 min »)                  |
| Fin           | « aujourd'hui 14 h 23 », « demain 2 h 10 », « jeu. 9 h 05 »               |
| Annuler       | le lien du jeu (le jeu demande déjà une confirmation, on n'en ajoute pas) |

- **Progression** : la ligne du tableau du jeu affiche la durée du niveau d'après, bonus Architecture / Salle d'analyse inclus. Durée du niveau en chantier = durée affichée ÷ 1,6 (construction) ou ÷ 1,7 (recherche), une fois de plus par élément du même bâtiment placé après lui dans la file (la ligne montre le niveau d'après le dernier) ; début = fin − durée ; barre bornée à [0, 100 %]. Un élément en attente commence à la fin du précédent : 0 % jusque-là, puis sa barre avance (sa durée est connue exactement). Limite connue : si Architecture ou Salle d'analyse monte pendant un chantier, la barre est fausse jusqu'à la fin de celui-ci.
- **Page laissée ouverte** : le jeu ne la recharge pas ; le tableau avance tout seul (« terminé », l'élément suivant « en cours »), et une file pleine dont une place s'est libérée dit « rechargez la page ».
- **Emplacement** : le tableau prend la place de la première ligne du jeu masquée.
- **Pied** : « Aucune construction en cours » / « Aucune recherche en cours » quand la file est vide ; « File pleine : prochaine place libre aujourd'hui 14 h 23 » quand toutes les cellules d'action sont vides alors que la file n'est pas vide. Rien quand une place est libre.
- La lecture de la file sert aussi à `resource-forecast` (délai quand la file est pleine).

## Hors v1

Gain apporté par le niveau, durée mémorisée au lancement.

## Code

| Fichier                               | Rôle                                                        |
| ------------------------------------- | ----------------------------------------------------------- |
| `src/game/pages/work-queue.ts`        | Lecture des chantiers en cours, file pleine, durée affichée |
| `src/features/work-queue/progress.ts` | Début et progression d'un élément                           |
| `src/features/work-queue/mount.ts`    | Masque les lignes du jeu, monte et redessine le tableau     |
| `src/features/work-queue/index.ts`    | Feature du registre (script léger), style, rafraîchissement |
| `src/utils/time-format.ts`            | Durées et heures (« 3 h 12 », « demain 2 h 10 »), partagé   |

Tests vitest aux interfaces : `queue` (fixtures), `progress`, `mount` (fixtures, happy-dom), `time-format`. Le tableau avec une file pleine se vérifie dans le jeu.
