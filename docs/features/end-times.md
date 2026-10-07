# Feature : Heures de fin

Décidé lors d'une session de cadrage (`/grill-me`) le 2026-10-07. Voir aussi `roadmap.md`.

## But

Savoir à quelle heure finit une chasse, une ponte ou un chantier sans faire le calcul, et le voir sur toutes les pages.

## 1. À côté des décomptes (sous-option « À côté des décomptes du jeu »)

- Générique : chaque `reste(<secondes>, "<id>")` de la page reçoit, juste après son `<span>`, « · fin aujourd'hui 14 h 23 » (même format que la colonne « Fin » des Chantiers en cours). Le texte est redessiné chaque minute (« aujourd'hui » devient faux après minuit).
- Pas d'ajout quand le jeu donne déjà l'heure après la ligne (« Arrivée à 13h11 » sous une chasse avec Compte+, « Terminé à 13h06 » sous une recherche), ni pour `temps_restant_premiere_ponte` (doublon du total de la première ponte).
- Les lignes de chantier masquées par les Chantiers en cours gardent leur ajout, masqué avec elles ; il réapparaît si les Chantiers sont coupés.

## 2. Encart « Prochaines fins » (sous-option « Encart « Prochaines fins » »)

- Colonne de gauche, à la place de la boîte Compte+, poussée en dessous ; même habillage que les boîtes du jeu. Caché quand il n'y a rien, et quand la vraie boîte Compte+ (lignes `#ligne_*`) est là.
- Lignes, de la plus proche à la plus lointaine : chaque chasse ; pour la ponte, la construction et la recherche, le prochain à finir et « +N en file ». Pas le retour des ouvrières.
- Ligne : « 🏹 Chasse 183 cm² » (lien vers la page), puis « 14 min · 17 h 45 ». Ce qui est fini reste « terminé » 1 h puis disparaît. Une page lue il y a plus de 24 h ajoute « vu il y a … ».
- Données : à chaque passage sur `Ressources.php`, `Reine.php`, `construction.php` ou `laboratoire.php`, la liste est mémorisée par serveur (`local:endTimes:<host>:sections`, type, libellé, fin, heure de lecture). Quand l'encart s'affiche, une page jamais lue ou lue il y a plus de 15 min est relue en arrière-plan (un `GET`) ; une page qui échoue (session expirée…) garde l'ancienne liste. Les alertes (feature 6) réutiliseront ces données.

## Hors v1

- Attaques : à vérifier dès qu'il y en aura en cours (`Armee.php`). Les convois n'ont pas de `reste()` : leur heure d'arrivée vient du calculateur de convoi, et ils entrent dans l'encart (source `commerce.php`).

## Code

| Fichier                                          | Rôle                                                  |
| ------------------------------------------------ | ----------------------------------------------------- |
| `src/features/end-times/countdowns.ts` (+ test)  | Lecture des `reste()`, ajout de l'heure de fin        |
| `src/features/end-times/sources.ts` (+ test)     | Ce que liste chaque page (chasses, pontes, chantiers) |
| `src/features/end-times/store.ts` (+ test)       | Mémoire par serveur, relecture en arrière-plan        |
| `src/features/end-times/recap.ts` (+ test)       | Choix des lignes de l'encart, pages à relire          |
| `src/features/end-times/mount-recap.ts` (+ test) | L'encart dans la colonne de gauche                    |
| `src/features/end-times/index.ts`                | La feature                                            |
