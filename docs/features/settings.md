# Feature : Paramètres / À propos

## But

Un point d'entrée unique pour l'extension, accessible depuis la barre d'outils du navigateur et depuis le jeu. Il contient « Fonctionnalités » (voir `feature-toggles.md`) et « À propos » ; il accueillera plus tard les paramètres et les thèmes.

## Comportement

- **Deux accès** : une roue dentée dans la barre du haut du jeu, à gauche du bouton de déconnexion, et la popup de l'icône Optizzz dans la barre d'outils du navigateur.
- **En jeu** : la roue ouvre (ou ferme) une fenêtre « Paramètres » construite dans la page (Shadow DOM, pas d'iframe : Chrome bloque une page d'extension affichée dans une iframe tant qu'elle n'est pas déclarée accessible au web). Fenêtre non bloquante, au style du jeu, avec des onglets ; on ferme par × ou Échap. Les futurs paramètres et thèmes y ajouteront chacun leur onglet (`settingsTabs` dans `dialog.ts`).
- **Onglets** : « Fonctionnalités » (ouvert en premier), « Outils » (simulateur de combat) puis « À propos », les mêmes dans la popup (`buildTabs`).
- **Onglet « À propos »** : nom, icône, version (lue dans le manifest, donc dans `package.json`), liens vers le code source sur GitHub, « Signaler un bug » et « Proposer une fonctionnalité ».
- Les deux derniers ouvrent les formulaires d'issue GitHub `.github/ISSUE_TEMPLATE/bug.yml` et `feature.yml` (paramètre `template` de l'URL). Le rapport de bug pré-remplit les champs `version` et `browser` (les autres paramètres de l'URL portent l'`id` d'un champ du formulaire : renommer un `id` casse le pré-remplissage). Les labels (`bug` / `enhancement`) viennent du formulaire, donc s'appliquent à tout le monde. Les issues vierges sont désactivées (`config.yml`).
- Pas de React : le content script léger est chargé sur toutes les pages. Aucune permission ajoutée, rien n'est envoyé.

## Fichiers

- `src/features/settings/menu-button.ts` (+ test) : la roue dans la barre du jeu.
- `src/features/settings/dialog.ts` (+ test) : la fenêtre et ses onglets ; `panel.ts` : son montage dans la page.
- `src/features/settings/about-section.ts` : l'onglet « À propos » ; `features-section.ts` (+ test) : l'onglet « Fonctionnalités ».
- `src/features/settings/links.ts` (+ test) : URL des issues ; `.github/ISSUE_TEMPLATE/` : les formulaires.
- `src/entrypoints/popup/` : la popup de l'icône.
