# 23 · Graphique « ce qui entre / ce qui sort »

Priorité 3 · effort S-M · dépend de : 11 (net et production par membre) · conflits : vue de 11.

## But

Par membre, par jour en moyenne sur la période : à droite ce qu'il gagne (production, taxes reçues, convois reçus), à gauche ce qu'il cède (convois livrés, taxe versée), un trait pour la consommation (entrées − sorties) et la moyenne de l'alliance.

## Ce qui existe déjà

- Graphiques Recharts du site (`convoy-stats-chart.tsx`, `flood-stats-chart.tsx`), règles des graphiques du site (`docs/features/site-refonte.md`, « Graphiques » ; skill `dataviz`).
- Les calculs de 11.

## À cadrer

1. Dans la vue de 11 (proposition) ou à part ?
2. Unité : ressources par jour, en milliers ? Membres triés par consommation ?
3. Daltonisme : les segments se distinguent par motif ou ordre et légende, pas seulement la couleur (ADR 0003) ; vérifier en simulant protanopie et deutéranopie.

## Proposition par défaut

Barres horizontales empilées de part et d'autre d'un axe central, sous le tableau de 11, membres triés par consommation, légende en mots.

## Maquette

Dans l'artboard de 11.

## Fini quand

Données du graphique en fonction pure testée, graphique monté, simulations de daltonisme faites, doc dans la section de 11.
