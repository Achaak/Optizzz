# Prompt de l'orchestrateur

À coller dans une nouvelle session Claude Code ouverte sur le dépôt Optizzz. L'orchestrateur ne code pas : il lance une session par chantier, les suit et tient `plans/lot-2026-11/README.md` à jour.

---

Tu orchestres le lot de chantiers décrit dans `plans/lot-2026-11/README.md` (fiches `plans/lot-2026-11/*.md`). Tu ne codes pas toi-même.

1. **Préparer**
   - Lis `CLAUDE.md`, `plans/lot-2026-11/README.md` et toutes les fiches.
   - Vérifie la base : `feat/demandes-chaine-rapports` si elle n'est pas encore fusionnée dans `main`, sinon `main`. Demande-moi laquelle prendre si c'est ambigu.
   - Vérifie avec `git status` que le dossier principal n'a pas de travail en cours d'une autre session ; s'il y en a, ne le touche pas et dis-le moi.
   - Montre-moi le plan des vagues (A, puis B, puis C) et attends mon accord avant de lancer quoi que ce soit.

2. **Lancer une vague**
   - Pour chaque chantier de la vague, démarre une session à part (`start_session`, `initiation` « user_asked », `context` « fresh », **`use_worktree` true**, branche `feat/lot-<numéro>-<nom-court>` partie de la base).
   - Utilise le brief type ci-dessous, avec le numéro et le fichier de la fiche.
   - Ne lance jamais deux sessions qui modifient les mêmes fichiers en même temps (section « Vagues et conflits » du README) : en cas de doute, mets-les l'une après l'autre.
   - Lance au plus 4 sessions à la fois.

3. **Suivre**
   - Chaque session commence par me cadrer sa feature : laisse-moi répondre dans sa propre session.
   - Quand une session finit un tour, lis son rapport, vérifie sa branche (commits, `git diff --stat` contre la base, tests verts d'après son rapport) avant de me dire qu'elle a fini.
   - Mets à jour la colonne « État » du README dans une branche `chore/lot-2026-11-suivi`. Commite ce fichier seul, depuis un worktree à toi.
   - Ne fusionne rien, ne pousse rien, n'ouvre pas de PR sans mon accord explicite.
   - Quand des branches doivent être réunies (vague B après 11), demande-moi d'abord.

4. **Vague suivante**
   - Quand la vague est finie (ou bloquée), fais-moi un point : ce qui est fait, ce qui attend une décision, les branches et PR, puis propose la vague suivante.

5. **Règles**
   - Jamais de commit avec `--no-verify`, jamais d'action dans le jeu.
   - Ne cite jamais d'autre site d'alliance ou outil tiers comme source.
   - En cas de conflit entre une fiche et `CLAUDE.md` ou une ADR, ce sont `CLAUDE.md` et l'ADR qui comptent ; signale l'écart.

**Brief type d'une session de chantier** (remplacer `<NN>` et `<fiche>`) :

> Chantier <NN> du lot `plans/lot-2026-11/`. Lis `CLAUDE.md`, `plans/lot-2026-11/README.md` (section « Règles communes ») et `plans/lot-2026-11/<fiche>`, puis les docs qu'elle cite.
>
> Déroulé :
>
> 1. Vérifie ce qui existe déjà dans le code (la fiche peut être en retard).
> 2. Cadre la feature avec moi (skill `grilling`, une question à la fois, avec ta recommandation) en partant des questions « À cadrer » ; écris les décisions dans la doc de la feature.
> 3. Pour une vue du site, ajoute ou modifie la maquette nommée dans la fiche sur le canevas https://claude.ai/artifact/TS5FMhGu5EJ3bPs9yJM5se et attends mon accord.
> 4. Code en TDD (skill `tdd`), vérifie dans le navigateur (page de démonstration temporaire, retirée), fais passer `pnpm lint`, `pnpm typecheck` et `pnpm test`.
> 5. Commite en Conventional Commits sur ta branche (jamais `--no-verify`), mets à jour la doc et, si une donnée nouvelle part, `PRIVACY.md`, la page Confidentialité et `docs/store/fiche.md`.
> 6. Termine par un rapport court : décisions prises, ce qui est fait, ce qui n'est pas vérifié, la branche.
>
> Si la fiche dit « recherche » ou « ADR d'abord », ne code pas : écris le document demandé et arrête-toi là.
