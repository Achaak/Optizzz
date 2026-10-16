Skills `engineering/` et `productivity/` copiés depuis https://github.com/mattpocock/skills (commit 6fd9479, licence MIT — voir LICENSE-mattpocock-skills).
Pour mettre à jour : re-copier depuis le repo upstream.

Skills d'interface installés depuis [skills.sh](https://skills.sh) avec `npx skills add … --copy` (versions dans `skills-lock.json`, à la racine) :

- `impeccable` — [pbakaus/impeccable](https://github.com/pbakaus/impeccable) : critique, audit, polish d'une interface. Son lanceur (`scripts/impeccable`) télécharge un binaire : on ne l'exécute pas, on suit ses guides de `reference/`.
- `web-design-guidelines` — [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) : revue d'une UI contre les Web Interface Guidelines.
- `frontend-design` — [anthropics/skills](https://github.com/anthropics/skills) : direction visuelle d'une nouvelle interface.

Skills de stack, installés de la même façon :

- `chrome-extensions` — [GoogleChrome/modern-web-guidance](https://github.com/GoogleChrome/modern-web-guidance) (Apache-2.0) : bonnes pratiques MV3 et publication sur le Chrome Web Store (justification des permissions, refus de revue, politique de confidentialité).
- `wxt-browser-extensions` — [pproenca/dot-skills](https://github.com/pproenca/dot-skills) (MIT) : règles de performance WXT (service worker, injection, messages, stockage, bundles). Écrit pour un cas générique : nos choix (`docs/adr/`, `CLAUDE.md`) priment.
- `echarts` — [sentimony/skills](https://github.com/sentimony/skills) (MIT) : cycle de vie, redimensionnement, thèmes et gros volumes avec Apache ECharts.
- `improve` — [shadcn/improve](https://github.com/shadcn/improve) (MIT) : audit de la code base en lecture seule ; écrit des plans d'implémentation dans `plans/` pour qu'un autre agent les exécute.

Pour les mettre à jour : `npx skills update -p`.
