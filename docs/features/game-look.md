# Habillage du jeu

Décidé le 2026-10-12. D'abord une feature à activer, puis intégré à l'extension le même jour : toujours actif, hors du catalogue de « Fonctionnalités ».

## But

Le jeu est daté : Verdana tassé, tableaux à bordure noire, boutons natifs, aucun espacement, et un mode téléphone qui déborde sur la plupart des pages. L'habillage le retouche sans changer son ambiance.

## Décisions de cadrage

- **Toujours actif** : il fait partie de l'extension, il ne se coupe pas. Il n'y a plus de thème « classique » copiant le jeu.
- **Retouche soignée**, poussée plus loin le 2026-10-12 : mêmes couleurs (parchemin, brun, rouge des titres, vert-de-gris des menus) et mêmes images (icônes affinées, voir « Icônes »). On change la typographie (police système pour le texte, Georgia pour les titres), les espacements, les encarts (coins arrondis, ombres douces), les tableaux, les champs, les boutons, la barre du haut et ses menus, les infobulles et curseurs jQuery UI, le chat d'alliance. La colonne de gauche garde son décor (forêt) mais ses encarts découpés dans les images du jeu deviennent des panneaux vert-de-gris arrondis, à la même taille et à la même place.
- **Toutes les tailles d'écran**, avec les seuils du jeu (`design7.css`) :
  - téléphone (< 41em, 656 px) : plus aucun défilement horizontal de la page. Un tableau trop large défile dans son cadre ; les lignes de la Reine, de Construction et du Laboratoire s'enroulent (photo et description, puis coût et bouton) ; la messagerie passe en liste (participants, sujet dessous) ; la fourmilière (canvas de 750 px dont les clics sont en pixels) défile au lieu de rétrécir ; champs en 16 px (sinon iOS zoome) et boutons de 40 px de haut ;
  - tablette (41em à 61em) : marges du contenu ;
  - grand écran (≥ 97em, 1550 px) : le contenu reste une colonne de 1 240 px au plus, centrée entre les décors.
- **Les outils d'Optizzz suivent** (voir « Outils d'Optizzz » plus bas).
- **Avancer par le socle, puis page par page** : le socle couvre ce que toutes les pages partagent ; les pages qui en ont besoin sont reprises ensuite, une par une.

## Outils d'Optizzz

- **Variables** : `theme.css` n'a qu'un jeu de valeurs, sur `:root` (WXT le recopie sur `:host` dans chaque Shadow DOM). Variables ajoutées pour l'habillage : `--optizzz-title-font` (police des titres), `--optizzz-panel-shadow` (ombre des encarts), `--optizzz-field-bg`, `--optizzz-head-bg`, `--optizzz-focus-ring`. Chaque encart d'outil lit `--optizzz-radius` et `--optizzz-panel-shadow`, chaque titre `--optizzz-title-font`.
- **Contrôles natifs** (boutons, champs, listes, cases, `fieldset`, en-têtes de tableau) : restylés par `theme.css` dans la couche `@layer optizzz-controls`, seulement dans un Shadow DOM (`:host`) ou dans un bloc `optizzz-…` de la page, jamais les contrôles du jeu. Toute règle d'un outil, hors couche, l'emporte : un bouton « nu » (sans fond ni bordure) le reste.
- Les pages de l'extension (popup, simulateur de combat, permission des notifications) lisent les mêmes variables, mais gardent leurs contrôles natifs.
- La feuille de l'habillage ne lit aucune variable `--optizzz-*` : elle est là avant l'affichage, `theme.css` arrive en fin de chargement.

## Comportement

- La feuille est injectée par le manifest sur toutes les pages du jeu, et le content script pose la classe `optizzz-game-look` sur `<html>` à `document_start` : pas de flash de l'ancien style. Toutes les règles sont imbriquées sous `html.optizzz-game-look` : la classe en plus l'emporte sur les sélecteurs du jeu sans `!important` (sauf contre les styles inline du jeu).
- Colonne de gauche : les encarts s'enchaînent (ressources, « Prochaines fins », Compte+) au lieu des hauteurs fixes du jeu, qui les faisaient se chevaucher.

## Membres (`alliance.php?Membres`)

Repris le 2026-10-15 :

- titres de colonnes au-dessus de leurs valeurs : les nombres (Terrain, Technologie, Fourmilière) alignés à droite en chiffres de même largeur, Terrain décalé de la cellule d'icône qu'il couvre ;
- position et grade en retrait (gris, plus petits), pseudo en gras ;
- cellules d'icônes étroites et centrées ;
- en-tête collé sous la barre du haut au défilement (le cadre passe en `overflow: clip`, qui garde les coins arrondis sans devenir un conteneur de défilement). Pas sur téléphone : le tableau y défile dans son propre cadre, l'en-tête s'y collerait 30 px plus bas, sur la première ligne ;
- légende plus discrète, « Ajouter tous les membres à ma liste d'amis » en petit bouton.

