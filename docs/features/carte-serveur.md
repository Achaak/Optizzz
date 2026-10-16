# Feature : Carte du serveur

Décidé lors d'une session de cadrage (`/grill-me`) le 2026-10-16.

## But

Situer des joueurs et des alliances par rapport à soi et à son alliance (« où est X ? »), et préparer une guerre (une ou plusieurs alliances face à la sienne : qui est exposé, qui est loin). Les cibles à portée restent l'affaire de `cibles.md` ; la vue d'ensemble du serveur vient du fond de carte.

Vue distincte de la Carte de l'alliance (`alliance-map.md`), pensée pour l'organisation interne : les deux partagent le socle du graphe (axes de même échelle, zoom).

## Comportement

- **Accès** : page de l'extension `server-map.html` (React), ouverte **par-dessus la page dans une fenêtre** comme le Simulateur de combat (`combat-simulator.md`) :
  - bouton « carte » dans la barre du haut, sur toutes les pages ;
  - lien « Ouvrir dans un nouvel onglet » dans la fenêtre, et entrée « Carte du serveur » dans la popup (serveur du dernier onglet du jeu) ;
  - lien « Voir sur la carte » sur le profil d'un joueur et sur la page d'une alliance : la fenêtre s'ouvre sur place avec cette sélection.
  - Le serveur et la cible passent dans l'adresse de la page (`?server=https://s5.fourmizzz.fr&target=alliance:TAG`).
- **Fond** : tous les joueurs du serveur en points gris discrets (série `scatter` en mode `large`, 20 000 points sur S2). Bannis masqués partout ; vacances grisées, colonisés préfixés par ⛓ (comme la Carte de l'alliance). Pas de trait de colonisation (« colonisé par X » au survol). Case « les autres joueurs » pour masquer ce fond.
- **Sélection** en puces de couleur :
  - un seul champ de recherche pour les joueurs et les alliances (icône pour les distinguer), sans casse ni accents, sur le début ou le milieu du pseudo, du tag ou du nom ; 10 suggestions au plus. Un joueur sans alliance est une puce à lui seul ;
  - puce « Sans alliance » : tous les joueurs sans alliance (bannis exclus), vacances grisées et colonisés ⛓ comme ailleurs. Proposée par la recherche (« sans alliance », avec leur nombre) et par le bouton « + Sans alliance (517) », puis « Sans alliance ajoutés », désactivé. Elle se dessine comme une alliance (pseudos au zoom) mais sans tag au centre, puisque ses joueurs sont dispersés ; ils entrent dans le tableau. La puce d'un joueur l'emporte sur elle ;
  - à l'ouverture : vous (toujours marqué, pas une puce), votre alliance en puce (retirable) et la dernière sélection, mémorisée par serveur. Un lien « Voir sur la carte » remplace la sélection mémorisée par sa cible, en gardant votre alliance ;
  - boutons « + Mes pactes » et « + Mes guerres » (export des alliances ; guerre cherchée dans les deux sens, sans la casse, guerre contre soi ignorée) : une famille de teintes par camp (pactes en bleus, guerres en rouges et orangés : jamais vert contre rouge, pour les daltoniens) ; le bouton compte les alliances pas encore sur la carte (« + Mes pactes (3) »), puis « Pactes ajoutés » ou « Aucun pacte », désactivé. Absents sans alliance ;
  - **filtre** sur une puce d'alliance ou « Sans alliance » (lien « filtrer ») : bornes min et max, comprises, sur le TDC, la Fourmilière et la Technologie (les scores du classement, tirés de l'export, pas des niveaux de bâtiment ; sur S5 la Fourmilière va de 0 à 103). Les bornes se règlent sous les puces, une puce à la fois, une ligne par critère (min « à » max), avec le nombre de joueurs retenus (« 12 joueurs sur 30 »), « Effacer » et « Fermer ». Le TDC se tape comme le jeu l'écrit ou en abrégé (« 10 000 », « 10k », « 1,5M ») ; « à ma portée » le borne de 50 % à 300 % (exclu) de votre TDC de l'export, comme `inRange`. La puce écrit son filtre (« EVO TDC ≥ 10 000 · Fourmilière 10 à 20 »). Les joueurs écartés retombent dans le fond gris et sortent du tableau ; la puce d'un joueur n'a pas de filtre et l'emporte toujours. Filtre mémorisé avec la puce ;
  - couleurs attribuées dans la palette du thème (`src/theme/`), votre alliance a une couleur fixe ; un clic sur la puce change la couleur. Couleurs mémorisées avec la sélection.
