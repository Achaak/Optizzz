# Optizzz

Extension navigateur (Chrome + Firefox, MV3) d'aide au jeu [Fourmizzz.fr](http://www.fourmizzz.fr). Inspirée de [Toolzzz](https://github.com/GuiEpi/toolzzz) (GPL-3.0) : on s'en inspire pour les idées, on ne copie pas son code sans régler la question de licence d'abord.

- **Code en anglais** : identifiants, commentaires, noms de fichiers, noms de tests, classes CSS.
- **Textes visibles par le joueur en français** (vocabulaire du jeu : ponte, chasse, convoi, alliance…), en **vouvoyant** le joueur. Heures à l'heure de Paris, au format d'Optizzz (`packages/game/src/format/time-format.ts` : « aujourd'hui 13 h 36 », « 2 h 55 ») ; nombres comme le jeu (`formatNumber`, `formatDecimal` : « 12 348 », « 18,4 ») ; abréviations d'unités comme le jeu (`unitLabel`). La doc (`docs/`) est en français.

## Commandes

Monorepo pnpm + Turborepo (ADR 0006) : `apps/extension` (l'extension WXT), `apps/web` (le Site Optizzz, `docs/features/site-public.md`), `packages/game` (règles du jeu, lecteurs de pages, formats, Changements : partagés par les deux). Tout se lance à la racine ; `pnpm --filter <paquet> <script>` pour un script d'un seul paquet.

```bash
pnpm dev            # dev Chrome (recharge à chaud)
pnpm dev:firefox    # dev Firefox
pnpm build          # → apps/extension/.output/chrome-mv3/
pnpm build:firefox  # → apps/extension/.output/firefox-mv3/
pnpm zip / zip:firefox
pnpm typecheck      # turbo, chaque paquet
pnpm test           # vitest, tous les paquets (happy-dom) ; test:coverage → coverage/index.html
pnpm lint           # ESLint (typescript-eslint strict + type-checked, react-hooks)
pnpm format         # Prettier (format:check en lecture seule)
pnpm knip           # fichiers et dépendances morts (exports inutilisés : simple avertissement)
pnpm lint:firefox   # web-ext lint sur apps/extension/.output/firefox-mv3 (après build:firefox) : ce qu'AMO refuserait
pnpm analyze        # build Chrome + stats.html : ce que pèse chaque content script
pnpm dev:web        # le site sur http://localhost:3000 (après la base locale ci-dessous)
```

Site, base locale (Postgres dans Docker, port 5433) :

```bash
cd apps/web && cp .env.example .env && docker compose up -d
pnpm --filter @optizzz/web db:migrate          # applique les migrations (et en crée une après un changement du schéma)
pnpm --filter @optizzz/web ingest -- --server s5  # le cron, sur un serveur : relit l'export public
bash scripts/setup-site.sh                     # mise en ligne : Neon, secrets GitHub, Vercel, domaine
```

## Architecture

- Stack de l'extension : [WXT](https://wxt.dev) + TypeScript strict, `srcDir: "src"` dans `apps/extension`. Les chemins `src/…` ci-dessous sont ceux de `apps/extension`, sauf `packages/…`. WXT importe tout seul les exports de `src/utils/` ; ce qui vient d'un paquet s'importe explicitement (`@optizzz/game/…`). Doc WXT pour LLM : https://wxt.dev/llms-full.txt
- `src/entrypoints/fourmizzz.content.ts` : content script léger chargé sur toutes les pages ; il parcourt le registre `src/features/index.ts` et lance les features dont `matches(url)` est vrai. Une feature qui plante est loguée sans casser les autres.
- Toute feature visible s'inscrit dans `src/features/catalog.ts` pour pouvoir être coupée depuis « Fonctionnalités » (`docs/features/feature-toggles.md`) : `toggle` dans `Feature` pour une feature légère, `isFeatureEnabled` en tête de `main` pour un content script lourd.
- Une feature lourde (React, ECharts…) a son propre content script dans `src/entrypoints/<feature>.content/`, limité par `matches` aux pages concernées (voir `docs/adr/0001-stack-ui-carte.md`). Les UI sont montées dans un Shadow DOM (`createShadowRootUi`).
- Stack UI : React 19, Apache ECharts (import modulaire `echarts/core`), zod pour valider les données externes, `wxt/utils/storage` pour mémoriser (clés préfixées par le host du serveur). Préférer une brique éprouvée à du code écrit à la main.
- La logique pure (parsing de pages, calculs) se sépare du DOM pour être testée avec vitest. Ce que plusieurs features partagent ne vit pas dans l'une d'elles :
  - `packages/game/src/` (`@optizzz/game/…`) : règles du jeu (`army/` : unités, proies, combat ; `attack.ts` : prise, portée, créneaux ; `flood.ts`, `travel.ts`, `forecast.ts` : récoltes, famine, entrepôts ; `diplomacy.ts` : pactes et guerres ; `exports.ts` : schémas de l'export public) et `format/` (nombres et heures comme le jeu). Ce paquet ne dépend jamais de l'extension (ni `wxt`, ni stockage) ;
  - `packages/game/src/pages/` : lecteurs purs des pages du jeu (en-tête et Ressources, Reine, chantiers, profils et Membres), avec les pages du jeu gardées en `__fixtures__/` ; les listes de fins, qui assemblent des lecteurs des features, sont dans `src/features/end-times/end-pages.ts` ;
  - `src/data/` : données mémorisées par serveur et relues en arrière-plan (export public, revenus, niveaux, armée, vitesse de ponte, fins, attaques en route) ;
  - `src/theme/` : design système (`theme.css` : jetons et composants `optizzz-panel`, `optizzz-note`, `optizzz-table`… ; `docs/design-system.md`) et palette des graphiques. Une vue se construit avec ces composants ; sa feuille ne garde que ce qui lui est propre, sans couleur, taille ni marge en dur.
- **Daltoniens** (`docs/adr/0003-daltonisme.md`) : une information ne tient jamais à la seule couleur (aussi un texte, une forme ou une légende) ; jamais rouge contre vert pour opposer deux choses ; toute nouvelle couleur vue avec d'autres se vérifie en simulant protanopie et deutéranopie, pas à l'œil.
- L'habillage du jeu (`src/features/game-look/`, `docs/features/game-look.md`) est toujours actif, hors catalogue : une feuille sous `html.optizzz-game-look`, posée à `document_start`. Les outils suivent par les variables de `src/theme/theme.css`.
- La feature `collect` (toujours active, hors catalogue) mémorise ce que montre la page courante, sans requête, pour toutes les features allumées qui en ont besoin : couper une feature n'ôte que son affichage et ses relectures.
- Site (`apps/web`, ADR 0006) : Next.js (App Router), tRPC, Prisma 7 (adaptateur `pg`) sur PostgreSQL, shadcn/ui (`src/components/ui/` : écrits par le CLI shadcn, ni lintés ni retouchés à la main), courbes Recharts. Pages en composants serveur qui lisent `src/server/queries.ts`, reconstruites par le cron (`api/revalidate`). Seul le cron (`scripts/ingest.ts`, `.github/workflows/ingest.yml`) écrit en base ; le site lit avec un rôle en lecture seule.
- Briques partagées à réutiliser plutôt que recopier : dans `@optizzz/game/format/`, `formatNumber` / `formatDecimal` (nombres comme le jeu), `parseGameInteger`, `time-format` ; dans `src/utils/`, `NumberField` (champ numérique React qui garde la saisie), `useStoredSettings` (réglages d'une vue React), `fetchGamePage` (relire une page du jeu en arrière-plan, partagé entre features), `alliance-menu` / `alliance-views`, `map-chart/` (carte x/y à axes de même échelle et son zoom), `page-dialog` (page de l'extension dans une fenêtre par-dessus le jeu).
- Extension : seul hôte autorisé `*://*.fourmizzz.fr/*`. Aucune donnée n'est envoyée ailleurs (`data_collection_permissions: none` côté Firefox) ; si ça change, mettre à jour le manifest.

## Documentation

- `docs/research/` : ce qu'on sait du jeu (API des exports, sélecteurs des pages, formule du temps de trajet). À mettre à jour à chaque découverte.
- `docs/features/` : une page par feature (décisions de cadrage, fichiers).
- `docs/adr/` : décisions d'architecture.
- `docs/publication.md` : publier une version (nouvelle version de `apps/extension/package.json` poussée sur `main` → workflow `release.yml`, qui pose le tag `vX.Y.Z`) et la première soumission manuelle ; `docs/store/fiche.md` : textes des fiches Chrome Web Store / AMO.

## Workflow

On avance feature par feature. Les skills de Matt Pocock sont dans `.claude/skills/` (voir `SOURCE.md`) : `/grill-me` pour cadrer une feature, `tdd` pour l'implémenter. Pour l'interface : `impeccable` (critique, audit, polish) et `web-design-guidelines`, en suivant `docs/design-system.md`. Pour la stack : `wxt-browser-extensions` et `chrome-extensions` (MV3, publication), `echarts` pour les graphiques ; `improve` pour un audit qui écrit des plans dans `plans/` sans toucher au code. Ces skills sont génériques : en cas de désaccord, les ADR et ce fichier priment.

Commits : Conventional Commits (`feat:`, `fix:`, `chore:`…). Le hook Husky `pre-commit` lance lint-staged (ESLint + Prettier sur les fichiers modifiés), `typecheck` et les tests : ne pas le contourner avec `--no-verify`.

Publication : la version vient uniquement de `apps/extension/package.json`. L'identifiant Firefox `optizzz@achaak.github.io` (`apps/extension/wxt.config.ts`) ne doit jamais changer. L'archive des sources pour AMO part de la racine du monorepo (`zip.sourcesRoot`) : un nouveau dossier qui ne sert pas à l'extension s'ajoute à `excludeSources`. Une nouvelle permission ou une donnée envoyée ailleurs que vers Fourmizzz impose de mettre à jour `PRIVACY.md`, `docs/store/fiche.md` et `data_collection_permissions`.

TypeScript reste en 6.0 : TypeScript 7 (portage Go) n'a plus d'API JavaScript et casse typescript-eslint.
