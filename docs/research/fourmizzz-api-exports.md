# API des exports publics Fourmizzz

Source : page en jeu `https://s5.fourmizzz.fr/developer.php` (lue le 2026-10-07). Contrat OpenAPI : `api-exports.fr.openapi.yaml` (lien sur cette page).

## En bref

- Lecture seule, gratuite, **sans authentification**. Servie sur l'adresse de chaque serveur (`https://s5.fourmizzz.fr`, `http://s1.fourmizzz.fr`… S1–S4 en HTTP seulement). Le domaine `www.fourmizzz.fr` répond 404.
- Depuis un content script sur `sN.fourmizzz.fr`, c'est un appel **même origine** : pas de permission en plus.
- Un export par nuit, à minuit heure de Paris. La version est la date **UTC** `AAAAMMJJHHmm` (`…2200` en été, `…2300` en hiver). Historique jamais purgé.
- Une version publiée ne change plus (sauf relance du job dans la même minute) → on la garde en cache.

## Routes

| Requête                                      | Réponse                                                                      |
| -------------------------------------------- | ---------------------------------------------------------------------------- |
| `GET /api/exports/`                          | `{ "players": [versions…], "alliances": [versions…] }`, plus récente d'abord |
| `GET /api/exports/players/` (`?version=…`)   | Tableau des joueurs, trié par id                                             |
| `GET /api/exports/alliances/` (`?version=…`) | Tableau des alliances, trié par tag                                          |

Le `/` final compte (sinon 301). Erreurs : toujours `{"error": "…"}` en JSON ; se fier au code HTTP (400 version invalide, 404 pas d'export, 502/503 incident).

## Joueur

`id`, `pseudo`, `alliance` (tag ou null), `masterPlayerId` (colonisateur ou null), `x`, `y`, `field` (TDC en cm²), `grade` (ou null), `buildingScore`, `technologyScore`, `trophyScore`, `onHoliday`, `isBanned`.

Un joueur s'identifie par **serveur + id** (le pseudo peut changer).

## Alliance

`tag`, `name`, `playersCount`, `totalField`, `totalBuildingScore`, `totalTechnologyScore`, `totalTrophyScore`, `diplomacy.pacts[] { tag, name, description }`, `diplomacy.wars[]` (tags).

## Non exporté

Ressources, armée, recherches (dont la Vitesse d'attaque), dernière connexion, description d'alliance.

## Mesures sur S5 (2026-10-07)

- Export joueurs : ~330 Ko, 1 610 joueurs.
- Carte : x de −2 à 48, y de 0 à 55.
- Le TDC (`field`) date de minuit : il bouge plusieurs fois par jour, d'où la lecture en direct sur la page Membres.

## Utilisation dans Optizzz

`src/features/alliance-map/api.ts` : on demande la liste des versions, et on ne télécharge le fichier des joueurs que si la version a changé. Cache par serveur dans `browser.storage.local`. Si l'API est injoignable, on se rabat sur le cache. Le fichier est validé avec zod.
