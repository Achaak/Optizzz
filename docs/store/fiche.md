# Fiche des stores

Textes à copier dans le Chrome Web Store et sur addons.mozilla.org (AMO).

## Nom

Optizzz

## Résumé (≤ 132 caractères — Chrome « Résumé », AMO « Résumé »)

Outils pour le jeu Fourmizzz : carte de l'alliance, voisins les plus proches et temps de trajet entre membres.

## Description

Optizzz ajoute des outils au jeu de stratégie Fourmizzz (fourmizzz.fr), directement dans les pages du jeu.

**Carte de l'alliance**
Une entrée « Carte » apparaît dans le menu Alliance. Elle affiche tous les membres de ton alliance sur la carte du serveur :
• chaque membre est relié à ses plus proches voisins (nombre réglable) ;
• zoom à la molette ou au pincement, déplacement à la souris, double-clic pour zoomer sur un joueur ;
• un tableau des temps de trajet entre un membre et tous les autres, dans les deux sens (aller avec ta Vitesse d'attaque, retour avec celle du membre) ;
• la Vitesse d'attaque de chaque membre se saisit dans le tableau et se partage par simple copier-coller sur le forum ou Discord.

Les positions viennent de l'API publique de Fourmizzz, le terrain de chasse est lu en direct sur la page Membres.

**Respect de ta vie privée**
Aucune donnée n'est collectée ni envoyée ailleurs que vers Fourmizzz. Les réglages restent dans ton navigateur. Code source ouvert (licence MIT) : https://github.com/Achaak/Optizzz

Optizzz est un projet de joueur, non affilié à Fourmizzz.

## Catégorie

- Chrome : Jeux (« Games »)
- AMO : Jeux et divertissement (« Games & Entertainment »)

## Langue

Français

## Liens

- Site / page d'accueil : https://github.com/Achaak/Optizzz
- Assistance : https://github.com/Achaak/Optizzz/issues
- Politique de confidentialité : https://github.com/Achaak/Optizzz/blob/main/PRIVACY.md

## Visuels

- Icône 128×128 : `.output/chrome-mv3/icons/128.png` (générée depuis `src/assets/icon.svg`)
- Captures d'écran Chrome : 1280×800 (au moins une, jusqu'à cinq)
- Image promotionnelle Chrome (facultative) : 440×280

## Chrome — onglet « Pratiques de confidentialité »

**Objectif unique**
Ajouter des outils d'aide au jeu Fourmizzz dans les pages du jeu, à commencer par une carte des membres de l'alliance avec leurs voisins les plus proches et les temps de trajet.

**Justification — `storage`**
Enregistrer localement les réglages de la carte d'alliance (nombre de voisins, niveaux de Vitesse d'attaque saisis) et le dernier export public des joueurs, pour ne pas le retélécharger.

**Justification — autorisation d'accès à l'hôte `*://*.fourmizzz.fr/*`**
L'extension n'agit que sur le jeu Fourmizzz : elle ajoute l'entrée « Carte » au menu d'alliance, affiche la carte dans la page Membres et lit l'API publique des exports du serveur de jeu.

**Code distant** : Non, je n'utilise pas de code distant.

**Utilisation des données** : ne rien cocher (aucune donnée utilisateur collectée), puis cocher les trois attestations (pas de vente à des tiers, pas d'usage sans rapport avec l'objectif unique, pas d'usage pour la solvabilité ou le prêt).

## AMO — informations supplémentaires

- Licence : MIT
- Politique de confidentialité : coller le contenu de `PRIVACY.md`
- Notes pour les relecteurs : « Code source joint (optizzz-X.Y.Z-sources.zip). Build : `pnpm install --frozen-lockfile && pnpm build:firefox` (Node 24, pnpm 12), résultat dans `.output/firefox-mv3/`. Aucune donnée n'est transmise ; les seules requêtes vont vers le serveur Fourmizzz de la page (`/api/exports/`, `/laboratoire.php`). »
- Compatibilité : Firefox et Firefox pour Android