- **Dessin** : points colorés par puce. Pseudos affichés seulement quand on a assez zoomé (peu de joueurs sélectionnés dans la vue) ; dézoomé, le tag de chaque alliance au centre de ses membres. Un joueur sélectionné seul a toujours son pseudo. Les noms ne se chevauchent pas : chacun prend la première place libre autour de son point (vous, la référence et le joueur survolé d'abord, puis les joueurs seuls, puis les membres d'alliance), recalculée à chaque zoom ; sans place libre, le nom est masqué. Case « tous les noms » (décochée par défaut) : le pseudo de chaque joueur choisi quel que soit le zoom, sans tag ; sans place libre, il est écrit là où il chevauche le moins (trop de noms pour la place dézoomé : zoomer les sépare).
- **Afficher :** trois cases mémorisées par serveur au-dessus de la carte : « ma position », « les autres joueurs », « tous les noms ».
- **Forme** : la zone de tracé prend la forme du serveur (même échelle sur les deux axes, hauteur selon la largeur, 720 px au plus) plutôt qu'un carré : pas de bande vide. Graduations rondes choisies par ECharts, aussi dans une fenêtre zoomée ; les bords de la fenêtre ne sont pas écrits. Chaque cadrage a la forme de la zone de tracé et reste dans le serveur.
- **Cadrage** : ouverture cadrée sur la sélection (vous + puces) avec une marge ; ajouter une puce recadre pour l'inclure. Boutons « Cadrer la sélection » (retour au cadrage sur vous et les puces) et « Voir tout le serveur » (dézoom sur toute la carte). La carte tient dans la fenêtre (hauteur selon la largeur, 720 px au plus et pas plus que la fenêtre moins l'en-tête, 320 px au moins). Case « ma position » (cochée par défaut) : décochée, votre losange disparaît et vous n'êtes plus qu'un point de votre alliance si sa puce est là ; les distances restent mesurées depuis vous, le cadrage ne vous inclut plus. Mêmes contrôles que la Carte de l'alliance : Ctrl + molette autour du curseur, glisser, pincer.
- **Interactions** :
  - survol : pseudo, alliance, coordonnées, TDC (export), état, distance et trajet depuis la référence ;
  - clic : le joueur devient la **référence** des distances (vous par défaut ; lien « depuis vous » au-dessus du tableau pour y revenir) ;
  - double-clic : ouvre son profil.
- **Tableau** sous la carte : les joueurs des puces triés par distance à la référence, tri par clic sur les en-têtes (flèche sur la seule colonne cliquée), défilement interne de hauteur fixe. Colonnes : pseudo (lien profil), alliance (couleur de la puce), coordonnées, distance (« 18,4 »), trajet référence → joueur, TDC (export), état (vacances, ⛓, banni). Loupe : zoom sur le joueur. Survol d'une ligne ↔ joueur mis en évidence sur la carte.
- **Trajet** (`../research/temps-de-trajet.md`) : même règle que la Carte de l'alliance (`levelOf`) : un niveau saisi sur la Carte de l'alliance, le vôtre relu sur le Laboratoire (`game-levels`, sans requête depuis la carte), ou la vitesse partagée d'un membre (« Partage d'alliance ») ; sinon le niveau par défaut (le vôtre), marqué « ≈ ». Un seul sens : la vitesse des joueurs hors alliance est inconnue.
- **Données** : dernière version de l'export des joueurs et des alliances (`src/data/exports.ts`, une par heure), date en tête à l'heure de Paris (« Positions de l'export public (aujourd'hui 14 h 00) ») ; l'API injoignable, la dernière version en cache, dont la date dit l'âge. Pas de TDC en direct (on ne l'a que pour son alliance).
- **Interrupteur** « Carte du serveur », options cochées par défaut : « Bouton dans la barre du haut », « Lien « Voir sur la carte » sur les profils », « Lien « Voir sur la carte » sur les pages d'alliance ». Coupée : ni bouton ni lien ; la page affiche « Carte du serveur désactivée ».
- **Petits écrans** : sous 600 px, le panneau prend toute la largeur, la carte aussi (pas de marge réservée aux noms, graduations espacées d'environ 70 px), le tableau masque Coordonnées et État et coupe les pseudos longs. Sur écran tactile, l'aide parle de pincer et de toucher.
- **Mémorisé par serveur** (`browser.storage.local`) : sélection, couleurs et cases « Afficher : » ; le pseudo connecté et le serveur du dernier onglet (pour la popup), notés par le script léger.
- Zoom : ouverture, ajout de puces, loupe et boutons font une « demande » de cadrage ; la zone affichée est la dernière demande ou le dernier zoom à la main (lu sur la grille par `convertFromPixel`), le plus récent des deux. Elle décide pseudos ou tags (40 joueurs choisis en vue au plus).

## Hors v1

Zones autour des alliances, recherche par coordonnées, trajet dans les deux sens, traits de colonisation, TDC en direct.

## Code

| Fichier                                                     | Rôle                                                                        |
| ----------------------------------------------------------- | --------------------------------------------------------------------------- |
| `src/features/server-map/index.ts` (+ test)                 | Bouton de la barre du haut, liens « Voir sur la carte », mémoire            |
| `src/features/server-map/open.ts` (+ test)                  | Adresse de la page, message au script d'arrière-plan                        |
| `src/features/server-map/selection.ts` (+ test)             | Recherche, puces, couleurs, sélection à l'ouverture                         |
| `src/features/server-map/filter.ts` (+ test)                | Filtre d'une puce : bornes TDC, Fourmilière, Technologie                    |
| `src/features/server-map/view.ts` (+ test)                  | Pseudos ou tags, centres des alliances, lignes du tableau, zoom             |
| `src/features/server-map/chart-option.ts` (+ test)          | Option ECharts : fond, joueurs choisis, vous, tags                          |
| `src/features/server-map/ServerMap.tsx` (+ test de montage) | La page                                                                     |
| `ChipBar.tsx`, `ServerMapChart.tsx`, `PlayerTable.tsx`      | Recherche et puces, carte, tableau                                          |
| `src/features/server-map/settings.ts`                       | Mémoire par serveur                                                         |
| `src/game/diplomacy.ts` (+ test)                            | Pactes et guerres (partagé avec les Cibles)                                 |
| `src/utils/map-chart/`                                      | Axes, zone, zoom, placement des noms (partagés avec la Carte de l'alliance) |
| `src/utils/page-dialog.ts` (+ test), `page-dialog-frame.ts` | Fenêtre par-dessus le jeu (partagée avec le Simulateur)                     |
| `src/entrypoints/server-map/`                               | Page de l'extension                                                         |

La carte elle-même se vérifie à la main.
