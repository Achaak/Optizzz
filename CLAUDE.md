# Optizzz

Extension navigateur (Chrome + Firefox, MV3) d'aide au jeu [Fourmizzz.fr](http://www.fourmizzz.fr). Inspirée de [Toolzzz](https://github.com/GuiEpi/toolzzz) (GPL-3.0) : on s'en inspire pour les idées, on ne copie pas son code sans régler la question de licence d'abord.

Textes visibles par le joueur en français (vocabulaire du jeu : ponte, chasse, convoi, alliance…).

## Commandes

```bash
pnpm dev            # dev Chrome (recharge à chaud)
pnpm dev:firefox    # dev Firefox
pnpm build          # → .output/chrome-mv3/
pnpm build:firefox  # → .output/firefox-mv3/
pnpm zip / zip:firefox
pnpm typecheck
pnpm test           # vitest (happy-dom)
```

## Architecture

- Stack : [WXT](https://wxt.dev) + TypeScript strict, `srcDir: "src"`. Doc WXT pour LLM : https://wxt.dev/llms-full.txt
- `src/entrypoints/fourmizzz.content.ts` : unique content script, il parcourt le registre des features et lance celles dont `matches(url)` est vrai.
- `src/features/` : une feature = un dossier qui exporte un `Feature` (voir `feature.ts`), enregistré dans `features/index.ts`. Une feature qui plante est loguée sans casser les autres.
- La logique pure (parsing de pages, calculs) se sépare du DOM pour être testée avec vitest.
- Seul hôte autorisé : `*://*.fourmizzz.fr/*`. Aucune donnée n'est envoyée ailleurs (`data_collection_permissions: none` côté Firefox) ; si ça change, mettre à jour le manifest.

## Workflow

On avance feature par feature. Les skills de Matt Pocock sont dans `.claude/skills/` (voir `SOURCE.md`) : `/grill-me` pour cadrer une feature, `tdd` pour l'implémenter.

Commits : Conventional Commits (`feat:`, `fix:`, `chore:`…).
