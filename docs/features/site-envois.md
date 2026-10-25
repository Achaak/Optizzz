# Envois et leurs vues (étape 4)

Décidé lors d'une session de cadrage (`/grill-me`) le 2026-10-25 (ticket 19). Étape 4 de `site-optizzz.md`, après les Espaces d'alliance (`site-comptes-espaces.md`). Vocabulaire : `GLOSSARY.md` ; décisions de fond : ADR 0005 ; règlement du jeu : `../research/reglement.md`.

## La Clé d'alliance dans l'extension

- **Le site la passe à l'extension** : quand l'accès à l'espace est ouvert sur optizzz.fr, la page de l'espace passe à l'extension les versions de la Clé d'alliance, par le pont qui sert déjà à la page Membres (script `optizzz-space`). Jamais la clé privée : l'extension ne tient que la Clé d'alliance, et rien n'est à taper.
- **Durée** : celle du site. Jusqu'à la fermeture du navigateur, ou 30 jours si « Se souvenir sur cet appareil » est coché sur le site. « Se déconnecter » (site ou extension) l'efface.
- **Une version manque** (après une exclusion) : l'extension n'envoie plus et dit « Ouvrez votre espace sur optizzz.fr pour reprendre l'envoi ».
- **Où l'on chiffre** : dans le fond de l'extension (ou une de ses pages), jamais dans le script léger (garde ESLint de libsodium). Les scripts du jeu demandent au fond ce qu'ils affichent, déjà déchiffré.

## Ce que contient un Envoi

- **À l'intérieur du chiffré** : le Joueur, le Serveur, la catégorie et l'heure du relevé. Celui qui lit rejette un Envoi dont l'intérieur ne correspond pas à la ligne où le site l'a rangé, et garde le plus récent : le site ne peut ni recopier l'Envoi d'un membre sous le nom d'un autre, ni faire passer un vieil Envoi pour neuf. Pas de signature (l'extension n'a pas la clé privée) : un membre pourrait fabriquer l'Envoi d'un autre, ce qu'on accepte entre membres.
- **Version de la clé** : on chiffre avec la plus haute version connue. Navigateur et extension retiennent la plus haute version vue et refusent d'en utiliser une plus basse (ADR 0005, « Une version cachée »).

## Catégories et réglages

- **Où** : dans l'extension, partie « Compte Optizzz » de « Fonctionnalités », **par Joueur** (un pseudo sur S2 et un autre sur S5 se règlent à part). Toutes décochées par défaut, chacune avec une phrase simple qui dit ce qui part (« Vos convois envoyés, reçus et en route »).
- **Six catégories** :
  - **Production** : TDC, ouvrières, taxe prélevée, chasses qui rapportent (page Ressources), colonisateur et ce qu'on lui verse, colonies et ce qu'elles rapportent (page Colonies, lue désormais par `collect` et relue à l'ouverture d'une page comme les autres) ;
  - **Convois** : ses convois en route (page Commerce), l'historique envoyés et reçus (messagerie), et les convois en route vers soi (page Commerce, nouvelle lecture de `collect`, sans requête de plus). Un même convoi vu par celui qui l'envoie et par celui qui le reçoit ne compte qu'une fois ;
  - **Floods** : chaque attaque en route de la liste « Attaque(s) en cours » de la page Armée, avec sa cible et son arrivée ; pour celles du Plan de flood, aussi la prise attendue et l'armée envoyée ;
  - **Chasses** : en cours, retour et gain ;
  - **Armée** : Rien, Nombre ou Par unité (comme « Mon état ») ;
  - **Niveaux et chantiers**.
- **Retirée : « Attaques reçues ».** Le jeu ne montre nulle part les attaques en route vers soi, et aucun rapport de défense n'a été vu (`alertes.md`, `../research/fourmizzz-pages.md`). À revoir si une source apparaît. Les floods des membres sur d'autres membres se voient quand même (« Floods en route vers l'alliance »).
- La page de l'espace montre ce que chaque membre envoie (« Envoie : convois, floods »), sans pouvoir le changer.

## Quand part un Envoi

- Quand ce que l'extension garde pour une catégorie cochée change, l'Envoi part quelques secondes après, avec l'état complet de la catégorie.
- Les relectures en arrière-plan déclenchées par l'ouverture d'une page du jeu (données de plus de 15 minutes, par exemple) comptent comme une action du joueur, comme aujourd'hui.
- Cocher une catégorie envoie tout de suite ce que l'extension sait déjà.
- **Jamais** d'Envoi depuis une minuterie, ni de lecture du jeu faite pour le site (`../research/reglement.md` : l'extension synchronise ce que montre la page affichée).

