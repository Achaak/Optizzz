# 10 · Frise des mouvements du jour (Espace d'alliance)

Priorité 2 · effort M · dépend de : rien · conflits : `member-space.tsx` (onglets), voir le README.

## But

Une page que tout le monde ouvre chaque jour : toutes les arrivées de l'alliance, heure par heure (heure de Paris), pour la journée choisie. Floods (« Brosse → Psycho62 · 300 000 »), convois (« Okapi → Zeph · 1,2M matériaux »), chasses qui rentrent (« Tamo +16 054 cm² »), regroupés quand ils se répètent (« ×4 »).

## Ce qui existe déjà

- Les Envois ouverts dans la page de l'espace : convois (`lib/envois/convoys.ts`), floods (`lib/envois/floods.ts`), états dont les chasses en cours (`lib/envois/states.ts`), via `use-space-envois.ts`.
- Les onglets « Convois » et « Floods » ont chacun « Statistiques | Liste », avec vue, période et membre dans l'adresse (`flood-view.ts`).
- Le site garde un flood 7 jours après son arrivée, un convoi 90 jours ; une chasse n'existe que tant qu'elle est dehors (état, pas liste).

## À cadrer (`/grilling` avec le joueur)

1. Un onglet à part « Mouvements », ou une troisième vue des onglets existants ? (proposition : onglet « Mouvements » après « État »).
2. Quels jours : hier, aujourd'hui, demain (convois et floods en route) ? Plus loin dans le passé, limité par la conservation (floods 7 jours) ?
3. Les chasses : seulement celles encore dehors (on n'a pas les rentrées passées) — le dire, ou garder les retours vus pour les montrer après ?
4. Filtres : « seulement moi », un membre, un type (floods / convois / chasses) ; dans l'adresse ?
5. Regroupement : même expéditeur et même cible dans la même heure → « ×N » ; qu'affiche le survol ?
6. Les heures déjà passées repliées par défaut (« Afficher les heures précédentes · 19 heures, 110 mouvements ») ?
7. Mobile : liste verticale par heure (proposition) plutôt qu'une frise horizontale.

## Proposition par défaut

Onglet « Mouvements », jour courant avec ‹ hier / demain ›, heures passées repliées, une ligne par mouvement (ou groupe), le type écrit en mot et marqué d'une forme (jamais la seule couleur, ADR 0003). Tuiles en tête : floods, convois, chasses du jour. Tout calculé dans le navigateur (fonctions pures `lib/envois/movements.ts` + test).

## Maquette

Ajouter un artboard « C · Espace d'alliance · Mouvements » au canevas avant de coder.

## Fini quand

- Fonctions pures testées (regroupement, bornes du jour de Paris, filtres), vue montée, adresse qui suit les choix.
- Vérifié dans le navigateur avec une page de démonstration temporaire (clair, sombre, 375 px), retirée ensuite.
- Doc : section dans `docs/features/site-envois.md` (ou nouvelle page `docs/features/site-mouvements.md`).