Ma ligne en surbrillance et les colonnes « Trajet » et « Rôle » viennent de `colonnes-membres.md`.

## Téléphone

- Un tableau qui contient d'autres tableaux ou des `fieldset` est un tableau de mise en page : ses cellules s'empilent (Ennemies, profils). Un tableau de données défile dans son cadre (Membres, Ennemies, pontes en cours).
- Reine, Construction, Laboratoire : photo et description (avec le planificateur de ponte), puis le coût. Sur la Reine, le curseur prend toute la largeur, les chiffres côte à côte, le bouton de ponte à droite.
- Accueil déconnecté : la boîte de connexion garde le fond uni que le jeu lui donne (pas le sprite des menus, qui s'y répétait en mosaïque).
- Sur ordinateur, une ligne d'unité reste rectangulaire et sans ombre : Chrome redessine l'arrondi et l'ombre d'un `tr` sur chaque cellule.

## Pages vérifiées (s5, 2026-10-12)

Reine, Construction, Laboratoire, Ressources, Armée, Ennemies, Convois, Messagerie, Membres, Alliance, profil, Ma Fourmilière, Lancer une chasse, Classement des alliances : aucun débordement horizontal à 375 px.

## Icônes

Décidé le 2026-10-12 : les icônes du jeu (17 à 72 px, souvent des GIF) étaient floues sur les écrans haute densité. On garde les mêmes images, simplement agrandies (pas de nouveau dessin).

- **Lesquelles** : les `<img>` de `images/icone/` et `images/bouton/` (ressources, enveloppes, sablier, cœur, dégâts, flèches, poubelle, messagerie…), `croix.gif`, `livre.gif`, `icone/favicon.gif` (cadenas), et le sprite `bouton/sprite_menu.png` (icônes des menus, boutons Construire / Rechercher / Pondre, icônes de la colonne). Pas les photos des unités et bâtiments, ni les décors, ni les smileys, ni `attendre.gif` (animé).
- **Exceptions redessinées** : `bouton/fleche_haut.gif` et `croix.gif` (boutons ronds de 23 px) sortaient sales de l'agrandissement (contours crénelés, halo). Ils sont redessinés en SVG à l'identique : même disque bombé, mêmes couleurs, flèche et croix blanches.
- **Comment elles s'affichent** : `icons.css` remplace chaque `img[src*="images/…"]` par `content: image-set(url(…) 3x)` ; le sprite passe par `background-image: image-set(url(…) 2x)` sur les sélecteurs de `design7.css` qui l'emploient encore (pas ceux que l'habillage repeint déjà). `image-set` garde la taille d'origine en pixels CSS, même sans `width`/`height`. Vérifié dans Chrome et Firefox 157.
- **Poids** : WXT intègre les WebP en `data:` dans la feuille de l'habillage (624 Ko en tout, dont 155 Ko pour le sprite). Pas de `web_accessible_resources`.
- **Les refaire** (ajouter une icône) :
  1. télécharger les originaux dans un dossier plat (`icone_X.png`, `bouton_X.gif`…) ;
  2. `python3 scripts/game-icons/prepare.py <originaux> <entrée>` : étend les couleurs sous la transparence (sinon le blanc de fond des GIF déborde sur les bords) ;
  3. `realesrgan-ncnn-vulkan -i <entrée> -o <sortie> -n realesrgan-x4plus -s 4 -f png` ([Real-ESRGAN](https://github.com/xinntao/Real-ESRGAN), binaire `ncnn-vulkan` pour macOS) ;
  4. `python3 scripts/game-icons/finish.py <originaux> <sortie> <final>` : lisse le bord des GIF (transparence tout ou rien), ramène à 3× (sprite 2×), WebP qualité 90 (Pillow et numpy requis) ;
  5. copier dans `src/features/game-look/icons/` sous le chemin du jeu, et ajouter la règle dans `icons.css`.

## Code

| Fichier                                      | Rôle                                                                   |
| -------------------------------------------- | ---------------------------------------------------------------------- |
| `src/features/game-look/style.css`           | La feuille du jeu, tout sous `html.optizzz-game-look`                  |
| `src/features/game-look/icons.css`           | Les icônes du jeu agrandies, à la place des originales                 |
| `src/features/game-look/icons/`              | Les WebP, rangés comme dans `images/` du jeu                           |
| `scripts/game-icons/`                        | Préparation et finition de l'agrandissement (voir « Icônes »)          |
| `src/entrypoints/game-look.content/index.ts` | Pose la classe sur `<html>` à `document_start`                         |
| `src/theme/theme.css`                        | Variables des outils et contrôles restylés (`@layer optizzz-controls`) |
