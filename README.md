<p align="center"><img src="src/assets/icon.svg" width="96" alt=""></p>

# Optizzz

Extension Chrome et Firefox qui ajoute des outils au jeu [Fourmizzz](http://www.fourmizzz.fr).

## Installer

- **Chrome** (et navigateurs Chromium : Edge, Brave, Opera…) : [Chrome Web Store](https://chromewebstore.google.com/detail/optizzz/goeifkbimepccacjfkkmhjmhgoiigjpl)
- **Firefox** : bientôt sur addons.mozilla.org

## Fonctionnalités

Chaque outil se désactive dans les paramètres (roue dentée dans la barre du jeu, ou icône de l'extension).

- **Chantiers en cours** : tableau des constructions et recherches, avec progression et heure de fin.
- **Heures de fin** : l'heure de fin des chasses, pontes et chantiers à côté des décomptes, et un encart « Prochaines fins ».
- **Prévisions de ressources** : quand tu pourras payer, famine, entrepôts pleins, et un simulateur de répartition des ouvrières.
- **Planificateur de ponte** : raccourcis de ponte avec aperçu (tout payer, durée, bilan à zéro), fin, date de paiement et entretien sur la Reine.
- **Rapports de chasse** : tableau des combats de chaque chasse dans la messagerie, avec les pertes prévues.
- **Simulateur de combat** : depuis la page Armée ou le popup de l'extension.
- **Lanceur de chasse** : combien chasser et avec quoi, puis lancer en un clic.
- **Rechargement sans risque** : recharger une page ou revenir en arrière ne relance plus une ponte, une chasse ou une construction.
- **Carte de l'alliance** : les membres reliés à leurs plus proches voisins, avec les temps de trajet. Les positions viennent de l'[API publique des exports](https://s5.fourmizzz.fr/developer.php).

Optizzz n'agit jamais seul : les formulaires du jeu ne sont envoyés que lorsque tu cliques.

## Confidentialité

Aucune donnée n'est envoyée ailleurs que vers Fourmizzz. Voir [PRIVACY.md](PRIVACY.md).

## Développement

Prérequis : Node.js 24+, pnpm 12.

```bash
pnpm install
pnpm dev            # Chrome, rechargement à chaud
pnpm dev:firefox    # Firefox
pnpm test           # tests
pnpm lint && pnpm typecheck
```

### Construire l'extension (instructions pour la relecture AMO)

```bash
pnpm install --frozen-lockfile
pnpm build:firefox  # résultat : .output/firefox-mv3/
pnpm build          # Chrome : .output/chrome-mv3/
```

Le code est en TypeScript, empaqueté par [WXT](https://wxt.dev) (Vite). Aucun code distant n'est chargé.

## Crédits

Inspiré de [Toolzzz](https://github.com/GuiEpi/toolzzz) et d'[Outiiil](https://github.com/Hraesvelg/Outiiil). La formule du temps de trajet provient de Toolzzz.

## Licence

[MIT](LICENSE)
