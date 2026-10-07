# Politique de confidentialité — Optizzz

_Dernière mise à jour : 7 octobre 2026 (version 1.0.1)_

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
- le dernier export des joueurs téléchargé (pour ne pas le retélécharger) et les niveaux de Vitesse d'attaque que tu saisis ou importes.

Désinstaller l'extension efface ces données.

## Permissions

- `storage` : enregistrer les paramètres et le cache décrits ci-dessus.
- Accès à `*.fourmizzz.fr` : afficher les outils dans les pages du jeu et lire l'API publique du serveur.

## Contact

Questions ou signalements : [issues GitHub](https://github.com/Achaak/Optizzz/issues).
