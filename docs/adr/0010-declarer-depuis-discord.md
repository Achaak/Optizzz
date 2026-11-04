# 0010 — Déclarer floods, convois et chasses depuis Discord

**Date** : 2026-11-04 · **Statut** : accepté le 2026-11-04, option B (chantier 33, `plans/lot-2026-11/33-declarer-depuis-discord.md`)

## Contexte

Des membres veulent déclarer un flood, un convoi ou une chasse sans passer par l'extension : depuis leur téléphone, là où ils sont déjà, c'est-à-dire sur le Discord de l'alliance. La déclaration doit arriver dans l'Espace d'alliance, comme un Envoi.

Ce qui existe le 2026-11-04 :

- **Les Envois sont chiffrés de bout en bout** avec la Clé d'alliance (ADR 0005, `docs/features/site-envois.md`) : le site ne voit en clair que le Serveur, le tag, les pseudos et les heures qui servent à effacer. Toutes les catégories en dépendent : `production` (avec le stock depuis le chantier 21), `convoys`, `floods`, `hunts` et son journal `hunts-log` (chantier 20), `army`, `levels`, `demande-convoys`, `declared-convoys`.
- **Une déclaration à la main existe déjà, dans le navigateur** : « Déclarer un convoi » (`docs/features/site-demandes.md`) écrit un Envoi `declared-convoys` du Joueur, scellé par la page de l'espace avec la Clé d'alliance. Il ne vaut que pour une Demande validée.
- **Discord** (`docs/features/site-discord.md`) : les annonces en clair (« Messor a envoyé un convoi à Lasius… ») partent de l'extension du membre qui agit, sur un webhook chiffré que le site ne lit pas. Le site ne poste que des rappels sans contenu, sur un second webhook que l'Admin lui donne à part. Il n'y a pas de bot : l'ADR 0005 l'a écarté pour les rappels (jeton, invitation, vérification).
- **Discord voit déjà le contenu des annonces.** La promesse ne porte pas sur Discord, que l'alliance choisit, mais sur **le site et son hébergeur**, qui joue aussi (ADR 0005, « Contexte »).
- **Un Joueur ne se rattache que par l'extension** (`docs/features/site-comptes-espaces.md`) : entrer dans un espace demande d'avoir lié l'extension une fois. Un membre qui n'a jamais eu l'extension n'est donc dans aucun espace aujourd'hui ; le membre visé est celui qui n'a pas l'extension **sous la main** (téléphone, autre ordinateur).

## Options

### A. Ne pas le faire

Le membre déclare en rentrant sur son ordinateur, ou l'extension voit le convoi ou le flood à la prochaine page du jeu. Rien ne change. Mais un flood lancé depuis le téléphone n'apparaît dans l'Espace qu'à la prochaine page ouverte avec l'extension, parfois après l'arrivée : la coordination, qui est le but de l'Espace, en pâtit.

### B. Un lien Discord vers un formulaire de l'Espace, chiffré dans le navigateur

Une page de l'Espace, « Déclarer », pensée pour le téléphone (375 px), avec trois sortes : flood, convoi, chasse. La page scelle la déclaration avec la Clé d'alliance, comme « Déclarer un convoi » aujourd'hui ; le site garde du chiffré. Le lien vers cette page arrive sur Discord, sans aucun contenu.

