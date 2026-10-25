# 0005 — Site Optizzz facultatif, données d'alliance chiffrées de bout en bout

**Date** : 2026-10-22 · **Statut** : accepté

## Contexte

Jusqu'ici, rien ne sortait de Fourmizzz par l'extension (`docs/features/partage-alliance.md`, 2026-10-09) : les alliances partageaient leurs états par copier-coller dans Discord. On ajoute un Site Optizzz pour synchroniser convois, floods, chasses et états, et en tirer des statistiques. Celui qui héberge le site joue aussi : un accès à la base de données donnerait l'armée et les niveaux des alliances adverses.

## Décision

- **Facultatif** : sans Compte Optizzz, l'extension marche comme avant et n'envoie rien de la personne. L'Envoi se fait catégorie par catégorie (armée, chasses, convois…), coupé par défaut, choisi par la personne.
- **Lire le site, oui ; s'y identifier, non** (révisé le 2026-10-22) : sans compte, l'extension peut lire sur le site ce qu'il publie pour tous (données des serveurs tirées de l'export public), comme n'importe quel visiteur : ni identifiant, ni compte, ni donnée du joueur dans la requête. Seuls un Compte Optizzz et un Envoi autorisé font partir des données du joueur.
- **Chiffré de bout en bout** : les données d'une alliance sont chiffrées par une Clé d'alliance que seuls ses membres détiennent. Le Site Optizzz stocke et relaie du chiffré ; tout calcul (statistiques, qui doit donner à qui) se fait dans le navigateur, après déchiffrement.
- Restent lisibles par le site : le Serveur, le tag d'alliance, les pseudos et les heures. La composition des alliances est déjà publique dans l'export.
- **Le site déchiffre dans le navigateur.** Le chiffrement protège de qui lit la base de données, pas de qui modifie le code déployé : un site modifié pourrait faire fuiter la Clé d'alliance. Pour que ça laisse une trace publique, le code est public et le site n'est déployé que par GitHub Actions depuis `main`. On l'écrit tel quel dans `PRIVACY.md`.
- **Entrer dans un Espace d'alliance** : un membre crée l'espace et en devient admin ; plusieurs espaces peuvent porter le même tag. On demande à rejoindre, un admin approuve après que son extension a trouvé le pseudo sur la page Membres du jeu, et la clé est chiffrée pour la clé publique du nouveau venu. Jamais de clé dans un lien d'invitation. Le Site Optizzz ne peut vérifier personne : les profils du jeu exigent une session (`docs/research/reglement.md`).
- **Clés personnelles** : chacun a une paire de clés ; la clé privée est chiffrée par une Phrase de chiffrement que le site ne voit pas, et stockée sur le site pour suivre la personne d'appareil en appareil. Le lien magique ne prouve que l'e-mail. Phrase oubliée : nouvelle paire, et un admin réapprouve.
- **Départ d'un membre** : un joueur peut quitter l'alliance un temps et revenir. L'extension d'un Admin ou d'un Délégué qui voit la page Membres l'alerte d'un membre de l'espace absent de l'alliance ; rien n'est retiré tout seul. Exclure coupe l'accès au chiffré et fait générer une nouvelle Clé d'alliance par le client de l'admin, chiffrée pour les membres restants ; les données plus anciennes restent sous l'ancienne clé.
- **Règlement du jeu** (`docs/research/reglement.md`) : un Envoi ne contient que ce que la personne a affiché ou ce qu'une action de sa part a lu ; l'extension ne lit jamais le jeu sur minuterie pour alimenter le site ; le Site Optizzz ne se connecte jamais au jeu, ne garde aucun mot de passe Fourmizzz et ne lit que l'export public.
- **Discord** : l'URL d'un webhook est un secret de l'alliance, chiffrée. Le détail part du client du membre qui agit ; le Site Optizzz ne poste que des rappels sans contenu (« nouveau plan de flood, à voir sur Optizzz »).

## Format chiffré

Ajouté le 2026-10-24 (ticket 15) : la description des octets, sans changer les décisions ci-dessus. Complété le même jour (ticket 15b) : identité Ed25519, Clés d'alliance signées par l'Admin, empreinte, modèle de confiance. Code : `packages/crypto` (`@optizzz/crypto`), libsodium (ADR 0007).

