# Fiche des stores

Textes à copier dans le Chrome Web Store et sur addons.mozilla.org (AMO).

## Nom

Optizzz

## Résumé (≤ 132 caractères — Chrome « Résumé », AMO « Résumé »)

Outils pour Fourmizzz : heures de fin, prévisions de ressources, ponte, chasse, simulateur de combat, carte de l'alliance.

## Description

Optizzz ajoute des outils au jeu de stratégie Fourmizzz (fourmizzz.fr), directement dans les pages du jeu. Chaque outil se désactive dans les paramètres (roue dentée dans la barre du jeu).

• **Chantiers en cours** : tableau des constructions et recherches, avec progression et heure de fin.
• **Heures de fin** : l'heure de fin des chasses, pontes et chantiers à côté des décomptes, et un encart « Prochaines fins ».
• **Prévisions de ressources** : quand tu pourras payer, quand tu tomberas en famine, quand un entrepôt sera plein ; simulateur de répartition des ouvrières.
• **Planificateur de ponte** : fin de la ponte, date à laquelle elle sera payable, entretien et bouton « max ».
• **Rapports de chasse** : tableau des combats de chaque chasse dans la messagerie, avec les pertes prévues.
• **Simulateur de combat** : depuis la page Armée ou la barre d'outils du navigateur.
• **Lanceur de chasse** : combien chasser et avec quelles unités, puis lancer en un clic.
• **Carte de l'alliance** : les membres sur la carte, reliés à leurs plus proches voisins, avec les temps de trajet dans les deux sens.

Optizzz n'agit jamais seul : une chasse n'est lancée et une répartition appliquée que lorsque tu cliques.

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
Ajouter des outils d'aide au jeu Fourmizzz dans les pages du jeu : heures de fin, prévisions de ressources, ponte, chasse, combat et carte de l'alliance.

**Justification — `storage`**
Enregistrer localement les paramètres (outils activés, réglages), les niveaux de recherche lus dans le jeu, les heures de fin vues sur les pages et le dernier export public des joueurs, pour ne pas le retélécharger.

**Justification — autorisation d'accès à l'hôte `*://*.fourmizzz.fr/*`**
L'extension n'agit que sur le jeu Fourmizzz : elle affiche ses outils dans les pages du jeu, lit les pages du jeu et l'API publique des exports du serveur, et envoie les formulaires du jeu (lancer une chasse, appliquer une répartition) uniquement quand le joueur clique.

**Code distant** : Non, je n'utilise pas de code distant.

**Utilisation des données** : ne rien cocher (aucune donnée utilisateur collectée), puis cocher les trois attestations (pas de vente à des tiers, pas d'usage sans rapport avec l'objectif unique, pas d'usage pour la solvabilité ou le prêt).

## AMO — informations supplémentaires

- Licence : MIT
- Politique de confidentialité : coller le contenu de `PRIVACY.md`
- Notes pour les relecteurs :

  > Sources jointes (optizzz-X.Y.Z-sources.zip). Build : `pnpm install --frozen-lockfile && pnpm build:firefox` (Node 24, pnpm 12), résultat dans `.output/firefox-mv3/`.
  >
  > Aucune donnée n'est transmise à un tiers : toutes les requêtes vont vers le serveur Fourmizzz de la page (API publique `/api/exports/`, pages du jeu), et les formulaires du jeu ne sont envoyés que sur clic du joueur.
  >
  > Les avertissements restants viennent de bibliothèques, pas de notre code (qui interdit innerHTML via ESLint) : React DOM (prise en charge de `dangerouslySetInnerHTML`, non utilisé), Apache ECharts (contenu HTML des infobulles et export SVG, alimentés par du texte échappé) et zod (test `Function("")` de disponibilité d'eval, désactivé par `z.config({ jitless: true })`).

- Compatibilité : Firefox et Firefox pour Android
