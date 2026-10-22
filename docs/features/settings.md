# Feature : Paramètres / À propos

## But

Un point d'entrée unique pour l'extension, accessible depuis la barre d'outils du navigateur et depuis le jeu. Il contient « Fonctionnalités » (voir `feature-toggles.md`), « Notifications » (voir `alertes.md`), « Outils » et « À propos » ; il accueillera plus tard les paramètres et les thèmes.

## Comportement

- **Deux accès** : une roue dentée dans la barre du haut du jeu, à gauche du bouton de déconnexion, et la popup de l'icône Optizzz dans la barre d'outils du navigateur.
- **En jeu** : la roue ouvre (ou ferme) une fenêtre « Paramètres » construite dans la page (Shadow DOM, pas d'iframe : Chrome bloque une page d'extension affichée dans une iframe tant qu'elle n'est pas déclarée accessible au web). Fenêtre non bloquante, au style du jeu, avec des onglets ; on ferme par × ou Échap. Un second clic rapide sur la roue pendant l'ouverture ne crée pas de seconde fenêtre. À l'ouverture, le focus va sur l'onglet affiché ; à la fermeture, il revient sur la roue. Les flèches gauche / droite passent d'un onglet à l'autre (seul l'onglet affiché est dans l'ordre de tabulation). Les futurs paramètres et thèmes y ajouteront chacun leur onglet (`settingsTabs` dans `dialog.ts`).
- **Onglets** : « Fonctionnalités » (ouvert en premier), « Notifications », « Outils » (simulateur de combat, carte du serveur, Suivis ; depuis la popup, les Suivis ouvrent le jeu du dernier serveur visité) puis « À propos », les mêmes dans la popup (`buildTabs`, 380 px de large pour garder les quatre onglets sur une ligne). La fenêtre a une hauteur fixe : changer d'onglet ne la fait pas sauter, l'onglet défile dedans.
- **« Fonctionnalités »** : un champ filtre les fonctionnalités (nom, description ou option, sans tenir compte des accents) et un compteur dit combien sont activées. Après un changement, l'avis « Recharger la page » reste collé en bas de l'onglet, où qu'on ait cliqué.
- **« Notifications »** : l'avis « pas encore autorisées » et son bouton « Autoriser » passent en tête, sous l'introduction ; les dépendances coupées (« Fonctionnalités », « Heures de fin », Suivis) sont des encarts d'avertissement.
- **Onglet « À propos »** : nom, icône, version (lue dans le manifest, donc dans `package.json`), liens vers le code source sur GitHub, « Signaler un bug » et « Proposer une fonctionnalité ».
- Les deux derniers ouvrent les formulaires d'issue GitHub `.github/ISSUE_TEMPLATE/bug.yml` et `feature.yml` (paramètre `template` de l'URL). Le rapport de bug pré-remplit les champs `version` et `browser` (les autres paramètres de l'URL portent l'`id` d'un champ du formulaire : renommer un `id` casse le pré-remplissage). Les labels (`bug` / `enhancement`) viennent du formulaire, donc s'appliquent à tout le monde. Les issues vierges sont désactivées (`config.yml`).
- Pas de React : le content script léger est chargé sur toutes les pages. Une seule permission, **optionnelle** : `notifications`, demandée sur un clic depuis la page de l'extension `notifications-permission.html` (voir `alertes.md`). Rien n'est envoyé.

## Fichiers

- `apps/extension/src/features/settings/menu-button.ts` (+ test) : la roue dans la barre du jeu.
- `apps/extension/src/features/settings/dialog.ts` (+ test) : la fenêtre et ses onglets ; `panel.ts` : son montage dans la page.
- `apps/extension/src/features/settings/about-section.ts` : l'onglet « À propos » ; `features-section.ts` (+ test) : l'onglet « Fonctionnalités » ; `notifications-section.ts` (+ test) : l'onglet « Notifications » ; `tools-section.ts` : l'onglet « Outils ».
- `apps/extension/src/features/settings/links.ts` (+ test) : URL des issues ; `.github/ISSUE_TEMPLATE/` : les formulaires.
- `apps/extension/src/entrypoints/popup/` : la popup de l'icône.