- **Encodage** : chaque clé publique et chaque chiffré voyage en base64url sans remplissage (RFC 4648 §5). Les entiers sont des `u32` gros-boutistes (4 octets).
- **Version de format** : le premier octet de chaque chiffré. Un octet plus grand que ce que le code connaît donne « Cette donnée vient d'une version plus récente d'Optizzz » ; 0 ou un format jamais écrit, « illisible ». Changer d'algorithme ou de disposition ajoute un format ; on garde le code qui lit les anciens.
- **Paire de clés personnelle** : une seule identité par personne, une paire de signature Ed25519 (`crypto_sign_keypair`), d'où l'on tire la paire X25519 des boîtes scellées (`crypto_sign_ed25519_pk_to_curve25519`, `crypto_sign_ed25519_sk_to_curve25519`). Une seule clé publique (32 octets) sur le site, une seule Phrase de chiffrement, et une seule empreinte à comparer ; la clé privée ne quitte jamais le navigateur en clair. Une clé publique qui n'est pas un point valable (petit ordre, hors du sous-groupe) est refusée : « illisible ».
- **Formats en vigueur** : clé privée verrouillée 2, Clé d'alliance scellée 2, donnée d'alliance 1. Les formats 1 de la clé verrouillée et de la Clé d'alliance scellée (ticket 15 : clé privée X25519, boîte sans signature) n'ont jamais été stockés hors des tests : on ne garde pas de code pour les lire. On ne réutilise pas leur numéro pour autant : un numéro désigne une seule disposition, et une boîte format 1 reste reconnaissable pour être refusée comme non signée.

### Clé privée verrouillée par la Phrase de chiffrement (format 2, 97 octets)

| Octets | Contenu                                                              |
| ------ | -------------------------------------------------------------------- |
| 0      | format `2`                                                           |
| 1–4    | `opslimit` d'Argon2id (`u32`)                                        |
| 5–8    | `memlimit` d'Argon2id, en octets (`u32`)                             |
| 9–24   | sel (16 octets aléatoires)                                           |
| 25–48  | nonce (24 octets aléatoires)                                         |
| 49–96  | XChaCha20-Poly1305 de la graine Ed25519 (32 octets) + étiquette (16) |

- On ne verrouille que la graine (`crypto_sign_ed25519_sk_to_seed`) ; à l'ouverture, `crypto_sign_seed_keypair` refait la paire, clé publique comprise. Une clé format 1 donne « illisible » : lue comme une graine, elle donnerait en silence une autre identité.

- Clé de chiffrement : Argon2id v1.3 (`crypto_pwhash`, `ALG_ARGON2ID13`, parallélisme 1), 32 octets, sur la phrase normalisée : Unicode NFC, espaces de début et de fin ôtés, suites d'espaces réduites à une. La casse compte.
- Données associées : les octets 0–24 (format, paramètres, sel) : on ne peut pas les modifier sans faire échouer l'ouverture.
- **Paramètres écrits aujourd'hui** : `opslimit = 3`, `memlimit = 64 Mio` (le second choix de la RFC 9106, avec p = 1). Mesuré dans Node (WebAssembly de libsodium, Mac récent) : environ 0,2 s ; un téléphone milieu de gamme, 3 à 5 fois plus lent, reste autour d'une seconde, une fois par session. 64 Mio tiennent dans la mémoire d'un onglet de téléphone, et coûtent cher à qui teste des phrases en masse sur la base volée. Les paramètres étant écrits dans chaque chiffré, on peut les relever plus tard : les anciennes clés s'ouvrent toujours, et se réécrivent au prochain changement de phrase.
- **Bornes à la lecture** : `1 ≤ opslimit ≤ 10` et `8 Mio ≤ memlimit ≤ 256 Mio`, sinon « illisible » : un chiffré trafiqué ne peut pas figer le navigateur.
- Changer de phrase rouvre la clé privée et la reverrouille (nouveau sel, paramètres du jour) : la paire ne change pas.

### Clé d'alliance scellée et signée pour un membre (format 2, 181 octets)

| Octets | Contenu                                                                                             |
| ------ | --------------------------------------------------------------------------------------------------- |
| 0      | format `2`                                                                                          |
| 1–180  | `crypto_box_seal`, pour la clé X25519 tirée de la clé publique du membre, des 132 octets ci-dessous |

