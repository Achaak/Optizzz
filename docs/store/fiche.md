# Fiche des stores

Textes à copier dans le Chrome Web Store et sur addons.mozilla.org (AMO).

## Nom

Optizzz

## Résumé (≤ 132 caractères — Chrome « Résumé », AMO « Résumé »)

Outils pour Fourmizzz : heures de fin, prévisions de ressources, ponte, chasse, simulateur de combat, carte de l'alliance.

## Description

Optizzz ajoute des outils au jeu de stratégie Fourmizzz (fourmizzz.fr), directement dans les pages du jeu. Chaque outil se désactive dans les paramètres (roue dentée dans la barre du jeu).

• Chantiers en cours : tableau des constructions et recherches, avec leur progression et leur heure de fin.
• Heures de fin : l'heure de fin des chasses, pontes et chantiers à côté des décomptes, et un encart « Prochaines fins ».
• Prévisions de ressources : quand vous pourrez payer, quand vous tomberez en famine, quand un entrepôt sera plein, et un simulateur de répartition des ouvrières.
• Planificateur de ponte : sur la Reine, la fin de la ponte, quand elle sera payable, son entretien et un bouton « max ».
• Rapports de chasse : dans la messagerie, un tableau des combats de chaque chasse avec les pertes prévues.
• Simulateur de combat : depuis la page Armée ou l'icône de l'extension.
• Lanceur de chasse : sur Ressources, combien chasser et avec quelles unités, puis lancer en un clic.
• Carte de l'alliance : les membres sur la carte, reliés à leurs plus proches voisins, avec les temps de trajet dans les deux sens.

Optizzz n'agit jamais seul : une chasse n'est lancée et une répartition appliquée que lorsque vous cliquez.

Respect de votre vie privée : aucune donnée n'est collectée ni envoyée ailleurs que vers Fourmizzz. Vos réglages restent dans votre navigateur. Code source ouvert (licence MIT) : https://github.com/Achaak/Optizzz

Optizzz est un projet de joueur, non affilié à Fourmizzz.

## Notes de version 1.0.1

Première version publique : chantiers en cours, heures de fin, prévisions de ressources, planificateur de ponte, rapports de chasse, simulateur de combat, lanceur de chasse et carte de l'alliance.

## English listing (AMO / Chrome, locale en-US)

**Summary**

Tools for Fourmizzz: end times, resource forecasts, egg laying, hunting, combat simulator and alliance map.

**Description**

Optizzz adds tools to the strategy game Fourmizzz (fourmizzz.fr), right inside the game pages. Each tool can be switched off in the settings (gear icon in the game bar). The extension's interface is in French, like the game.

• Ongoing work: a table of constructions and research in progress, with their progress and end time.
• End times: the end time of hunts, egg laying and work next to the game's countdowns, plus a "Prochaines fins" (upcoming ends) box.
• Resource forecasts: when you will be able to pay, when you will run out of food, when a warehouse will be full, and a worker split simulator.
• Laying planner: on the Queen page, when the laying ends, when you can pay for it, its upkeep and a "max" button.
• Hunt reports: in the messages, a table of every fight of each hunt, with the predicted losses.
• Combat simulator: from the Army page or the extension icon.
• Hunt launcher: on the Resources page, how much to hunt and with which units, then launch in one click.
• Alliance map: members on the map, linked to their nearest neighbours, with travel times both ways.

Optizzz never acts on its own: a hunt is launched and a worker split applied only when you click.

Privacy: no data is collected or sent anywhere but Fourmizzz. Your settings stay in your browser. Open source (MIT licence): https://github.com/Achaak/Optizzz

Optizzz is a player-made project, not affiliated with Fourmizzz.

**Release notes 1.0.1**

First public release: ongoing work, end times, resource forecasts, laying planner, hunt reports, combat simulator, hunt launcher and alliance map.

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

Dans `docs/store/images/` (sources SVG à côté de chaque PNG ; aucune capture du jeu, donc aucun pseudo réel) :

- `icon-128.png` : icône 128×128 (AMO « Icône », Chrome « Icône de la fiche »)
- `promo-1280x800.png` : capture d'écran / image de présentation (AMO « Captures d'écran », Chrome « Captures d'écran »)
- `tile-440x280.png` : petite vignette promotionnelle Chrome

Pour regénérer les PNG après avoir modifié un SVG : les convertir avec `sharp` (taille d'origine, densité 72).

## Chrome — onglet « Pratiques de confidentialité »

**Objectif unique**
Ajouter des outils d'aide au jeu Fourmizzz dans les pages du jeu : heures de fin, prévisions de ressources, ponte, chasse, combat et carte de l'alliance.

**Justification — `storage`**
Enregistrer localement les paramètres (outils activés, réglages), les niveaux de recherche lus dans le jeu, les heures de fin vues sur les pages, les derniers exports publics des joueurs et des alliances, et les scores des exports de chaque nuit pour l'historique de progression, pour ne pas les retélécharger.

**Justification — `unlimitedStorage`**
Les exports publics mis en cache (dont l'historique des scores, une version par nuit) dépassent la limite de 10 Mo de `storage.local` dès qu'on joue sur plusieurs serveurs (l'export des joueurs d'un gros serveur pèse 4 Mo). Ces données restent dans le navigateur ; rien n'est envoyé ailleurs.

**Justification — `alarms`**
Recalculer chaque minute le badge de l'icône de l'extension (temps avant une famine ou un entrepôt plein dans le jeu) à partir des données déjà enregistrées localement. Aucune requête n'est faite en arrière-plan et rien n'est envoyé ailleurs.

**Justification — `notifications` (permission facultative)**
Demandée seulement quand le joueur active une notification dans les paramètres (famine ou entrepôt plein dans moins d'1 h, chantier terminé, chasse rentrée). Les notifications sont calculées à partir des données déjà enregistrées localement ; rien n'est envoyé ailleurs.

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
