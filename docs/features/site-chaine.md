# Rôles de la Chaîne sur le site

Décidé lors d'une session de cadrage (`grilling`) le 2026-11-01. Les rôles et la Chaîne de TDC de l'extension : `chaine-tdc.md`. Les Espaces : `site-comptes-espaces.md` ; le précédent suivi ici (un enregistrement chiffré par espace, relevé par l'extension) : `site-discord.md`. Maquette : artboard « C · Espace d'alliance · Chaîne (rôles) » du canevas.

## But

Régler une fois pour toute l'alliance les rôles de la Chaîne de TDC (Grenier, Passeur N, Chasseur, Hors chaîne) sur la page de son Espace, et que l'extension de chaque membre les reprenne dans la Chaîne, la Carte et la colonne « Rôle » de la page Membres, sans copier-coller.

## Décisions

- **Où** : un onglet « Chaîne » de la page de l'espace, après « Floods », visible par tous les membres. Pas « Rôles » : le mot désigne déjà Admin, Délégué et Membre.
- **Qui les change** : les Admins et les Délégués. Les membres les voient en lecture seule. C'est le site qui le fait respecter (comme pour Discord) : tous les membres ont la même Clé d'alliance.
- **Chiffrés** avec la Clé d'alliance (ADR 0005, « Donnée d'alliance chiffrée »), dans un seul enregistrement par espace avec un numéro de révision, comme le webhook Discord et les alertes de départ. Le site ne sait pas qui est grenier, passeur ou chasseur : il apprend seulement que les rôles ont changé, leur taille, et, en clair, qui les a enregistrés et quand (« Enregistrés aujourd'hui 13 h 36 par Noctis »). L'intérieur du chiffré porte l'id de l'espace : un enregistrement recopié dans un autre espace est rejeté.
- **Ce qui se partage** : les rôles et le « TDC à garder » des chasseurs. Avec les mêmes, chacun retrouve le même plan. Les couleurs des rôles sur la Carte restent un réglage personnel.
- **Quels membres** : tous ceux de l'alliance d'après l'export, y compris ceux qui ne sont pas dans l'espace (marqués « hors espace ») : la chaîne passe aussi par eux. Vacances et bannis sont hors chaîne d'office, comme dans l'extension. Rangés par id de joueur, comme dans l'extension.
- **Le site fait foi.** Pour un Joueur dont l'espace a des rôles enregistrés, la Chaîne de l'extension les affiche en lecture seule, avec « Modifier sur optizzz.fr ». Sans compte, sans espace, ou dans un espace sans rôles enregistrés, la Chaîne reste modifiable comme avant. L'extension n'envoie jamais de rôles au site : pas de conflit entre les deux.
- **Les rôles locaux de l'extension** ne sont jamais écrasés : ceux du site sont gardés à part, chiffrés (comme le webhook Discord), et effacés avec la Clé d'alliance (« Se déconnecter »). Quitter l'espace ou délier l'extension fait revenir les rôles locaux.
- **L'extension ne peut pas les ouvrir** (Clé d'alliance absente, version manquante) : la Chaîne montre les rôles locaux, modifiables, avec « Votre alliance règle ses rôles sur optizzz.fr : ouvrez votre espace pour les reprendre ».
- **Délai** : la relève existante (toutes les 5 minutes et à l'ouverture d'une page du jeu ; jamais de lecture du jeu en plus). Une Chaîne, une Carte ou une page Membres ouverte se met à jour sans rechargement.
- **Un seul espace par Joueur** (`space_member` unique par serveur et Joueur) : pas de choix entre deux jeux de rôles.
- **Premier enregistrement** : tant que l'espace n'a pas de rôles, la page montre ceux proposés d'après le TDC de l'export (« TDC de l'export, relu chaque heure » : l'extension, elle, prend le TDC en direct de la page Membres ; ce n'est qu'une proposition). Pour un Admin ou un Délégué dont l'extension liée a des rôles, « Reprendre les rôles de votre extension », par le pont déjà utilisé pour la page Membres. L'import par texte (« Pseudo: Passeur 2 ») reste possible, comme « Copier pour Discord ».
- **Un membre arrivé dans l'alliance** depuis l'enregistrement est hors chaîne, avec l'avertissement qui le nomme, comme dans l'extension.
- **Deux éditeurs en même temps** : un enregistrement refusé parce que la révision a changé relit la nouvelle version, y réapplique vos changements membre par membre (les vôtres l'emportent seulement sur les membres que vous avez touchés), et réaffiche la barre « N rôles modifiés » pour que vous confirmiez.
- **Après une exclusion** (nouvelle version de la Clé d'alliance) : à la première ouverture de la page par un Admin ou un Délégué à jour, l'enregistrement est chiffré de nouveau avec la version la plus haute, comme Discord. Pas d'avertissement : un rôle n'est pas un secret qu'on change.

## Réalisation

- **Le format** (`packages/game/src/site-links/chain-roles.ts`) : `{ v: 1, spaceId, roles: { id: "granary" | "passer:N" | "hunter" | "out" }, keep: { id: cm² } }`, validé avec zod à l'ouverture (rôle inconnu, Passeur 0, TDC à garder négatif, clé qui n'est pas un id de joueur ou autre espace : refusé). Les rôles et leur proposition d'après le TDC sont passés de l'extension à `packages/game/src/tdc-chain/roles.ts`, partagés par le site et l'extension.
- **Le site** : table `accounts.space_chain_roles` (une ligne par espace : chiffré, révision, date et pseudo de qui l'a enregistré ; migration `…_chain_roles`), `saveChainRoles` (Admin ou Délégué à jour, plus haute version de la clé, révision attendue, sinon « rechargez »), les rôles dans la vue de l'espace pour tous les membres, `chainRolesForExtension` et `GET /api/extension/chain-roles` (avec le jeton seul, comme Discord). L'effectif de l'alliance vient de l'export (`spaces.chainRoster`, données publiques, pour les membres de l'espace).
- **La page** (`src/components/spaces/chain-panel.tsx`) : `ChainPanel` lit et enregistre, `ChainEditor` montre et édite (les rôles par échelon, du grenier au hors chaîne, avec la forme du rôle comme sur la Carte ; « modifié », « arrivé depuis », « hors espace », « vacances », « banni »). La logique pure est dans `src/lib/spaces/chain-roles.ts` : `shownRoles` (rôles affichés, arrivés depuis), `changedMembers` (la barre « N membres modifiés »), `rebaseRoles` (Q8). Changer un chasseur en autre chose efface son TDC à garder. « Proposer d'après le TDC » applique la même règle que l'extension, avec sa marge de 1 %. L'adresse `?onglet=chaine` ouvre l'onglet (lien « Modifier sur optizzz.fr » de l'extension).
- **L'extension** : la relève (`envois.ts`) lit `GET /api/extension/chain-roles` seulement si elle tient une Clé d'alliance, et garde la réponse chiffrée (`src/data/chain-roles.ts`, effacée à « Se déconnecter »). Les pages du jeu demandent au fond `chain-roles` : les rôles ouverts, ou `none` (pas d'espace ou pas de rôles), `no-key` (pas ouvrables ici : note). `effectiveChain` (`tdc-chain/site-roles.ts`) choisit les rôles affichés pour la Chaîne, la Carte et la colonne « Rôle » ; ils se mettent à jour quand une relève en apporte de nouveaux (`site-roles-source.ts`, sans React pour le script léger ; `use-site-chain-roles.ts` pour les vues React). Dans la Chaîne, les rôles du site sont en lecture seule (listes et TDC à garder désactivés, « Proposer des rôles » et « Importer » retirés), avec « Modifier sur optizzz.fr ».
- **« Reprendre les rôles de votre extension »** passe par le pont des Espaces (`space-bridge.ts`, `CHAIN_ROLES_REQUEST` / `CHAIN_ROLES_REPLY`) : le fond rend les rôles choisis dans la Chaîne du serveur sous la forme du texte de l'enregistrement de l'espace, que la page lit avec les mêmes contrôles ; rien quand la Chaîne ne fait que proposer.

## Code

| Fichier                                                                      | Rôle                                                           |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `packages/game/src/site-links/chain-roles.ts` (+ test)                       | Format de l'enregistrement chiffré                             |
| `packages/game/src/site-links/space-bridge.ts` (+ test)                      | Demande et réponse « Reprendre les rôles de votre extension »  |
| `apps/web/src/lib/spaces/chain-roles.ts` (+ test)                            | Chiffrement, rôles affichés, changements, reprise d'un conflit |
| `apps/web/src/server/spaces/space-service.ts` (+ tests, mémoire et Postgres) | Enregistrer, montrer, remettre à l'extension                   |
| `apps/web/src/server/spaces/chain-roles-routes.ts` (+ test)                  | `GET /api/extension/chain-roles`                               |
| `apps/web/src/components/spaces/chain-panel.tsx`                             | Onglet « Chaîne »                                              |
| `apps/extension/src/features/optizzz-account/envois.ts` (+ test)             | Relève et ouverture des rôles du site                          |
| `apps/extension/src/data/chain-roles.ts`                                     | Rôles du site gardés chiffrés                                  |
| `apps/extension/src/features/tdc-chain/site-roles.ts` (+ test)               | Quels rôles font foi                                           |

## Vérification

Vérifié en local le 2026-11-01 avec une page de démonstration temporaire (alliance inventée de 13 membres, retirée) : rôles par échelon, changement d'un rôle et barre « 1 membre modifié », enregistrement en conflit repris par-dessus (le Passeur 3 de l'autre éditeur gardé, le mien aussi), « rien d'enregistré » et rôles proposés, « Reprendre les rôles de votre extension », TDC à garder d'un chasseur, lecture seule d'un membre ; en clair, sombre et à 375 px. La vraie page d'un espace se compile sans erreur. Pas essayé dans le navigateur : un vrai Espace avec la Clé d'alliance ouverte, ni l'extension dans le jeu (Chaîne en lecture seule, Carte, colonne « Rôle ») : couverts par les tests.
