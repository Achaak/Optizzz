<p align="center"><img src="src/assets/icon.svg" width="96" alt=""></p>

# Optizzz

Extension Chrome et Firefox qui ajoute des outils au jeu [Fourmizzz](http://www.fourmizzz.fr).

## Fonctionnalités

### Carte de l'alliance

Une entrée **Carte** dans le menu Alliance affiche tous les membres sur la carte du serveur :

- chaque membre est relié à ses **k plus proches voisins** (3 par défaut, réglable) ;
- zoom à la molette ou au pincement, déplacement à la souris, double-clic pour zoomer sur un joueur ;
- un tableau des **temps de trajet** entre le joueur sélectionné et chaque membre, dans les deux sens ;
- la **Vitesse d'attaque** de chaque membre se saisit dans le tableau et se partage par copier-coller (forum, Discord).

Les positions viennent de l'[API publique des exports](https://s5.fourmizzz.fr/developer.php) de Fourmizzz, le TDC est lu en direct sur la page Membres.

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
