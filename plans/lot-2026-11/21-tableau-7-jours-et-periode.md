# 21 · Tableau jour par jour et période au choix (statistiques des convois)

Priorité 3 · effort S-M · dépend de : 11 (mêmes calculs de production) · conflits : `lib/envois/convoy-stats.ts`, `convoy-stats-view.tsx`.

## But

1. Un tableau par membre et par jour (7 colonnes, total, moyenne / jour) : TDC moyen, production brute / jour, production après colonies / jour, envois, total livré ; une ligne d'alliance en tête (valeur « partielle » en italique quand des membres manquent).
2. Une période libre « du … au … » pour les statistiques des convois et des floods, en plus des périodes fixes.

## Ce qui existe déjà

- `convoyStats` (7 / 30 / 90 jours, par jour ou semaine, par membre, « Avec qui », flux, hors alliance), `floodStats` (24 h / 7 jours).
- Conservation : convois 90 jours, floods 7 jours après l'arrivée : une période libre ne peut pas remonter plus loin.

## À cadrer

1. Le tableau jour par jour : nouvelle vue (« Jours ») des Statistiques des convois, ou un bloc dépliable ?
2. TDC moyen d'un jour : depuis l'export horaire (données publiques, site) ou les états Production (Envois) ?
3. Période libre : bornée par la conservation (le dire), dans l'adresse (`?du=…&au=…`) ?

## Proposition par défaut

Vue « Jours » dans les Statistiques des convois, réutilisant les fonctions de 11 ; période libre pour Convois et Floods, bornée et écrite.

## Maquette

Modifier l'artboard « C · Espace d'alliance · Convois (stats) ».

## Fini quand

Fonctions pures testées, vues montées, doc `site-envois.md`, vérifié avec une page de démonstration.
