# Compteur de pages vues du site

Savoir quelles pages du site servent, sans mesurer les visiteurs. Décidé le 2026-11-18. Avant, le site ne mesurait rien (pas de journal d'accès dans Caddy, « ne mesure pas l'audience » sur `/privacy`).

## Ce qui est compté

- **Une page vue** : quand une page publique du site s'affiche, y compris à chaque navigation dans le site. Le navigateur envoie son **chemin** à `POST /api/view` (`fetch` avec `credentials: "omit"` et `keepalive`) : ni la requête (`?…`), ni le fragment (`#…`, où les outils gardent leurs entrées), ni cookie.
- Le site garde **un nombre par jour de Paris, par page et par serveur** (table `PageView`, schéma `accounts`, parce que le site n'écrit que là, ADR 0008). La page est la **route** : `/[server]/players/[id]` sur `s5`, jamais quel joueur, quelle alliance ou quel Espace.
- **Rien sur le visiteur** : ni adresse IP, ni navigateur, ni identifiant, ni provenance. On ne sait donc pas combien de personnes viennent, seulement combien de pages sont vues.
- **Non comptés** : le back office, les API, un chemin qui n'est pas une page du site (liste dans `apps/web/src/lib/page-views.ts`), les robots reconnus à leur `User-Agent` (et ceux qui n'exécutent pas JavaScript), une requête venue d'un autre site (`Sec-Fetch-Site` autre que `same-origin` : refusée). Un bloqueur de publicité peut empêcher l'envoi : les chiffres sont un minimum.
- **Lectures de la carte par l'extension** : `GET /api/<serveur>/map` compte une ligne `/api/[server]/map` quand la requête ne vient pas du site lui-même (la page carte du site est déjà comptée comme page). Le navigateur garde le fichier 10 minutes : au plus une lecture par joueur et par 10 minutes.
- L'écriture part après la réponse (`after()` de Next), en une seule requête SQL (`INSERT … ON CONFLICT … + 1`). Un échec est seulement logué.
- En développement, React compte deux fois chaque page (effets doublés en mode strict).

## Où le lire

`/admin/audience` (back office, `docs/features/site-back-office.md`) : pages vues aujourd'hui, sur 7 et 30 jours, par jour sur 14 jours, par page, et les lectures de la carte par serveur.

## Fichiers

- `apps/web/src/lib/page-views.ts` : pages comptées, jour de Paris, robots (testé) ;
- `apps/web/src/components/page-view-beacon.tsx` : l'envoi, monté dans `src/app/layout.tsx` ;
- `apps/web/src/app/api/view/route.ts` et `apps/web/src/server/page-views.ts` : la réception et l'écriture ;
- `apps/web/src/lib/admin/audience.ts` (testé) et `apps/web/src/app/admin/audience/page.tsx` : le back office.

Textes pour les joueurs : `/privacy` (« Ce que le site sait de vous ») et `PRIVACY.md` (lecture de la carte).

## Pistes écartées

- **Plausible, Umami** : ils lisent l'adresse IP (hachée) pour compter les visiteurs uniques ; un service de plus sur le VPS.
- **Journal de Caddy sans les IP** : les chiffres resteraient sur le VPS, et un journal compte aussi les préchargements et les robots.
- Pour le trafic venu de Google : Google Search Console, sans rien changer au site.
