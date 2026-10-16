# Feature : Colonnes de la page Membres

Formule du trajet : `../research/temps-de-trajet.md` ; relevés de la page : `../research/fourmizzz-pages.md` (« alliance.php?Membres ») ; rôles et couleurs : `chaine-tdc.md`.

## But

Voir sur la page Membres de l'alliance combien de temps met une attaque ou un convoi vers chaque membre, et son rôle dans la chaîne de TDC, sans ouvrir son profil ni la Chaîne.

## Comportement

- **Où** : `alliance.php?Membres`, deux colonnes ajoutées à la fin de `#tabMembresAlliance`, « Trajet » puis « Rôle ». Les colonnes du jeu ne bougent pas ; son tri (Terrain, Rang…) emporte nos cellules avec leur ligne.
- **Tri** : un clic sur « Trajet » ou « Rôle » trie, un second inverse ; flèche du jeu (`forwardSort` / `reverseSort`) sur l'en-tête trié. Trajet : du plus proche au plus loin (ma ligne d'abord). Rôle : des greniers aux chasseurs, puis hors chaîne. Les « ? » restent en bas dans les deux sens. Trier par une colonne du jeu ôte notre flèche.
- **Trajet** : depuis ma fourmilière, arrondi à la minute supérieure (« 11 h 19 » pour « 11H 18m 57s » sur le profil). Infobulle : distance en cases et arrivée si l'on part maintenant. « vous » sur ma ligne ; « ? » pour un membre absent de l'export (nouveau, l'export est horaire). Positions d'après l'export public des joueurs, Vitesse d'attaque mémorisée (`game-levels`). Export injoignable ou Vitesse d'attaque illisible : colonne vide, la raison dans l'infobulle de l'en-tête.
- **Rôle** : celui de la Chaîne (rôles enregistrés, sinon proposés d'après le TDC en direct de la page ; vacances et bannis hors chaîne), dans une pastille de la couleur choisie dans « Couleurs des rôles sur la Carte », avec la forme du rôle (une seule taille : celle des bulles rendrait les lignes inégales). Un changement dans la Chaîne (autre onglet) s'affiche aussitôt. Seulement si « Chaîne de TDC » est activée.
- **Ma ligne** : surlignée (fond clair, filet rouge à gauche), « vous » dans Trajet.
- **Rechargement du jeu** : le jeu remplit `#alliance` en AJAX et peut le remplir de nouveau ; un `MutationObserver` remet les colonnes à chaque fois.
- Coupable dans « Fonctionnalités » (`members-columns`), avec une option par colonne (`trips`, `roles`).

## Vérifié

2026-10-15, S5 : 11 h 19 affiché pour un membre dont le profil donne « Temps de trajet : 11H 18m 57s » ; tri par trajet et par rôle, puis par Terrain (tri du jeu) sans décaler les cellules.

## Fichiers

- `src/features/members-columns/trips.ts` : trajets depuis ma position (pur).
- `src/features/members-columns/roles.ts` : rôle et pastille de chaque membre, comme la Chaîne et la Carte (pur).
- `src/features/members-columns/mount.ts` : les colonnes et leur tri.
- `src/features/members-columns/index.ts` : chargement de l'export, des niveaux et des réglages de la Chaîne, observation du tableau.
