# 0007 — libsodium, Better Auth et liaison de l'extension par le domaine du site

**Date** : 2026-10-22 · **Statut** : accepté

## Contexte

Le chiffrement de bout en bout (ADR 0005) et la connexion par lien magique demandent des briques qu'on ne remplace pas sans migrer toutes les données ni reconnecter tous les comptes.

## Décision

- **Chiffrement : libsodium** (`libsodium-wrappers-sumo`) : boîtes scellées pour transmettre la Clé d'alliance à la clé publique d'un membre, XChaCha20-Poly1305 pour les données, Argon2id pour dériver une clé de la Phrase de chiffrement. Le chiffrement du navigateur (WebCrypto) n'a pas Argon2. Dans l'extension, libsodium n'est chargé que par le background et les pages de l'extension, jamais par le script léger de toutes les pages.
- **Authentification : Better Auth**, avec son lien magique (l'option de create-t3-app), plutôt qu'Auth.js.
- **Liaison de l'extension** : l'extension a accès à `optizzz.fr` ; un script injecté sur la page « Connecter l'extension » du site lui transmet un jeton. `externally_connectable` est écarté : Firefox le gère mal.

## Conséquences

- Nouvelle permission d'hôte `*://optizzz.fr/*`, **facultative** (`optional_host_permissions`), demandée au clic sur « Connecter mon Compte Optizzz » (précisé le 2026-10-23, `docs/features/site-comptes-espaces.md`) : obligatoire, elle aurait désactivé l'extension de tous les joueurs à la mise à jour, compte ou pas. `PRIVACY.md`, `docs/store/fiche.md` et `data_collection_permissions` à mettre à jour avant de publier.
- Précisé le 2026-10-24 (ticket 16) : le script injecté n'est pas déclaré dans le manifest (un `content_scripts` sur optizzz.fr serait une permission d'hôte obligatoire) ; il est enregistré à l'exécution (`scripting.registerContentScripts`), d'où `scripting`, facultative elle aussi et demandée au même clic. Sur Firefox, le même clic demande le consentement `authenticationInfo` et `websiteContent` (`data_collection_permissions` facultatives). Détail dans `docs/features/site-comptes-espaces.md`.
- Précisé le 2026-10-25 (ticket 17) : sous la même permission, un second script de l'extension est enregistré sur les pages des Espaces d'alliance (`https://optizzz.fr/spaces/*`). Il passe à la page, par `window.postMessage`, la dernière liste de la page Membres du jeu quand un Admin clique « Donner l'accès » : la page parle à l'extension par un script injecté, comme pour la liaison, et toujours sans `externally_connectable`. La liste reste dans le navigateur.
- Précisé le 2026-10-25 (ticket 18) : le même script répond aussi à la page d'un espace qu'ouvre un Admin ou un Délégué, pour les alertes de départ. La liste reste dans le navigateur ; seules les absences qu'en tire la page partent au site, chiffrées avec la Clé d'alliance (`docs/features/site-comptes-espaces.md`).
- Précisé le 2026-10-25 (ticket 20) : le background charge libsodium pour les Envois. Son WebAssembly demande `'wasm-unsafe-eval'` dans la politique de sécurité des pages de l'extension (`content_security_policy.extension_pages`, `apps/extension/wxt.config.ts`) : la valeur par défaut de chaque navigateur plus ce seul mot-clé (celle de Chrome l'a déjà, pas celle de Firefox en MV3). Ce n'est pas une permission : rien ne change à l'installation. Le même script de l'extension sur optizzz.fr reçoit de la page d'un espace la Clé d'alliance, et tourne aussi sur `/account` pour l'oublier à « Se déconnecter » (`docs/features/site-envois.md`).
- Changer d'algorithme impose une version dans chaque donnée chiffrée, pour relire les anciennes : on la met dès le premier format.
