# Outils du site (étape 2b) : socle

Décidé lors d'une session de cadrage (`/grill-me`) le 2026-10-23 (ticket 04). Étape 2b du site public (`site-public.md`). Une page par outil : `site-trajets.md`, `site-couts.md`, `site-combat.md`, `site-chasse.md`, `site-flood.md` ; la carte du serveur a la sienne (`site-carte.md`).

## Adresses

Les adresses du site sont en anglais ; ce que lit le visiteur (titres, menus, libellés) reste en français. Pas de redirection depuis les anciennes adresses françaises : le site n'a pas été en ligne assez longtemps pour que des liens comptent (décidé le 2026-10-23).

| Page                     | Adresse                                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------- |
| Liste des outils         | `/tools`                                                                                    |
| Outils                   | `/tools/travel`, `/tools/costs`, `/tools/combat`, `/tools/hunt`, `/tools/flood`             |
| Pages d'un serveur       | `/s5`, `/s5/players`, `/s5/players/[id]`, `/s5/alliances`, `/s5/alliances/[tag]`, `/s5/map` |
| Données de la carte      | `/api/s5/map`                                                                               |
| Pages légales            | `/privacy`, `/legal`                                                                        |
| Paramètres d'une adresse | en anglais aussi (« Voir sur la carte » : `/s5/map?player=…`, `/s5/map?alliance=…`)         |

Les outils n'ont pas de serveur dans l'adresse : les règles (unités, combat, coûts) sont les mêmes sur tous les serveurs. Un outil qui en a besoin (trajets, flood par pseudo) a un champ Serveur, gardé dans son état.

## Page `/tools` et en-tête

- `/tools` liste les outils prévus, avec une phrase chacun ; un outil pas encore fait est listé sans lien. La carte y figure aussi (elle demande de choisir un serveur).
- Une entrée « Outils » dans l'en-tête du site, sur ordinateur et sur téléphone.
- Un gabarit de page d'outil : titre, description, formulaire, résultat. Sur téléphone, le résultat vient sous le formulaire.
- Ajouter un outil ne demande de toucher qu'à sa page et à une ligne de la liste.
- Les outils sont indexés par les moteurs de recherche : la page est rendue côté serveur, sans état ; l'état se lit dans le navigateur.

## État dans l'adresse

- L'état d'un outil (et de la carte) tient dans le **fragment** de l'adresse : `#p=1.<base64url>`. Le fragment n'est jamais envoyé au serveur : ni Vercel ni ses journaux ne voient l'armée ou les niveaux d'un lien.
- Contenu : JSON à clés courtes, en base64url, sans compression (un combat complet tient sous 1 000 caractères). Le préfixe `1.` est la version du format : quand un outil change son état, il passe à `2.` et sait encore relire `1.`.
- Chaque outil valide son état avec zod. Une adresse invalide (lien tronqué, version inconnue) est refusée proprement : l'outil s'ouvre vide, avec une note « Ce lien n'est pas valide ».
- À chaque saisie, le fragment est remis à jour (`history.replaceState` : pas une entrée d'historique par frappe). Un bouton « Copier le lien » copie l'adresse.
- Les liens de carte en `?p=…` ne sont pas relus après le passage à `#p=` (même raison que l'absence de redirection).
- Le code commun (encodage, version, validation, le schéma de l'état de chaque outil ouvrable depuis l'extension, l'adresse du site) vit dans `packages/game/src/site-links/`, partagé par le site et l'extension.

## Mémoire du navigateur

- Ouvert sans lien, un outil reprend son dernier état du navigateur (`localStorage`), comme la carte.
- **Mes niveaux** : un seul jeu de niveaux, commun à tous les outils, gardé dans le `localStorage` : Armes, Bouclier Thoracique, Vitesse d'attaque, Vitesse de chasse, Dôme, Loge Impériale, Étable à pucerons, Étable à cochenilles, Architecture, Salle d'analyse, Couveuse, Solarium, Technique de ponte (clés de `packages/game/src/levels.ts`). Chaque outil pré-remplit les niveaux qu'il demande avec « Mes niveaux ».
- Ouvert sans lien : ce que le visiteur tape dans un champ de niveau devient « Mes niveaux », sans bouton.
- Ouvert depuis un lien (partagé, ou venu de l'extension) : les niveaux du lien s'affichent, « Mes niveaux » ne bouge pas, et un bouton « Reprendre mes niveaux » remet les siens.
- Pas de page pour éditer « Mes niveaux » à part.

## Sélecteur de joueur

Un composant du socle, utilisé par les trajets et le flood : choisir un serveur, puis un joueur par son pseudo (recherche dès deux lettres, comme la recherche de l'en-tête). Il rend l'id, le pseudo, la position et le TDC du joueur, lus dans la base du site. Une position peut être saisie à la place d'un joueur (x et y).

## Depuis l'extension

- Le simulateur de combat, le Lanceur de chasse et le Plan de flood de l'extension ont deux actions : **« Ouvrir sur optizzz.fr »** (nouvel onglet, `tabs.create`, sans permission) et **« Copier le lien »**, avec leurs entrées courantes (armées, niveaux, TDC). Le lien est construit dans l'extension avec `packages/game/src/site-links/` : l'état part dans le fragment, rien n'est envoyé au site.
- Au clic seulement ; rien ne part sans action du joueur. Pas de bouton pour les trajets ni les coûts (pas d'outil semblable dans l'extension).
- Option **« Liens vers optizzz.fr »** dans « Fonctionnalités » (`catalog.ts`), cochée par défaut : décochée, les boutons disparaissent.
- `PRIVACY.md` et `docs/store/fiche.md` le disent : ouvrir un outil depuis l'extension fait visiter optizzz.fr (adresse IP connue de Vercel), sans transmettre l'armée ni les niveaux au serveur. `data_collection_permissions` reste `none`.
- Le socle fournit l'option et la construction de l'adresse ; chaque outil (tickets 09, 10, 11) pose ses boutons, et vérifie que le site donne le même résultat que l'extension pour le lien qu'elle ouvre.

## Hors 2b

Prérequis et listes de plusieurs éléments dans l'outil des coûts ; ponte des ouvrières d'une recherche ; suivi d'attaques en route sur le site ; bouton de l'extension vers les trajets ou les coûts.
