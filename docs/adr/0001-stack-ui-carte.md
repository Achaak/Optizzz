# 0001 — Briques éprouvées pour l'UI, et scripts lourds à part

**Date** : 2026-10-07 · **Statut** : accepté

## Contexte

La carte d'alliance a besoin d'un graphe zoomable (nœuds + liens sur axes x/y), d'un tableau éditable et de la validation d'un JSON externe. Consigne : utiliser des technologies qui ont fait leurs preuves plutôt que d'écrire à la main.

## Décision

- **React 19** via `@wxt-dev/module-react`, monté dans un **Shadow DOM** (`createShadowRootUi` de WXT) pour isoler nos styles de ceux du jeu.
- **Apache ECharts** (import modulaire `echarts/core` : série `graph` en `cartesian2d`, `dataZoom` « inside » pour molette/glisser/pincer) avec `echarts-for-react`.
- **zod** pour valider les réponses de l'API.
- Stockage : `wxt/utils/storage` (permission `storage`).
- Une feature lourde a **son propre content script**, limité par `matches` aux pages qui en ont besoin. Le script `fourmizzz.content.ts`, chargé partout, ne garde que des features légères (ici : l'entrée de menu). Raison : React + ECharts + zod ≈ 900 Ko, à ne pas parser sur chaque page du jeu.

## Alternatives écartées

- SVG fait main : moins de dépendances, mais zoom, pincer, infobulles et étiquettes à réécrire.
- Highcharts (utilisé par Toolzzz) : licence non libre pour un usage hors non-commercial.
- Cytoscape / vis-network : pensés pour des graphes à disposition automatique ; ici les positions sont fixées par la carte.
