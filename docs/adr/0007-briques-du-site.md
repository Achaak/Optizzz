# 0007 — libsodium, Better Auth et liaison de l'extension par le domaine du site

**Date** : 2026-10-22 · **Statut** : accepté

## Contexte

Le chiffrement de bout en bout (ADR 0005) et la connexion par lien magique demandent des briques qu'on ne remplace pas sans migrer toutes les données ni reconnecter tous les comptes.

## Décision

- **Chiffrement : libsodium** (`libsodium-wrappers-sumo`) : boîtes scellées pour transmettre la Clé d'alliance à la clé publique d'un membre, XChaCha20-Poly1305 pour les données, Argon2id pour dériver une clé de la Phrase de chiffrement. Le chiffrement du navigateur (WebCrypto) n'a pas Argon2. Dans l'extension, libsodium n'est chargé que par le background et les pages de l'extension, jamais par le script léger de toutes les pages.
- **Authentification : Better Auth**, avec son lien magique (l'option de create-t3-app), plutôt qu'Auth.js.
- **Liaison de l'extension** : l'extension a accès à `optizzz.fr` ; un script injecté sur la page « Connecter l'extension » du site lui transmet un jeton. `externally_connectable` est écarté : Firefox le gère mal.

## Conséquences

- Nouvelle permission d'hôte `*://optizzz.fr/*` : `PRIVACY.md`, `docs/store/fiche.md` et `data_collection_permissions` à mettre à jour avant de publier.
- Changer d'algorithme impose une version dans chaque donnée chiffrée, pour relire les anciennes : on la met dès le premier format.
