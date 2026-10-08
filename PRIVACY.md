# Politique de confidentialité — Optizzz

_Dernière mise à jour : 8 octobre 2026_

Optizzz est une extension pour le jeu [Fourmizzz](http://www.fourmizzz.fr). Elle ne fonctionne que sur les pages `*.fourmizzz.fr`.

## Aucune donnée collectée

Optizzz **ne collecte, ne transmet et ne vend aucune donnée**. Il n'y a ni serveur Optizzz, ni statistiques d'usage, ni publicité, ni traceur.

## Ce que l'extension lit

Uniquement sur les pages du jeu, depuis ton navigateur :

- l'API publique des exports de Fourmizzz (`/api/exports/`) du serveur sur lequel tu joues : positions, alliances et scores des joueurs, déjà publics en jeu ;
- les pages du jeu que tu ouvres ou que l'extension consulte pour toi (Ressources, Construction, Laboratoire, Reine, Armée, Membres, messagerie de chasse…) : ton pseudo, tes ressources, tes niveaux de construction et de recherche, tes unités, les heures de fin et le terrain de chasse des membres de ton alliance.

Ces requêtes partent de ton navigateur vers Fourmizzz uniquement, comme si tu ouvrais ces pages toi-même.

## Ce que l'extension envoie au jeu

Seulement quand tu cliques : le formulaire du jeu pour lancer une chasse (Lanceur de chasse) ou appliquer une répartition des ouvrières (Prévisions de ressources). Rien n'est envoyé automatiquement.

## Ce que l'extension enregistre

Dans le stockage local de ton navigateur (`storage.local`), et nulle part ailleurs :

- tes paramètres (outils activés, réglages de chaque outil) ;
- les niveaux et heures de fin lus dans le jeu, pour les afficher sur les autres pages ;
- les derniers exports publics des joueurs et des alliances téléchargés, un par serveur (pour ne pas les retélécharger), et les niveaux de Vitesse d'attaque que tu saisis ou importes ;
- pour l'Historique de progression : les scores de tous les joueurs (TDC, Fourmilière, Technologie, Combat) de l'export de chaque nuit déjà téléchargé, pour tracer les courbes sans le retélécharger ;
- pour le Plan de flood : tes attaques envoyées en cours de route et les armées adverses que tu colles ;
- pour les Alertes : ton stock de nourriture, de matériaux et d'ouvrières lu sur chaque page du jeu, un par serveur, pour calculer le badge de l'icône, les notifications que tu as activées et celles déjà affichées (gardées 2 jours, pour ne pas les répéter).

Une attaque que tu envoies avec le Plan de flood est notée un instant dans le stockage de session de l'onglet du jeu (`sessionStorage`), le temps que la page change, puis déplacée dans le stockage local ci-dessus.

Désinstaller l'extension efface ces données.

## Permissions

- `storage` : enregistrer les paramètres et le cache décrits ci-dessus.
- `unlimitedStorage` : lever la limite de 10 Mo de ce stockage, que les exports d'un gros serveur (4 Mo pour les joueurs de S2) suffisent à remplir quand on joue sur plusieurs serveurs. Rien d'autre n'est stocké, et rien ne sort de ton navigateur.
- `alarms` : recalculer chaque minute le badge de l'icône (temps avant une famine ou un entrepôt plein) à partir des données déjà enregistrées. L'extension n'interroge pas le jeu en arrière-plan pour cela.
- `notifications` (facultative) : demandée seulement si tu actives une notification (famine, entrepôt plein, chantier terminé, chasse rentrée). Les notifications sont affichées par ton navigateur, à partir des données déjà enregistrées ; rien n'est envoyé ailleurs.
- Accès à `*.fourmizzz.fr` : afficher les outils dans les pages du jeu et lire l'API publique du serveur.

## Contact

Questions ou signalements : [issues GitHub](https://github.com/Achaak/Optizzz/issues).
