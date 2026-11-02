# Feature : Liens vers optizzz.fr depuis le jeu

Décidé le 2026-11-02. Complète les boutons « Ouvrir sur optizzz.fr » des outils (`site-outils.md`) : un chemin vers le site depuis n'importe quelle page du jeu, et depuis ce que le joueur regarde.

## Ce que voit le joueur

- **Menu Fourmilière** : une entrée « Optizzz.fr », après « Ma Fourmilière » (et « Mon état » s'il est là). Elle ouvre dans un nouvel onglet la page du serveur courant sur le site (`/s5` : classements, carte, journal). Le menu Fourmilière plutôt que la barre du haut : celle-ci a déjà quatre boutons, repliés derrière « … » sur téléphone ; et plutôt que le menu Alliance, absent sans alliance.
- **Profil** (`Membre.php`) : une ligne « Optizzz : Voir sur optizzz.fr » sous « Etat » (et sous « Suivis »), vers `/s5/players/<id>`. Le site nomme les joueurs par l'id de l'export : le lien n'apparaît que si le dernier export connaît le pseudo.
- **Page d'une alliance** (`classementAlliance.php?alliance=TAG`) : « Voir sur optizzz.fr » sous son nom (et sous « Suivre »), vers `/s5/alliances/<TAG>`.
- **« À propos »** (fenêtre des réglages et popup) : un lien vers le site, toujours présent, comme ceux de GitHub.

Rien que sur les serveurs que suit le site (`packages/game/src/servers.ts`). Ce sont de simples liens : aucune requête, aucune permission, rien n'est envoyé au site que l'adresse de la page ouverte.

## Option

Sous l'option existante **« Liens vers optizzz.fr »** (`catalog.ts`, cochée par défaut) : la décocher retire aussi l'entrée de menu et les liens des profils et des alliances. Le lien d'« À propos » reste.

## Fichiers

| Fichier                                                    | Rôle                                                                                         |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `packages/game/src/site-links/site.ts` (+ test)            | `siteServerPath`, `sitePlayerPath`, `siteAlliancePath` : les adresses des pages d'un serveur |
| `apps/extension/src/features/site-links/index.ts`          | La feature : entrée de menu, et lien selon la page                                           |
| `apps/extension/src/features/site-links/mount.ts` (+ test) | Les liens du profil et de la page d'alliance, à leur place par rapport à « Suivre »          |
| `apps/extension/src/utils/alliance-menu.ts` (+ test)       | Ordre des entrées d'Optizzz dans le menu Fourmilière, lien dans un nouvel onglet             |
| `apps/extension/src/features/settings/about-section.ts`    | Le lien vers le site dans « À propos »                                                       |