## Relève

Toutes les 5 minutes et à l'ouverture d'une page du jeu, l'extension relève le site (jamais le jeu), seulement si elle est liée, que le Joueur est dans un espace et qu'elle a la Clé d'alliance. Elle ne demande que ce qui a changé depuis la dernière relève.

## Qui voit quoi

- **Tous les membres voient tout** : Production, Solde, Priorité, Demandes, niveaux, chasses, floods (cible, arrivée, prise attendue), convois, armée en Nombre.
- **Sans condition** : un membre qui n'envoie rien voit ce que les autres envoient. Seule exigence déjà décidée : faire une Demande demande d'envoyer Production et Convois.
- **Réservé aux Admins : la composition exacte des armées** (l'Armée « Par unité » et l'armée envoyée de chaque flood). Ces détails voyagent dans un chiffré à part que le site ne renvoie qu'aux Admins. C'est réservé **par le site, pas par le chiffrement** : tous les membres ont la même Clé d'alliance, et quelqu'un qui tiendrait le site pourrait passer ce chiffré à un membre. Écrit tel quel dans `PRIVACY.md`. Une seconde clé réservée aux Admins reste possible plus tard si le besoin se confirme.

## Vues

- **Sur le site**, la page de l'espace gagne trois onglets :
  - **Floods** : par cible, avec qui, combien et l'arrivée ;
  - **Convois** : dans les deux sens, par membre, filtrables ;
  - **État** : l'ancien « Partage », fusionné ; les unités n'apparaissent qu'aux Admins.
- **Dans le jeu**, aux endroits qui existent déjà :
  - **page Armée**, sous « Attaque(s) en cours », un encart « Floods en route vers l'alliance » : d'abord ceux qui vous visent (« Pseudo, arrivée aujourd'hui 18 h 12, prise attendue 12 348 »), puis ceux qui visent les autres membres, par cible ; note : « Seuls les floods des membres qui les envoient à Optizzz apparaissent ici » ;
  - **page Commerce** : les convois de l'alliance en route vers vous ;
  - **Plan de flood et Cibles** : « déjà visée par Pseudo, arrivée 18 h 12 » ;
  - **vue « Partage »** : fusionne Envois et copier-coller, le relevé le plus récent l'emportant ; les unités pour les Admins seulement.

## Notifications

Deux, décochées par défaut, dans le système d'alertes existant (`alertes.md`) : « Un convoi de Pseudo vous arrive à 18 h 12 » et « Pseudo vous floode : arrivée aujourd'hui 18 h 12 ». Le reste passera par Discord (étape 6).

## Ce que garde le site

- **États** (Production, Chasses, Armée, Niveaux et chantiers) : une ligne chiffrée par Joueur et par catégorie, avec le dernier relevé et le précédent ; l'armée par unité dans une ligne à part, réservée aux Admins.
- **Listes** (Convois, Floods) : une ligne chiffrée par élément, avec en clair seulement l'heure qui sert à l'effacer. L'armée détaillée d'un flood dans un chiffré à part, réservé aux Admins.
- **Doublons** : une empreinte tirée de la Clé d'alliance reconnaît le même convoi ou le même flood ; le site ne voit ni la cible, ni le destinataire, ni les quantités.
- **Conservation** (`site-optizzz.md`) : convois 90 jours ; floods et chasses jusqu'à l'arrivée plus 7 jours ; états, le dernier et le précédent. Supprimer son compte efface ses Envois.

## Tickets

20 (le circuit et les Convois), 21 (Floods et « floods sur nous »), 22 (Chasses, Armée, Niveaux, Production, Partage fusionné), puis les Demandes (23, 24) et Discord (25, 26).
