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
| État          | « en cours » (1ʳᵉ ligne) / « en attente » (suivantes)                     |
| Progression   | barre de 0 à 100 %                                                        |
| Temps restant | décompte en direct (« 2 j 4 h », « 3 h 12 », « 12 min »)                  |
| Fin           | « aujourd'hui 14 h 23 », « demain 02 h 10 », « jeu. 9 h 05 »              |
| Annuler       | le lien du jeu (le jeu demande déjà une confirmation, on n'en ajoute pas) |

- **Progression** : la ligne du tableau du jeu affiche la durée du niveau d'après, bonus Architecture / Salle d'analyse inclus. Durée du niveau en chantier = durée affichée ÷ 1,6 (construction) ou ÷ 1,7 (recherche) ; début = fin − durée ; barre bornée à [0, 100 %]. Un élément en attente : 0 %, il commence à la fin du précédent. Limite connue : si Architecture ou Salle d'analyse monte pendant un chantier, la barre est fausse jusqu'à la fin de celui-ci.
- **Pied** : « Aucune construction en cours » / « Aucune recherche en cours » quand la file est vide ; « File pleine : prochaine place libre aujourd'hui 14 h 23 » quand toutes les cellules d'action sont vides alors que la file n'est pas vide. Rien quand une place est libre.
- La lecture de la file sert aussi à `resource-forecast` (délai quand la file est pleine).

## Hors v1

Gain apporté par le niveau, durée mémorisée au lancement.

## Code

| Fichier                               | Rôle                                                  |
| ------------------------------------- | ----------------------------------------------------- |
| `src/features/work-queue/queue.ts`    | Lecture des chantiers en cours (logique pure, testée) |
| `src/features/work-queue/progress.ts` | Durée, début, progression                             |
| `src/features/work-queue/index.ts`    | Montage du tableau (DOM simple)                       |
| `src/shared/durations.ts`             | Format des durées et des heures, partagé              |

Les noms de fichiers seront ajustés à l'implémentation.
