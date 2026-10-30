# Carte du serveur sur le site (étape 2b, premier outil)

Décidé lors d'une session de cadrage (`/grill-me`) le 2026-10-22. Reprend la Carte du serveur de l'extension (`carte-serveur.md`) pour le site public (`site-public.md`), sans joueur connecté.

## Partage avec l'extension

- Nouveau paquet **`packages/map`** (`@optizzz/map`, dépend d'`echarts` et de `@optizzz/game`) : la logique pure de la carte (recherche et puces, filtres, pseudos ou tags selon le zoom, axes et placement des noms) et l'option ECharts, à qui chaque app passe sa palette. Les composants React restent propres à chaque app. La Carte du serveur et la Carte de l'alliance de l'extension s'en servent aussi.
- **ECharts** pour la carte seule (série `scatter` en mode `large`) ; le reste du site garde Recharts.

## Comportement

- **Adresse** : `/s5/map`, indexée comme les autres pages de serveur. L'état tient dans le fragment de l'adresse (`#p=1.<base64url>`, format versionné de `site-outils.md` : puces, couleurs, filtres, référence, vitesse), jamais envoyé au site : un lien partagé rouvre la même carte. Un lien illisible (tronqué, retouché, version inconnue) ouvre une carte vide avec « Ce lien n'est pas valide ». Sans état dans l'adresse, la dernière sélection du serveur est reprise du navigateur (`localStorage`). Les anciens liens `/s5/carte?p=…` ne sont pas relus (404, sans redirection).
- **Comme dans l'extension** : fond de tous les joueurs (bannis exclus), puces (joueur, alliance, « Sans alliance »), une couleur par puce, filtres TDC, Fourmilière et Technologie, pseudos ou tags selon le zoom, cadrage, survol, clic qui fait d'un joueur la **référence** des distances, tableau trié par distance.
- **Adapté** : « + Pactes / Guerres de [alliance] » pour une alliance choisie (au lieu de « mes ») ; filtre « à portée de la référence » (au lieu de « à ma portée »).
- **Retiré** : « ma position » et tout ce qui suppose un joueur connecté.
- **Trajet** : champ « Vitesse d'attaque » au-dessus du tableau (niveau 0 par défaut, gardé dans l'adresse), trajet depuis la référence ; sans référence, pas de colonne Trajet.
- **Forme** : même échelle sur les deux axes. Un serveur tout en hauteur (S4 : 50 × 2 058 cases, S1 : 48 × 2 679) ne s'ouvre pas sur une aiguille : l'ouverture cadre une bande aussi haute que la largeur le permet, sur la sélection ou au milieu des joueurs ; une sélection plus haute que la bande (une alliance éparpillée sur tout S4) est cadrée sur l'endroit qui en réunit le plus, pas sur son milieu, souvent vide. « Voir tout le serveur » montre tout, sans garder la même échelle.
- **Données** : une route `/api/[server]/map` en colonnes compactes (x, y, alliance, pseudo, TDC, scores), mise en cache et reconstruite par le cron comme les pages. S4 : 216 654 joueurs, 6,2 Mo bruts, environ 1 Mo compressé (relevé le 2026-10-22).
- **Liens** : « Voir sur la carte » sur les fiches joueur et alliance du site, qui ouvre la carte avec cette puce (`/s5/map?player=…`, `/s5/map?alliance=…`).

## L'extension lit la carte sur le site

Révision de l'ADR 0005 du 2026-10-22 : sans compte, l'extension peut lire ce que le site publie pour tous.

