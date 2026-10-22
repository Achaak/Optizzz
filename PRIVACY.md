# Politique de confidentialité — Optizzz

_Dernière mise à jour : 22 octobre 2026_

Optizzz est une extension pour le jeu [Fourmizzz](http://www.fourmizzz.fr). Elle ne fonctionne que sur les pages `*.fourmizzz.fr`.

## Aucune donnée collectée

Optizzz **ne collecte, ne transmet et ne vend aucune donnée** vous concernant. Il n'y a ni compte, ni statistiques d'usage, ni publicité, ni traceur.

## Ce que l'extension lit

Uniquement sur les pages du jeu, depuis votre navigateur :

- l'API publique des exports de Fourmizzz (`/api/exports/`) du serveur sur lequel vous jouez : positions, alliances et scores des joueurs, déjà publics en jeu ;
- les pages du jeu que vous ouvrez ou que l'extension consulte pour vous (Ressources, Construction, Laboratoire, Reine, Armée, Membres, messagerie de chasse…) : votre pseudo, vos ressources, vos niveaux de construction et de recherche, vos unités, les heures de fin et le terrain de chasse des membres de votre alliance.

Ces requêtes partent de votre navigateur vers Fourmizzz, comme si vous ouvriez ces pages vous-même.

Une exception : la Carte du serveur lit les positions des joueurs sur le site d'Optizzz (`https://optizzz.fr/api/<serveur>/carte`), bien plus léger que l'export de Fourmizzz. Ce sont les mêmes données publiques, tirées de cet export ; la requête ne contient ni compte, ni cookie, ni rien de vous, mais comme toute visite d'un site, elle fait connaître votre adresse IP à son hébergeur (Vercel), qui garde un temps les journaux techniques. Pour ne contacter que Fourmizzz, décochez « Lire les positions sur optizzz.fr » dans les options de la Carte du serveur (« Fonctionnalités ») : la carte lit alors l'export, comme avant.

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
- pour le Partage d'alliance : les états que vous collez depuis le salon de votre alliance, les valeurs que vous saisissez à la main, et votre dernier partage.

Une attaque que vous envoyez avec le Plan de flood est notée un instant dans le stockage de session de l'onglet du jeu (`sessionStorage`), le temps que la page change, puis déplacée dans le stockage local ci-dessus.

Désinstaller l'extension efface ces données.

## Permissions

- `storage` : enregistrer les paramètres et le cache décrits ci-dessus (stockage local, et synchronisé pour les interrupteurs des outils, les notifications et la liste de Suivis).
- `unlimitedStorage` : lever la limite de 10 Mo de ce stockage, que les exports d'un gros serveur (4 Mo pour les joueurs de S2) suffisent à remplir quand on joue sur plusieurs serveurs. Rien d'autre n'est stocké, et rien ne sort de votre navigateur.
- `alarms` : recalculer chaque minute le badge de l'icône (temps avant une famine ou un entrepôt plein) à partir des données déjà enregistrées, sans interroger le jeu ; et, si vous suivez des joueurs ou des alliances, télécharger chaque heure l'export public du serveur concerné (la même API publique de Fourmizzz que la Carte et les Cibles) pour noter leurs changements.
- `notifications` (facultative) : demandée seulement si vous activez une notification (famine, entrepôt plein, chantier terminé, chasse rentrée, attaque arrivée, changements de vos Suivis). Les notifications sont affichées par votre navigateur, à partir des données déjà enregistrées ou de l'export public de Fourmizzz ; rien n'est envoyé ailleurs.
- Accès à `*.fourmizzz.fr` : afficher les outils dans les pages du jeu et lire l'API publique du serveur.

## Contact

Questions ou signalements : [issues GitHub](https://github.com/Achaak/Optizzz/issues).
