# Lot de novembre 2026 : Espace d'alliance, outils et extension

Douze chantiers, rangés par priorité (2 à 4), à lancer chacun dans sa propre session, coordonnées par un orchestrateur (`orchestrateur.md`). Chaque fiche dit le but, ce qui existe déjà, les questions à cadrer avec le joueur, une proposition par défaut, la maquette à faire et quand c'est fini.

Base : `main` (la branche `feat/demandes-chaine-rapports` y est fusionnée).

## Chantiers et état

| Fiche                                  | Chantier                                         | Priorité | Effort    | Dépend de | Vague | État                                                                                                                             |
| -------------------------------------- | ------------------------------------------------ | -------- | --------- | --------- | ----- | -------------------------------------------------------------------------------------------------------------------------------- |
| [10](10-frise-mouvements.md)           | Frise des mouvements du jour                     | 2        | M         | —         | A     | FAIT (fusionné dans `main` le 2026-11-04)                                                                                        |
| [11](11-equilibre-ressources.md)       | Équilibre des ressources, entrepôt estimé        | 2        | M-L       | —         | A     | FAIT (fusionné dans `main` le 2026-11-04 ; stock envoyé : sortir avec une version de l'extension)                                |
| [12](12-etat-chefs.md)                 | Tableau des membres pour les chefs               | 2        | M         | —         | A     | FAIT (fusionné dans `main` le 2026-11-04)                                                                                        |
| [13](13-trajets-alliances.md)          | Trajets vers des alliances entières              | 2        | S-M       | —         | A     | FAIT (fusionné dans `main` le 2026-11-04)                                                                                        |
| [20](20-chasses-par-membre.md)         | Chasses par membre (nouvelle catégorie d'Envoi)  | 3        | M         | —         | B     | FAIT (`claude/lot-20-chasses-membres-4e23ef`, à fusionner ; journal des chasses envoyé : sortir avec une version de l'extension) |
| [21](21-tableau-7-jours-et-periode.md) | Tableau jour par jour, période au choix          | 3        | S-M       | 11        | B     | EN COURS (part de la branche de 23)                                                                                              |
| [22](22-recap-demandes.md)             | Récapitulatif et historiques des Demandes        | 3        | S         | —         | A     | FAIT (fusionné dans `main` le 2026-11-04)                                                                                        |
| [23](23-entrees-sorties.md)            | Graphique « ce qui entre / ce qui sort »         | 3        | S-M       | 11        | B     | FAIT (`claude/lot-23-entrees-sorties-47cfc7`, à fusionner)                                                                       |
| [30](30-timing-59e-seconde.md)         | Timing d'une attaque à la seconde (recherche)    | 4        | à estimer | —         | A     | FAIT pour la recherche (fusionnée dans `main`, `docs/research/timing-attaques.md`) ; feature cadrée, code à lancer               |
| [31](31-guides-publics.md)             | Guides publics                                   | 4        | M         | (30)      | C     | À FAIRE                                                                                                                          |
| [32](32-carte-alliance.md)             | Carte de l'alliance : taille, étiquettes, mesure | 4        | S         | —         | A     | FAIT (fusionné dans `main` le 2026-11-04 ; pas encore essayé dans le jeu)                                                        |
| [33](33-declarer-depuis-discord.md)    | Déclarer depuis Discord (ADR d'abord)            | 4        | L         | —         | C     | À FAIRE                                                                                                                          |

États : À FAIRE · CADRAGE · EN COURS · PR OUVERTE · FAIT · BLOQUÉ (raison en une ligne) · ÉCARTÉ (raison en une ligne).

## Vagues et conflits

- **Vague A** (en parallèle, une session chacune) : 10, 11, 12, 13, 22, 30 (recherche seule), 32. Tous ajoutent ou changent une vue de l'Espace sauf 13, 30 et 32. Fichier commun : `apps/web/src/components/spaces/member-space.tsx` (liste des onglets) : seul 10 y ajoute un onglet ; les autres ajoutent une vue dans un onglet existant. Si un autre chantier en a besoin, il passe après 10.
- **Vague B**, après la fusion de 11 : 21 et 23 (mêmes calculs, `lib/envois/convoy-stats.ts` et la vue de 11 : l'un après l'autre, 23 d'abord), 20 (nouvelle catégorie d'Envoi : touche l'extension et le site, à sortir avec une version de l'extension).
- **Vague C** : 31 (après 30 pour le guide du timing), 33 (ADR seulement).
- Deux sessions ne modifient jamais les mêmes fichiers en même temps. Chacune a **son propre worktree** : le 2026-11-02, deux sessions dans le même dossier ont mélangé leurs commits.

## Règles communes à chaque session

- Lire `CLAUDE.md`, la fiche, puis les docs qu'elle cite. Les ADR et `CLAUDE.md` priment.
- **Cadrer d'abord** avec le joueur (skill `grilling`, une question à la fois, une recommandation à chaque fois), noter les décisions dans la doc de la feature.
- **Maquette** sur le canevas « Optizzz — maquettes du site » (https://claude.ai/artifact/TS5FMhGu5EJ3bPs9yJM5se) avant de coder une vue du site : ajouter ou modifier l'artboard nommé dans la fiche, dans le style C (« Campagne »).
- **Coder en TDD** (skill `tdd`), logique pure séparée de la vue, briques partagées réutilisées (`CLAUDE.md`, « Briques partagées »).
- Textes en français, vouvoiement, nombres et heures comme le jeu ; jamais une information portée par la seule couleur (ADR 0003).
- Ne jamais citer d'autre site d'alliance ou outil tiers comme source d'une idée, ni dans le code, ni dans la doc, ni dans les commits.
- Une donnée nouvelle qui part de l'extension ou du navigateur : mettre à jour `PRIVACY.md`, la page Confidentialité du site, `docs/store/fiche.md` et `data_collection_permissions` si besoin.
- Vérifier dans le navigateur (page de démonstration temporaire, retirée ensuite) : clair, sombre, 375 px.
- `pnpm lint`, `pnpm typecheck`, `pnpm test` verts ; commits Conventional Commits sur la branche du chantier, jamais `--no-verify` ; PR vers la base quand le joueur le demande.
- Mettre à jour la ligne de son chantier dans ce README à la fin (ou laisser l'orchestrateur le faire).