Dans la boîte :

| Octets | Contenu                                               |
| ------ | ----------------------------------------------------- |
| 0–3    | version de la Clé d'alliance (`u32`)                  |
| 4–35   | Clé d'alliance (32 octets)                            |
| 36–67  | clé publique Ed25519 de l'Admin qui a scellé          |
| 68–131 | signature Ed25519 de l'Admin (`crypto_sign_detached`) |

- **Ce que signe l'Admin** : `optizzz alliance key 2` (22 octets ASCII) ‖ longueur de l'identifiant de l'espace (`u32`) ‖ identifiant de l'espace sur le site (UTF-8, non vide) ‖ version (`u32`) ‖ clé publique Ed25519 du destinataire (32 octets) ‖ Clé d'alliance (32 octets). L'espace, la version et le destinataire ne sont pas écrits dans la boîte : celui qui ouvre fournit l'espace qu'il ouvre et sa propre clé publique, et la signature ne se vérifie que s'ils sont ceux que l'Admin a signés. Une signature ne se rejoue donc ni dans un autre espace (le même Compte peut être dans un espace sur S2 et un sur S5), ni pour une autre version (un exclu qui ferait passer l'ancienne pour la nouvelle), ni pour un autre membre (une boîte scellée est anonyme : quiconque a ouvert la sienne peut en resceller le contenu pour un autre). Elle couvre aussi la clé elle-même, qu'on ne peut pas remplacer.
- La signature est dans la boîte, avec la clé secrète qu'elle couvre.
- La Clé d'alliance : 32 octets aléatoires (`crypto_aead_xchacha20poly1305_ietf_keygen`), versionnée à partir de 1 ; chaque changement ajoute la version la plus haute plus un, et garde les anciennes. Le site range aussi la version en clair à côté (une ligne par membre et par version) ; seule celle de la boîte, signée, compte.
- Un membre approuvé reçoit toutes les versions, scellées et signées une à une ; elles peuvent l'être par des Admins différents (la version 3 par celui qui a exclu quelqu'un). Une seule version refusée fait refuser le trousseau entier.
- **À l'ouverture**, dans cet ordre : boîte qui ne s'ouvre pas avec la clé du membre, « pas chiffrée pour votre clé » ; boîte format 1 (sans signature), signature absente, falsifiée ou rejouée : `bad-signature`, « Cette Clé d'alliance ne porte pas de signature valable d'un Admin de cet espace : ne l'utilisez pas, et prévenez un Admin. » ; signature valable d'une clé hors de la liste de confiance : `untrusted-signer`, « … signée par une clé que vous n'avez pas reconnue : comparez son empreinte avec celle de l'Admin avant de l'accepter. ». La signature est vérifiée avant la liste : l'erreur `untrusted-signer` porte la clé qui a vraiment signé, pour que l'interface en montre l'empreinte.

### Empreinte d'une clé publique (empreinte 1)

- BLAKE2b-256 (`crypto_generichash`) de `optizzz fingerprint 1` (21 octets ASCII) ‖ clé publique Ed25519 (32 octets) ; les 16 premiers octets, lus comme un entier gros-boutiste, modulo 10²⁴ ; écrits en 24 chiffres, par groupes de quatre : « 6501 5103 2815 7970 7679 2095 » (clé publique du test 1 de la RFC 8032 §7.1).
- Environ 80 bits : pour fabriquer une clé de même empreinte qu'un Admin, il faut de l'ordre de 2⁷⁹ essais, hors de portée de qui tient le site. Des chiffres plutôt que des mots : ils se lisent de vive voix et se collent sur Discord sans faute d'accent.
- Elle ne doit jamais changer : des joueurs l'auront déjà comparée. Un changement de calcul serait une « empreinte 2 », montrée comme telle.

### Modèle de confiance

