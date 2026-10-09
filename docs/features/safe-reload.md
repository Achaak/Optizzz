# Feature : Rechargement sans risque

Décidée le 2026-10-09.

## But

Le jeu ne redirige pas après un formulaire : la page affichée après une ponte, une chasse ou un changement d'ouvrières reste liée au POST. La recharger fait proposer « Renvoyer les données ? », et accepter relance l'action. Les liens d'action en GET (`construction.php?Construire=9&t=…`, `?annuler=…&t=…`) ont le même défaut, sans même la question.

## Comportement

- **Toutes les pages** du jeu, dès le chargement : `history.replaceState` remplace l'entrée de l'historique par une visite simple de la même page. Recharger ou revenir en arrière fait un GET : la page s'affiche dans son état actuel, sans popup et sans action.
- **Liens d'action** : une adresse qui porte le jeton `t` perd toute sa requête (`construction.php?annuler=3&t=…` → `construction.php`). Les autres paramètres d'affichage (`Membre.php?Pseudo=…`, `ennemie.php?Attaquer=…`) et le `#` sont gardés.
- Rien n'est visible sur la page ; la feature se coupe dans « Fonctionnalités ».

## Limites

- Un paramètre d'action sans jeton `t` ne serait pas retiré : aucun n'est connu le 2026-10-09.
- Rien n'est protégé si l'on recharge avant la fin du chargement de la page (le content script n'a pas encore tourné).

## Code

| Fichier                                | Rôle                                 |
| -------------------------------------- | ------------------------------------ |
| `src/features/safe-reload/safe-url.ts` | Adresse sûre (sans requête d'action) |
| `src/features/safe-reload/index.ts`    | Remplace l'entrée de l'historique    |
