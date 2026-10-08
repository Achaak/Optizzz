# API des exports publics Fourmizzz

Source : page en jeu `https://s5.fourmizzz.fr/developer.php` (lue le 2026-10-07). Contrat OpenAPI : `api-exports.fr.openapi.yaml` (lien sur cette page).

## En bref

- Lecture seule, gratuite, **sans authentification**. Servie sur l'adresse de chaque serveur (`https://s5.fourmizzz.fr`, `http://s1.fourmizzz.fr`… S1–S4 en HTTP seulement). Le domaine `www.fourmizzz.fr` répond 404.
- Depuis un content script sur `sN.fourmizzz.fr`, c'est un appel **même origine** : pas de permission en plus.
- Un export par nuit, à minuit heure de Paris, à l'origine. **Depuis le 2026-10-07 au moins, un export par heure** (versions `202610071800`, `…1900` sur S5 ; `202610080300` à `…0500` sur S2). La version est la date **UTC** `AAAAMMJJHHmm`. Historique jamais purgé.
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

Relevé le 2026-10-07 (S5) et le 2026-10-08 (S2) :

- `pacts[].name` est le **type de pacte** (« PNA », « PNA », « Total »), pas le nom de l'alliance ; `description` est libre (« PNA de 1 mois »), souvent vide.
- Une guerre n'est déclarée que d'un côté : chercher dans les deux sens.
- La casse des tags de guerre ne suit pas toujours celle des alliances (« Kiss » / « KISS ») : comparer sans la casse.
- Des alliances sont « en guerre contre elles-mêmes » (ANGE → ANGE, Evo → Evo sur S5) : à ignorer.

## Non exporté

Ressources, armée, recherches (dont la Vitesse d'attaque), dernière connexion, description d'alliance.

## Mesures sur S5 (2026-10-07)

- Export joueurs : ~330 Ko, 1 610 joueurs.
- Carte : x de −2 à 48, y de 0 à 55 au premier relevé ; le 2026-10-07 au soir, des joueurs en x = 95 (la carte grandit avec les inscriptions).
- Export alliances : 50 alliances (S5) ; S2 : 20 559 joueurs, 2 186 alliances, 15 372 colonisés.
- Le TDC (`field`) date de minuit : il bouge plusieurs fois par jour, d'où la lecture en direct sur la page Membres.

## Utilisation dans Optizzz

`src/features/alliance-map/api.ts` : on demande la liste des versions, et on ne télécharge le fichier des joueurs (`loadPlayersExport`) ou des alliances (`loadAlliancesExport`) que si sa version a changé. Cache par serveur dans `browser.storage.local`. Si l'API est injoignable, on se rabat sur le cache. Le fichier est validé avec zod.