- **Rien ne change à la promesse** : ni `PRIVACY.md` sur le fond (une phrase pour la page), ni la fiche des stores, ni `data_collection_permissions` : l'extension n'est pas touchée.
- **Prix** : le membre doit avoir une session optizzz.fr sur son téléphone et y ouvrir la Clé d'alliance (sa Phrase de chiffrement, ou « Se souvenir sur cet appareil »). Une étape de plus qu'une commande Discord, une fois par appareil.
- Les annonces Discord de ces déclarations ne peuvent partir que du navigateur du membre (il tient la Clé d'alliance, donc peut ouvrir le webhook chiffré), comme celles de l'extension.

### C. Un bot Discord qui voit le contenu

Une commande `/flood cible:Lasius arrivée:18h12` (ou une fenêtre Discord) : Discord envoie l'interaction **en clair** au serveur du site, qui l'écrit dans l'Espace.

- **Le site voit le contenu.** Pour l'écrire dans l'Espace, il devrait soit tenir la Clé d'alliance (fin du chiffrement de bout en bout pour tout l'espace), soit garder la déclaration chiffrée avec sa propre clé ou en clair, le temps qu'un navigateur de membre la rescelle (le site l'a vue quand même). Dans les deux cas, l'hébergeur, qui joue, lit les floods d'une alliance adverse.
- **Ce que ça changerait** : la promesse de l'ADR 0005 (« le site stocke et relaie du chiffré ») et la page d'accueil du site deviennent fausses pour ces données ; `PRIVACY.md` et la page Confidentialité doivent dire que les déclarations Discord passent en clair par optizzz.fr et par Discord ; la fiche des stores (`docs/store/fiche.md`) et la page « Comptes et Espaces » ne peuvent plus dire « chiffré de bout en bout » sans réserve. Il faut aussi relier un compte Discord à un Compte Optizzz (OAuth Discord : une donnée de plus, l'identifiant Discord), un jeton de bot à garder sur le VPS, une invitation du bot par l'Admin et la vérification des interactions (clé publique Ed25519 de l'application).
- Un bot qui ne ferait que poster des liens (sans lire de contenu) n'apporte rien de plus que B : les rappels du site le font déjà par webhook.

## Recommandation

**B.** C'est la seule option qui sert le membre au téléphone sans toucher à la promesse : la déclaration est scellée là où est la Clé d'alliance, et ni Discord ni le site n'ont rien à lire. C abandonnerait, pour une commande plus rapide, la garantie qui fonde l'Espace ; A laisse le besoin sans réponse.

## Décision

Relue et décidée par le joueur le 2026-11-04.

- **Option B.** Une page « Déclarer » de l'Espace d'alliance, pensée pour le téléphone, scelle la déclaration avec la Clé d'alliance dans le navigateur. Le site ne garde que du chiffré ; rien en clair ne passe par Discord ni par le site. A et C sont écartées pour les raisons ci-dessus.
- **Trois sortes, qui comptent comme les données de l'extension**, marquées « déclaré » partout où elles s'affichent :
  - **flood** (cible, nombre d'attaques, arrivée) : dans « Floods en route » ;
  - **convoi** (destinataire, quantités, arrivée) : dans le Solde, et pour une Demande si le membre la choisit (ce qui reprend « Déclarer un convoi ») ;
  - **chasse** (cm², retour) : dans Mouvements.
- **Le lien est fixe** : le panneau « Discord » de l'espace donne « Copier le lien de déclaration », que l'Admin épingle dans le salon (et que chacun peut mettre en favori). Rien de nouveau ne part du site vers Discord ; les rappels ne changent pas.
- **Précisé au codage (2026-11-04, avec le joueur)** : le même panneau donne aussi « Poster sur Discord », qui poste le lien sur le **webhook des annonces depuis le navigateur de l'Admin** (il l'ouvre avec la Clé d'alliance, comme l'extension) ; le site ne poste toujours rien. Les déclarations ne s'affichent que sur le site ; un convoi déclaré pour une Demande compte aussi dans le Solde. Détail : `docs/features/site-declarer.md`.
- **L'extension l'emporte** : chaque lecteur, après déchiffrement, cache une déclaration qu'un Envoi du même membre recouvre (même cible ou destinataire, mêmes quantités, arrivée ou retour à 2 minutes près). Le site n'en sait rien.
- **Pas d'annonce Discord** pour une déclaration : le membre est déjà sur Discord. À revoir après usage.
- **Rien ne change** à l'extension, à ses permissions, à `data_collection_permissions` ni à la fiche des stores. `PRIVACY.md` et la page Confidentialité ajoutent une phrase sur la page « Déclarer » (ce qui est saisi est chiffré dans le navigateur, comme « Déclarer un convoi »).
- **Limite connue** : il faut un Compte Optizzz, un Joueur rattaché (donc l'extension une fois, `site-comptes-espaces.md`) et la Clé d'alliance ouverte sur l'appareil. Un joueur qui n'a jamais eu l'extension ne peut pas déclarer ; on ne le change pas ici.
