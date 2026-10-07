# Optizzz

Extension navigateur (Chrome + Firefox, MV3) d'aide au jeu [Fourmizzz.fr](http://www.fourmizzz.fr). Inspirée de [Toolzzz](https://github.com/GuiEpi/toolzzz) (GPL-3.0) : on s'en inspire pour les idées, on ne copie pas son code sans régler la question de licence d'abord.

- **Code en anglais** : identifiants, commentaires, noms de fichiers, noms de tests, classes CSS.
- **Textes visibles par le joueur en français** (vocabulaire du jeu : ponte, chasse, convoi, alliance…). La doc (`docs/`) est en français.

## Commandes

```bash
pnpm dev            # dev Chrome (recharge à chaud)
pnpm dev:firefox    # dev Firefox
pnpm build          # → .output/chrome-mv3/
pnpm build:firefox  # → .output/firefox-mv3/
pnpm zip / zip:firefox
pnpm typecheck
pnpm test           # vitest (happy-dom)
pnpm lint           # ESLint (typescript-eslint strict + type-checked, react-hooks)
pnpm format         # Prettier (format:check en lecture seule)
```

## Architecture

- Stack : [WXT](https://wxt.dev) + TypeScript strict, `srcDir: "src"`. Doc WXT pour LLM : https://wxt.dev/llms-full.txt
- `src/entrypoints/fourmizzz.content.ts` : content script léger chargé sur toutes les pages ; il parcourt le registre `src/features/index.ts` et lance les features dont `matches(url)` est vrai. Une feature qui plante est loguée sans casser les autres.
- Toute feature visible s'inscrit dans `src/features/catalog.ts` pour pouvoir être coupée depuis « Fonctionnalités » (`docs/features/feature-toggles.md`) : `toggle` dans `Feature` pour une feature légère, `isFeatureEnabled` en tête de `main` pour un content script lourd.
- Une feature lourde (React, ECharts…) a son propre content script dans `src/entrypoints/<feature>.content/`, limité par `matches` aux pages concernées (voir `docs/adr/0001-stack-ui-carte.md`). Les UI sont montées dans un Shadow DOM (`createShadowRootUi`).
- Stack UI : React 19, Apache ECharts (import modulaire `echarts/core`), zod pour valider les données externes, `wxt/utils/storage` pour mémoriser (clés préfixées par le host du serveur). Préférer une brique éprouvée à du code écrit à la main.
- La logique pure (parsing de pages, calculs) se sépare du DOM pour être testée avec vitest. Les règles du jeu partagées par plusieurs features vivent dans `src/game/` (`army/` : unités, proies, combat).
- Seul hôte autorisé : `*://*.fourmizzz.fr/*`. Aucune donnée n'est envoyée ailleurs (`data_collection_permissions: none` côté Firefox) ; si ça change, mettre à jour le manifest.

## Documentation

- `docs/research/` : ce qu'on sait du jeu (API des exports, sélecteurs des pages, formule du temps de trajet). À mettre à jour à chaque découverte.
- `docs/features/` : une page par feature (décisions de cadrage, fichiers).
- `docs/adr/` : décisions d'architecture.
- `docs/publication.md` : publier une version (tag `vX.Y.Z` → workflow `release.yml`) et la première soumission manuelle ; `docs/store/fiche.md` : textes des fiches Chrome Web Store / AMO.
- Notes plus larges sur le jeu : `/Users/achak/Development/bot-fourmizzz/research/`.

## Workflow

On avance feature par feature. Les skills de Matt Pocock sont dans `.claude/skills/` (voir `SOURCE.md`) : `/grill-me` pour cadrer une feature, `tdd` pour l'implémenter.

Commits : Conventional Commits (`feat:`, `fix:`, `chore:`…). Le hook Husky `pre-commit` lance lint-staged (ESLint + Prettier sur les fichiers modifiés), `typecheck` et les tests : ne pas le contourner avec `--no-verify`.

Publication : la version vient uniquement de `package.json`. L'identifiant Firefox `optizzz@achaak.github.io` (`wxt.config.ts`) ne doit jamais changer. Une nouvelle permission ou une donnée envoyée ailleurs que vers Fourmizzz impose de mettre à jour `PRIVACY.md`, `docs/store/fiche.md` et `data_collection_permissions`.

TypeScript reste en 6.0 : TypeScript 7 (portage Go) n'a plus d'API JavaScript et casse typescript-eslint.
