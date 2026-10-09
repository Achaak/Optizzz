# 0002 — Thème en variables CSS, briques partagées hors des features

**Date** : 2026-10-08 · **Statut** : accepté

## Contexte

La revue du 2026-10-08 (`docs/reviews/`) a relevé :

- 156 couleurs codées en dur (67 valeurs) dans 24 fichiers, sans aucune variable de thème, et deux familles visuelles : les encarts ajoutés au DOM du jeu reprenaient ses encadrés, les vues React avaient un panneau crème arrondi.
- Une trentaine d'imports d'une feature vers une autre pour des briques qui ne sont pas des features : export public, lecteurs de pages, revenus, niveaux, armée, fins, attaques en route.
- Des données qui disparaissaient quand on coupait une feature (les notifications de fin quand « Heures de fin » était coupée).

Un mode « moderne » est prévu : il doit pouvoir changer tout le style sans toucher aux features.

## Décision

- **Thème** : `src/theme/theme.css` définit les variables `--optizzz-*` (texte, encadrés, bordures, états, action principale, ressources). Le thème classique copie les encadrés du jeu (parchemin, bordure brune, titres rouges en italique) ; les vues React l'adoptent aussi. Les variables sont posées sur les pages du jeu (`injectTheme`, au début du content script commun), dans chaque Shadow DOM (`import "@/theme/theme.css"` des scripts lourds, `THEME_CSS` de la fenêtre Paramètres) et sur les pages de l'extension. Aucun style n'écrit de couleur : il lit une variable. Les graphiques ECharts, qui dessinent sur un canvas, prennent `CHART_COLORS`. Seules exceptions : les couleurs du badge de l'icône (`src/utils/urgency.ts`), que l'API du navigateur veut en clair.
- **Briques partagées** :
  - `src/game/` : règles du jeu (`attack.ts`, `flood.ts`, `travel.ts`, `forecast.ts`, `army/`) ;
  - `src/game/pages/` : lecteurs purs des pages du jeu ;
  - `src/data/` : données mémorisées par serveur et relues en arrière-plan ;
  - `src/utils/` : formats, champ numérique, réglages des vues, page du jeu relue et partagée (`fetchGamePage`).
- **Collecte** : la feature `collect`, toujours active, mémorise ce que montre la page courante (sans requête) pour toutes les features allumées qui en ont besoin. Couper une feature n'ôte que son affichage et ses relectures en arrière-plan.

## Conséquences

- Un mode « moderne » se fait en redéfinissant les variables (et `CHART_COLORS`), par exemple sous un attribut posé sur la racine.
- Une feature n'importe plus une autre feature pour ces briques ; il reste quelques liens entre features (réglages de la Carte lus par la Chaîne, calculateur de convoi lu par Heures de fin), à sortir s'ils grandissent.
