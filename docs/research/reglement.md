# Règlement du jeu : outils et données

Lu le 2026-10-22 sur `http://www.fourmizzz.fr/reglement.php` et `/cgu.php` (version du 16 octobre 2026), sans connexion. `https://` refuse la connexion, seul `http://www.` répond.

## Outils et extensions (C1 à C3)

- Le principe : l'optimisation est permise, l'automatisation interdite.
- Permis : une extension qui synchronise avec un site externe ce que montre la page affichée ; enchaîner des actions lancées par le joueur (chasses, floods, convois) ; les outils communautaires (cartes, statistiques, simulateurs), tant que le clic final revient au joueur.
- Interdit : se reconnecter tout seul, rester connecté plus de 30 minutes, agir sans intervention humaine, ou récolter des informations (TDC, chats…) sans intervention du joueur. L'API des exports est le seul moyen permis de récolter automatiquement.
- Un bot coûte un an de bannissement.

## Comptes (B1 à B3)

- Un joueur, un compte par serveur ; le partage de compte coûte un an de bannissement. Seul le sitting validé à l'avance (7 jours au plus, constructions et recherches) permet d'entrer dans le compte d'un autre.

## Partage hors du jeu

- Rien n'interdit d'envoyer ses données à un site externe. Publier une armée ou un rapport de combat est interdit seulement dans le jeu : chat général, description d'alliance ou de profil (E3).

## Pages sans session

- `Membre.php`, `alliance.php` et `classement.php` exigent une session : sans connexion, ils répondent « Session expirée » ou redirigent vers `index.php`. Un site externe ne peut donc pas lire un profil pour vérifier un joueur. Les exports `/api/exports/` restent publics.
