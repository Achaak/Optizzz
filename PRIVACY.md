# Politique de confidentialité — Optizzz

_Dernière mise à jour : 24 octobre 2026_

Optizzz est une extension pour le jeu [Fourmizzz](http://www.fourmizzz.fr). Elle ne fonctionne que sur les pages `*.fourmizzz.fr`.

## Aucune donnée collectée sans compte

Sans Compte Optizzz lié, Optizzz **ne collecte et ne transmet aucune donnée** vous concernant. Il n'y a ni statistiques d'usage, ni publicité, ni traceur, et rien n'est jamais vendu. Le Compte Optizzz est facultatif : voir « Lier l'extension à votre Compte Optizzz » plus bas.

## Ce que l'extension lit

Uniquement sur les pages du jeu, depuis votre navigateur :

- l'API publique des exports de Fourmizzz (`/api/exports/`) du serveur sur lequel vous jouez : positions, alliances et scores des joueurs, déjà publics en jeu ;
- les pages du jeu que vous ouvrez ou que l'extension consulte pour vous (Ressources, Construction, Laboratoire, Reine, Armée, Membres, messagerie de chasse…) : votre pseudo, vos ressources, vos niveaux de construction et de recherche, vos unités, les heures de fin et le terrain de chasse des membres de votre alliance.

Ces requêtes partent de votre navigateur vers Fourmizzz, comme si vous ouvriez ces pages vous-même.

Une exception : la Carte du serveur lit les positions des joueurs sur le site d'Optizzz (`https://optizzz.fr/api/<serveur>/map`), bien plus léger que l'export de Fourmizzz. Ce sont les mêmes données publiques, tirées de cet export ; la requête ne contient ni compte, ni cookie, ni rien de vous, mais comme toute visite d'un site, elle fait connaître votre adresse IP à son hébergeur (Vercel), qui garde un temps les journaux techniques. Pour ne contacter que Fourmizzz, décochez « Lire les positions sur optizzz.fr » dans les options de la Carte du serveur (« Fonctionnalités ») : la carte lit alors l'export, comme avant.

## Ouvrir un outil de optizzz.fr

Le simulateur de combat, le Lanceur de chasse et le Plan de flood ont un bouton « Ouvrir sur optizzz.fr », qui ouvre l'outil correspondant du site d'Optizzz dans un nouvel onglet, avec ce que vous avez saisi (armées, niveaux, TDC), et un bouton « Copier le lien ». Rien ne part sans votre clic. Vos entrées sont écrites dans le fragment de l'adresse (la partie après `#`), que le navigateur n'envoie jamais au site : ni le site ni son hébergeur ne les reçoivent. Comme toute visite d'un site, ouvrir l'outil fait connaître votre adresse IP à son hébergeur (Vercel). Pour ne plus voir ces boutons, décochez « Liens vers optizzz.fr » dans « Fonctionnalités ».

## Lier l'extension à votre Compte Optizzz (facultatif)

Le site d'Optizzz (optizzz.fr) propose un Compte Optizzz, ouvert par votre adresse e-mail, pour rejoindre l'Espace de votre alliance. L'extension peut y être liée, seulement si vous le demandez :

- « Connecter mon Compte Optizzz », dans les paramètres de l'extension (« Fonctionnalités »), ouvre une page qui dit ce qui partira, puis le navigateur vous demande l'accès à `optizzz.fr` (et, sur Firefox, votre accord pour l'envoi de ces données). Refusé, rien ne change.
- Sur la page « Connecter l'extension » du site, où vous êtes connecté à votre compte, l'extension reçoit un jeton propre à ce navigateur, qu'elle garde dans son stockage local. Le site n'en garde qu'une empreinte, avec le nom du navigateur (« Chrome ») et la date.
- Liée, l'extension vous propose une fois de rattacher le Joueur du serveur où vous jouez (« Rattacher Pseudo (S5) à votre Compte Optizzz »). Seulement si vous cliquez « Rattacher », elle envoie à optizzz.fr, avec le jeton, le pseudo affiché dans l'en-tête du jeu et le serveur ; le site y ajoute le numéro du joueur dans l'export public. « Non merci » est retenu, et rien ne part.
- À l'ouverture des paramètres, l'extension liée demande au site la liste des Joueurs de votre compte (avec le jeton, sans rien envoyer d'autre), pour ne pas vous proposer un Joueur déjà rattaché.
- « Déconnecter » retire le jeton du site et de l'extension. Vous pouvez aussi retirer une extension liée, ou supprimer le compte, depuis « Mon compte » sur le site.

L'extension ne lit jamais le jeu pour le site sur une minuterie : rien ne part sans votre clic, hors la liste de vos Joueurs ci-dessus. Ce que le site garde et comment il le protège : [optizzz.fr/privacy](https://optizzz.fr/privacy). Comme toute visite d'un site, ces requêtes font connaître votre adresse IP à son hébergeur (Vercel).

## Ce que l'extension envoie au jeu

Seulement sur une action de votre part : le formulaire du jeu pour lancer une chasse (Lanceur de chasse), celui pour appliquer une répartition des ouvrières (Prévisions de ressources), et celui de la page Armée pour déplacer les anti-sondes (une fourmi gardée sur le Dôme et la Loge), avec le bouton Anti-sondes ou juste après une chasse ou une attaque que vous avez envoyée. Rien n'est envoyé sans une action de votre part.

## Ce que l'extension enregistre

Dans le stockage local de votre navigateur (`storage.local`), et nulle part ailleurs, à une exception près : les outils activés, les choix de notifications et votre liste de Suivis (les joueurs et alliances suivis, et où vous en étiez de chacun) sont dans `storage.sync`, que votre navigateur synchronise entre vos appareils si vous avez activé sa synchronisation (compte Google ou Firefox) ; ils ne passent par aucun serveur d'Optizzz. Le reste :

- vos paramètres (outils activés, réglages de chaque outil) ;
- les niveaux et heures de fin lus dans le jeu, pour les afficher sur les autres pages ;
- les derniers exports publics des joueurs et des alliances téléchargés, un par serveur (pour ne pas les retélécharger), et les niveaux de Vitesse d'attaque que vous saisissez ou importez ;
- pour l'Historique de progression : les scores de tous les joueurs (TDC, Fourmilière, Technologie, Combat) de l'export de chaque nuit déjà téléchargé, pour tracer les courbes sans le retélécharger ;
- pour le Plan de flood : vos attaques envoyées en cours de route et les armées adverses que vous collez ;
- pour les Alertes : votre stock de nourriture, de matériaux et d'ouvrières lu sur chaque page du jeu, un par serveur, pour calculer le badge de l'icône, les notifications que vous avez activées et celles déjà affichées (gardées 2 jours, pour ne pas les répéter) ;
- pour les Suivis : l'état des joueurs et alliances suivis au dernier relevé (alliance, TDC, vacances, membres, guerres et pactes) et le journal de leurs changements des 30 derniers jours, un par serveur ;
- pour le Partage d'alliance : les états que vous collez depuis le salon de votre alliance, les valeurs que vous saisissez à la main, et votre dernier partage ;
- pour le Compte Optizzz (sauf si vous le coupez dans « Fonctionnalités ») : votre pseudo sur chaque serveur et le serveur de votre dernier onglet du jeu, la dernière liste des membres de votre alliance lue sur la page Membres du jeu, avec sa date (elle ne quitte pas votre navigateur), et vos refus de rattacher un Joueur ; une fois l'extension liée, son jeton et la liste des Joueurs de votre compte.

Une attaque que vous envoyez avec le Plan de flood est notée un instant dans le stockage de session de l'onglet du jeu (`sessionStorage`), le temps que la page change, puis déplacée dans le stockage local ci-dessus.

Désinstaller l'extension efface ces données.

## Permissions

- `storage` : enregistrer les paramètres et le cache décrits ci-dessus (stockage local, et synchronisé pour les interrupteurs des outils, les notifications et la liste de Suivis).
- `unlimitedStorage` : lever la limite de 10 Mo de ce stockage, que les exports d'un gros serveur (4 Mo pour les joueurs de S2) suffisent à remplir quand on joue sur plusieurs serveurs. Rien d'autre n'est stocké, et rien ne sort de votre navigateur.
- `alarms` : recalculer chaque minute le badge de l'icône (temps avant une famine ou un entrepôt plein) à partir des données déjà enregistrées, sans interroger le jeu ; et, si vous suivez des joueurs ou des alliances, télécharger chaque heure l'export public du serveur concerné (la même API publique de Fourmizzz que la Carte et les Cibles) pour noter leurs changements.
- `notifications` (facultative) : demandée seulement si vous activez une notification (famine, entrepôt plein, chantier terminé, chasse rentrée, attaque arrivée, changements de vos Suivis). Les notifications sont affichées par votre navigateur, à partir des données déjà enregistrées ou de l'export public de Fourmizzz ; rien n'est envoyé ailleurs.
- Accès à `*.fourmizzz.fr` : afficher les outils dans les pages du jeu et lire l'API publique du serveur.
- Accès à `optizzz.fr` et `scripting` (facultatives) : demandées seulement quand vous cliquez « Connecter mon Compte Optizzz ». `scripting` place un petit script sur la seule page « Connecter l'extension » du site, qui reçoit le jeton de liaison ; l'accès à `optizzz.fr` permet à l'extension liée de rattacher vos Joueurs et de lire la liste de ceux de votre compte. Sans elles, l'extension marche comme avant (la Carte du serveur lit toujours les positions publiques sur optizzz.fr sans cette permission, comme n'importe quel visiteur).

## Contact

Questions ou signalements : [issues GitHub](https://github.com/Achaak/Optizzz/issues).