- **La menace** : qui peut écrire dans la base (l'hébergeur, quelqu'un qui l'a volée) peut sceller pour un membre une Clé d'alliance qu'il connaît, puisqu'une boîte scellée est anonyme ; le membre chiffrerait ensuite ses Envois avec elle. Avec la signature, le membre refuse toute Clé d'alliance qui n'est pas signée, pour lui, dans cet espace et pour cette version, par une clé de sa **liste de confiance**. Un site dont le code déployé est modifié échappe à ce mécanisme comme au reste (décision « Le site déchiffre dans le navigateur » ci-dessus).
- **Le paquet ne décide pas qui croire** : `openAllianceKey` et `openAllianceKeyring` reçoivent la liste des clés publiques de confiance de l'appelant. Une liste que le site fournirait telle quelle ne protégerait de rien : la confiance vient d'une comparaison d'empreintes hors du site (de vive voix, sur Discord), ou de ce que le membre a déjà vérifié.
- **Décidé le 2026-10-25 (cadrage du ticket 17)** ; parcours et textes dans `docs/features/site-comptes-espaces.md`, « Confiance et parcours » :
  - **Le Code de sécurité d'une paire, obligatoire.** Avant d'approuver, l'Admin et le nouveau venu s'échangent un code tiré de leurs deux clés publiques, par copier-coller sur Discord ; chaque navigateur compare tout seul. Un code par côté (ils se calculent l'un l'autre), pour qu'on ne puisse pas coller le sien. Il ferme les deux portes : la clé de l'Admin substituée au nouveau venu, et la clé du nouveau venu substituée à l'Admin (sans lui, le site recevrait toute l'histoire de l'espace). 24 chiffres comme l'empreinte : un code plus court se laisserait trouver par le site. Le format (« code de paire 1 ») est à décrire ici par le ticket 15c.
  - **La liste de confiance vit sur le site, chiffrée et authentifiée** avec une clé tirée de la clé privée du membre : le site ne peut pas y ajouter sa clé, et elle suit le membre d'un appareil à l'autre. Perdue avec la paire (phrase oubliée), refaite par la réapprobation.
  - **Certificats et révocations.** Un Admin signe un certificat de membre à l'approbation et un certificat d'Admin à la nomination ; retirer ou exclure signe une révocation. On croit les clés vérifiées par un code et celles que certifient, de proche en proche, des Admins crus et non révoqués. Formats à décrire ici par le ticket 15c.
  - **Une clé changée n'est jamais acceptée en silence** : refusée et signalée jusqu'à une recertification après un nouvel échange de code.
  - **Restent ouverts** : la rétention d'une version ou d'une révocation par le site (il faudrait que les Admins signent aussi « la version courante est N »), à trancher au cadrage des Envois (19), avant qu'ils existent ; deux Admins qui changent la clé en même temps produiraient deux versions de même numéro, toutes deux signées, et le paquet ne les départage pas : le site refuse la seconde (une seule version N par espace, ticket 18).

### Donnée d'alliance chiffrée (format 1, 45 octets + texte)

| Octets | Contenu                                                                  |
| ------ | ------------------------------------------------------------------------ |
| 0      | format `1`                                                               |
| 1–4    | version de la Clé d'alliance (`u32`)                                     |
| 5–28   | nonce (24 octets aléatoires)                                             |
| 29–…   | XChaCha20-Poly1305 du texte UTF-8 (du JSON en pratique) + étiquette (16) |

- Données associées : les octets 0–4 : changer le format ou la version fait échouer l'ouverture.
- On chiffre toujours avec la version la plus haute ; on déchiffre avec celle que nomme la donnée. Sans elle : « Il vous manque la version N de la Clé d'alliance ».

## Options écartées

- **Chiffrement au repos avec une clé du site** : protège d'une fuite de sauvegarde, pas de l'hébergeur.
- **Cacher aussi les métadonnées** : coût élevé pour une information déjà publique.

## Conséquences

- Le site ne peut ni trier, ni agréger, ni alerter sur le contenu : tout traitement est côté client.
- Un départ de l'alliance impose de changer la Clé d'alliance ; ce que l'ex-membre a déjà lu reste lu.
- Une Clé d'alliance perdue par tous les membres rend leurs données illisibles, sans recours.
- Le Partage par copier-coller (`docs/features/partage-alliance.md`) reste pour qui n'a pas de compte.
- Nouvelle permission d'hôte : mettre à jour `PRIVACY.md`, `docs/store/fiche.md` et `data_collection_permissions`. Une lecture du site, même sans compte, transmet l'adresse IP du joueur à `optizzz.fr` : `PRIVACY.md` le dit.