- La Carte du serveur de l'extension lit ses positions sur `/api/[server]/map` : environ 1 Mo pour S4 au lieu des 44 Mo de l'export brut.
- **Sans permission** : la route répond avec `Access-Control-Allow-Origin: *` (données publiques, lecture seule, ni cookie ni identifiant) ; le manifest ne change pas.
- **Repli** : site injoignable, réponse invalide (zod) ou serveur pas encore relu par le site : l'export de Fourmizzz, comme avant. La date en tête dit la source (« Positions de l'export public (aujourd'hui 14 h 00, via optizzz.fr) »).
- **Option** de la Carte du serveur dans « Fonctionnalités » : « Lire les positions sur optizzz.fr (plus léger) », cochée par défaut ; décochée, la carte ne contacte que Fourmizzz.
- `PRIVACY.md` et `docs/store/fiche.md` disent que cette lecture transmet l'adresse IP au site ; `data_collection_permissions` reste `none`.

## Code

| Fichier                                                             | Rôle                                                                                                                                                                                                                    |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/map/src/` (+ tests)                                       | Puces, filtres, noms, axes (`plotShape` : la bande des serveurs très hauts), option ECharts avec la palette de chaque app                                                                                               |
| `packages/map/src/map-data.ts` (+ test)                             | Les colonnes de la carte servies par le site, lues par le site et l'extension                                                                                                                                           |
| `apps/web/prisma/schema.prisma` (`MapFile`), `src/ingest/ingest.ts` | Le cron prépare le fichier de chaque serveur, déjà compressé (S4 : 1,8 Mo en gzip)                                                                                                                                      |
| `apps/web/src/app/api/[server]/map/route.ts`                        | Le sert tel quel, avec `Access-Control-Allow-Origin: *` (lu dans la base à chaque demande ; le navigateur le garde dix minutes)                                                                                         |
| `apps/web/src/components/map/`                                      | La page : puces (`chip-bar`), carte (`map-chart`), tableau, état dans le fragment (`map-state`, + test, au format de `packages/game/src/site-links/`) et ce que demande l'adresse, palettes clair et sombre (`palette`) |
| `apps/extension/src/data/site-map.ts` (+ test)                      | L'extension lit la carte du site, repli sur l'export                                                                                                                                                                    |

Vérifié en local le 2026-10-22 : S5 (puces, pactes, filtre, tableau depuis une référence avec vitesse), S4 (216 452 joueurs, ouverture sur une bande). Palettes vérifiées en simulant protanopie et deutéranopie : au moins 10 d'écart OKLab entre voisines.

Vérifié en production le 2026-10-23 (après le premier passage du cron, export de 6 h 00), aux adresses d'alors (`/sX/carte`, `/api/sX/carte`, `?p=`, `?joueur=` ; en anglais depuis, voir plus haut) :

- `/api/sX/carte` pour S1 à S5 : 200, `Content-Encoding: gzip`, `Access-Control-Allow-Origin: *`, `Cache-Control: public, max-age=600` (mesuré sur Vercel ; sur le VPS, sans CDN, chaque lecture repasse par la base) ; JSON valide pour `mapDataSchema`. S4 : 1,8 Mo transférés, 216 456 joueurs.
- `/sX/carte` pour S1 à S5 : carte affichée sans message dans la console, en clair et en sombre, sur ordinateur et à 375 px ; S4 et S1 s'ouvrent sur une bande ; un lien `?p=…` rouvre puces, filtre, référence et vitesse ; « Voir sur la carte » des fiches joueur et alliance mène à `?joueur=…` et `?alliance=…` (tag encodé : `L%2FN` sur S1).

Corrigé ensuite (vérifié en local, en production après la mise en ligne) :

- « Voir sur la carte » d'une alliance éparpillée sur S4 (Lcqs : y de 106 à 1 246) ouvrait une bande vide au milieu ; elle s'ouvre sur la bande qui réunit le plus de ses membres (`fittedWindow`).
- La zone zoomée se lisait sur la grille (`convertFromPixel`) : quand l'événement arrivait pendant qu'ECharts reconstruisait la grille, ECharts avertissait en développement (les avertissements sont retirés du build de production, d'où une console vide en ligne), et la Carte du serveur de l'extension plantait sur le résultat vide. Elle se lit maintenant dans l'événement `datazoom` (`zoomedWindow`).
- Sur téléphone, l'heure de l'export ne se coupe plus au milieu (« 6 h / 00 »).

Reste : sur ordinateur, la carte (720 px au plus) dépasse le bas de la fenêtre sous l'en-tête et les puces ; on fait défiler la page.

Adresses en anglais (2026-10-23, vérifié en local sur S5, en clair, en sombre et à 375 px) : `/s5/map` et `/api/s5/map` répondent, `/s5/carte` et `/api/s5/carte` 404 ; `?player=` et `?alliance=` ouvrent la puce puis laissent la place au fragment `#p=1.…` ; un lien partagé rouvre puces, filtre, référence et vitesse ; un lien illisible ouvre une carte vide avec la note, sans effacer la dernière carte du navigateur ; chaque saisie remplace le fragment sans ajouter d'entrée à l'historique.
