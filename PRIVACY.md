# Politique de confidentialité — Optizzz

_Dernière mise à jour : 7 octobre 2026_

Optizzz est une extension pour le jeu [Fourmizzz](http://www.fourmizzz.fr). Elle ne fonctionne que sur les pages `*.fourmizzz.fr`.

## Aucune donnée collectée

Optizzz **ne collecte, ne transmet et ne vend aucune donnée**. Il n'y a ni serveur Optizzz, ni statistiques d'usage, ni publicité, ni traceur.

## Ce que l'extension lit

Uniquement sur les pages du jeu, depuis ton navigateur :

- l'API publique des exports de Fourmizzz (`/api/exports/`) du serveur sur lequel tu joues : positions, alliances et scores des joueurs, déjà publics en jeu ;
- les pages du jeu que tu ouvres : ton pseudo, le terrain de chasse des membres de ton alliance (page Membres) et ton niveau de Vitesse d'attaque (page Laboratoire).

Ces requêtes partent de ton navigateur vers Fourmizzz uniquement, comme si tu ouvrais ces pages toi-même.

## Ce que l'extension enregistre

Dans le stockage local de ton navigateur (`storage.local`), et nulle part ailleurs :

- le dernier export des joueurs téléchargé (pour ne pas le retélécharger) ;
- tes réglages de la carte d'alliance et les niveaux de Vitesse d'attaque que tu saisis ou importes.

Désinstaller l'extension efface ces données.

## Permissions

- `storage` : enregistrer les réglages et le cache décrits ci-dessus.
- Accès à `*.fourmizzz.fr` : afficher les outils dans les pages du jeu et lire l'API publique du serveur.

## Contact

Questions ou signalements : [issues GitHub](https://github.com/Achaak/Optizzz/issues).
