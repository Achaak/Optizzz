# Carte du serveur sur le site (étape 2b, premier outil)

Décidé lors d'une session de cadrage (`/grill-me`) le 2026-10-22. Reprend la Carte du serveur de l'extension (`carte-serveur.md`) pour le site public (`site-public.md`), sans joueur connecté.

## Partage avec l'extension

- Nouveau paquet **`packages/map`** (`@optizzz/map`, dépend d'`echarts` et de `@optizzz/game`) : la logique pure de la carte (recherche et puces, filtres, pseudos ou tags selon le zoom, axes et placement des noms) et l'option ECharts, à qui chaque app passe sa palette. Les composants React restent propres à chaque app. La Carte du serveur et la Carte de l'alliance de l'extension s'en servent aussi.
- **ECharts** pour la carte seule (série `scatter` en mode `large`) ; le reste du site garde Recharts.

## Comportement

- **Adresse** : `/s5/carte`, indexée comme les autres pages de serveur. L'état tient dans l'adresse (`?p=…` : puces, couleurs, filtres, référence, vitesse) : un lien partagé rouvre la même carte. Sans état dans l'adresse, la dernière sélection du serveur est reprise du navigateur (`localStorage`).
- **Comme dans l'extension** : fond de tous les joueurs (bannis exclus), puces (joueur, alliance, « Sans alliance »), une couleur par puce, filtres TDC, Fourmilière et Technologie, pseudos ou tags selon le zoom, cadrage, survol, clic qui fait d'un joueur la **référence** des distances, tableau trié par distance.
- **Adapté** : « + Pactes / Guerres de [alliance] » pour une alliance choisie (au lieu de « mes ») ; filtre « à portée de la référence » (au lieu de « à ma portée »).
- **Retiré** : « ma position » et tout ce qui suppose un joueur connecté.
- **Trajet** : champ « Vitesse d'attaque » au-dessus du tableau (niveau 0 par défaut, gardé dans l'adresse), trajet depuis la référence ; sans référence, pas de colonne Trajet.
- **Forme** : même échelle sur les deux axes. Un serveur tout en hauteur (S4 : 50 × 2 058 cases) ne s'ouvre pas sur une aiguille : l'ouverture cadre une bande aussi haute que la largeur le permet, sur la sélection ou au milieu des joueurs ; « Voir tout le serveur » montre tout.
- **Données** : une route `/api/[server]/carte` en colonnes compactes (x, y, alliance, pseudo, TDC, scores), mise en cache et reconstruite par le cron comme les pages. S4 : 216 654 joueurs, 6,2 Mo bruts, environ 1 Mo compressé (relevé le 2026-10-22).
- **Liens** : « Voir sur la carte » sur les fiches joueur et alliance du site, qui ouvre la carte avec cette puce.

## L'extension lit la carte sur le site

Révision de l'ADR 0005 du 2026-10-22 : sans compte, l'extension peut lire ce que le site publie pour tous.

- La Carte du serveur de l'extension lit ses positions sur `/api/[server]/carte` : environ 1 Mo pour S4 au lieu des 44 Mo de l'export brut.
- **Sans permission** : la route répond avec `Access-Control-Allow-Origin: *` (données publiques, lecture seule, ni cookie ni identifiant) ; le manifest ne change pas.
- **Repli** : site injoignable, réponse invalide (zod) ou serveur pas encore relu par le site : l'export de Fourmizzz, comme avant. La date en tête dit la source (« Positions de l'export public (aujourd'hui 14 h 00, via optizzz.fr) »).
- **Option** de la Carte du serveur dans « Fonctionnalités » : « Lire les positions sur optizzz.fr (plus léger) », cochée par défaut ; décochée, la carte ne contacte que Fourmizzz.
- `PRIVACY.md` et `docs/store/fiche.md` disent que cette lecture transmet l'adresse IP au site ; `data_collection_permissions` reste `none`.

## Code

| Fichier                                                             | Rôle                                                                                                                                        |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/map/src/` (+ tests)                                       | Puces, filtres, noms, axes (`plotShape` : la bande des serveurs très hauts), option ECharts avec la palette de chaque app                   |
| `packages/map/src/map-data.ts` (+ test)                             | Les colonnes de la carte servies par le site, lues par le site et l'extension                                                               |
| `apps/web/prisma/schema.prisma` (`MapFile`), `src/ingest/ingest.ts` | Le cron prépare le fichier de chaque serveur, déjà compressé (S4 : 1,8 Mo en gzip)                                                          |
| `apps/web/src/app/api/[server]/carte/route.ts`                      | Le sert tel quel, avec `Access-Control-Allow-Origin: *` (une fonction Vercel répond 4,5 Mo au plus)                                         |
| `apps/web/src/components/map/`                                      | La page : puces (`chip-bar`), carte (`map-chart`), tableau, état dans l'adresse (`map-state`, + test), palettes clair et sombre (`palette`) |
| `apps/extension/src/data/site-map.ts` (+ test)                      | L'extension lit la carte du site, repli sur l'export                                                                                        |

Vérifié en local le 2026-10-22 : S5 (puces, pactes, filtre, tableau depuis une référence avec vitesse), S4 (216 452 joueurs, ouverture sur une bande). Palettes vérifiées en simulant protanopie et deutéranopie : au moins 10 d'écart OKLab entre voisines.
