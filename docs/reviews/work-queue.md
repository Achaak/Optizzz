# Revue : Chantiers en cours (`work-queue`)

- Relecteur : sous-agent A
- Date : 2026-10-08
- Version : `package.json` 1.0.1, commit e228c3a, build `chrome-mv3-dev` chargé dans Chrome
- Pages testées : construction.php, laboratoire.php (S5, compte avec Compte+, aucun chantier en cours), feature coupée puis rétablie
- Doc lue : `docs/features/work-queue.md` (+ `docs/research/fourmizzz-pages.md` « Chantiers en cours », `docs/research/ressources-et-entretien.md`)

## Résumé

Feature petite et bien découpée (lecture / progression / montage), testée sur trois fixtures. En jeu, file vide : « Aucune construction en cours » / « Aucune recherche en cours » en tête de page, aucune erreur console ; la coupure dans « Fonctionnalités » est respectée au rechargement. Points faibles : la barre de progression repose sur un facteur ×1,6 / ×1,7 non vérifié et sur une hypothèse fragile quand le même bâtiment est deux fois dans la file ; le tableau ne se met pas à jour quand un chantier se termine page ouverte.

| Bloquant | Majeur | Mineur | Suggestion |
| -------- | ------ | ------ | ---------- |
| 0        | 0      | 4      | 2          |

## Constats

### work-queue-01 · Progression fausse quand le même bâtiment est deux fois dans la file

- **Gravité** : mineur
- **Catégorie** : bug
- **Emplacement** : `src/features/work-queue/queue.ts:38` (`readRowDuration(doc, text[1])`), `src/features/work-queue/progress.ts:20`
- **Ce qui se passe** : la durée du chantier en cours est déduite de la durée affichée sur la ligne du bâtiment (÷ 1,6). La ligne est cherchée par son nom seul. Si la file contient « Champignonnière 8 → 9 » puis « Champignonnière 9 → 10 », la ligne affiche probablement la durée du niveau 11 : la durée du premier est alors surestimée d'un facteur 1,6 et sa barre reste trop basse.
- **Ce qui est attendu** : diviser par 1,6 autant de fois qu'il y a d'éléments du même nom dans la file avant la ligne (ou ne pas afficher de barre dans ce cas).
- **Capture** : — (pas de file sur le compte)
- **Touche aussi** : —

### work-queue-02 · Le tableau ne suit pas la fin d'un chantier page ouverte

- **Gravité** : mineur
- **Catégorie** : bug
- **Emplacement** : `src/features/work-queue/mount.ts:49-50`, `src/features/work-queue/progress.ts:18`
- **Ce qui se passe** : la file est lue une fois au chargement. Quand le premier élément arrive à sa fin, il reste « en cours » à « 0 min » et 100 % ; l'élément suivant reste « en attente » à 0 % (un élément avec un `previousEnd` vaut toujours 0 %, même quand `previousEnd` est passé). Le pied « File pleine : prochaine place libre … » garde une heure passée.
- **Vérifié en jeu** : la fonction `reste` du jeu ne recharge pas la page (aucun `location` / `reload` dans son code : elle se relance par `setTimeout`). Le cas se produit donc dès qu'un joueur laisse la page ouverte.
- **Ce qui est attendu** : faire avancer l'élément suivant (état « en cours », barre calculée depuis `previousEnd`) ou afficher « terminé ».
- **Capture** : —
- **Touche aussi** : —

### work-queue-03 · Tableau éventuellement placé loin des lignes du jeu

- **Gravité** : mineur
- **Catégorie** : code
- **Emplacement** : `src/features/work-queue/mount.ts:93-105`
- **Ce qui se passe** : `hideGameLines` retient l'élément qui suit la dernière ligne masquée. Si la dernière ligne n'a pas de frère après ses `<br>`/`<small>`, `last` vaut `null` et le tableau se replie sur `#centre .Bas` ou en tête de `#centre`, donc pas forcément à l'endroit des lignes masquées.
- **Ce qui est attendu** : insérer le tableau avant la première ligne masquée (point d'ancrage sûr), ou à défaut après la dernière.
- **Capture** : —
- **Touche aussi** : —

### work-queue-04 · Format d'heure de la doc différent du code

- **Gravité** : mineur
- **Catégorie** : doc
- **Emplacement** : `docs/features/work-queue.md` (colonne « Fin » : « demain 02 h 10 ») ; `src/utils/time-format.ts:22`
- **Ce qui se passe** : le code n'ajoute pas de zéro devant l'heure (« demain 2 h 10 », comme le dit d'ailleurs son commentaire ligne 34). La doc montre « 02 h 10 ».
- **Ce qui est attendu** : aligner la doc sur le code.
- **Capture** : —
- **Touche aussi** : end-times, resource-forecast (même utilitaire)

### work-queue-05 · Couleurs et bordures codées en dur

- **Gravité** : suggestion
- **Catégorie** : UI
- **Emplacement** : `src/features/work-queue/index.ts:7-16`
- **Ce qui se passe** : `#000` pour les bordures, `#6b8e23` pour la barre, tailles en px, le tout dans une feuille `<style>` injectée dans la page par la feature. Aucune variable CSS partagée avec les autres features.
- **Ce qui est attendu** : des tokens communs (`--optizzz-border`, `--optizzz-progress`…) pour qu'un thème « moderne » puisse les remplacer.
- **Capture** : —
- **Touche aussi** : toutes les features légères (même schéma)

### work-queue-06 · Colonne « Annuler » sans en-tête, intérêt de la colonne « État » limité

- **Gravité** : suggestion
- **Catégorie** : UX
- **Emplacement** : `src/features/work-queue/mount.ts:28-30`, `:56`
- **Ce qui se passe** : la dernière colonne a un `<th>` vide ; « État » répète une information déjà donnée par l'ordre (1ʳᵉ ligne = « en cours »).
- **Ce qui est attendu** : une colonne « État » pourrait être fusionnée avec la progression (« en attente » à la place de la barre vide).
- **Capture** : — (tableau vide sur le compte : en-tête masqué)
- **Touche aussi** : —

## Questions ouvertes

### Q1 · Facteurs ×1,6 (construction) et ×1,7 (recherche)

- **Observation** : `progress.ts:13` s'appuie sur `docs/research/ressources-et-entretien.md:49`, qui marque ces facteurs « **À vérifier** sur des valeurs réelles ».
- **Hypothèses** : 1) les facteurs sont exacts et la barre est juste ; 2) ils sont approximatifs (arrondis du jeu) et la barre dérive de quelques %.
- **Comment trancher** : comparer deux niveaux successifs d'un même bâtiment sur construction.php (durée affichée au niveau n puis n+1), ou les formules de Calystene.

### Q2 · Le lien « Annuler » garde-t-il la confirmation du jeu ?

- **Observation** : le tableau recopie seulement le `href` du lien du jeu (`mount.ts:73-77`). La doc dit que « le jeu demande déjà une confirmation ». Les fixtures n'ont pas d'`onclick` : si la confirmation est portée par un attribut ou un écouteur sur le lien d'origine, elle est perdue ; si elle est côté serveur (page intermédiaire), tout va bien.
- **Hypothèses** : 1) confirmation côté serveur ; 2) confirmation JS sur le lien d'origine, absente de notre copie.
- **Comment trancher** : lire le DOM réel du lien (attributs, écouteurs jQuery) quand un chantier est en cours, **sans cliquer**. Non fait : aucun chantier en cours sur le compte le 2026-10-08.

### Q3 · Heure locale ou heure du serveur ?

- **Observation** : les heures de fin (`time-format.ts`) sont dans le fuseau du navigateur ; le jeu écrit « Terminé à 13h06 » à l'heure du serveur (France, a priori).
- **Hypothèses** : 1) identiques pour un joueur en France, sans effet ; 2) un joueur dans un autre fuseau voit deux heures différentes sur la même page.
- **Comment trancher** : décision produit (heure locale voulue ?).

## Préparation au mode « moderne »

- **Facilite** : classes préfixées (`optizzz-work-queue`, `-bar`), la largeur de la barre passe déjà par une variable CSS (`--progress`), rendu séparé de la lecture (`render`).
- **Bloque** : couleurs codées en dur (`index.ts:9,15`), feuille de style propre à la feature, police et couleurs du texte héritées du jeu (pas de token).

## Hors périmètre / non testé

- Le clic sur « Annuler » (action de jeu) : non fait.
- Tableau rempli (un élément, file pleine, même bâtiment deux fois) : aucun chantier ni aucune recherche en cours sur le compte pendant la revue ; seuls les cas vides ont été vus en jeu. Les autres cas reposent sur les tests vitest.
- Petites largeurs (~800 px, ~400 px) : le redimensionnement de la fenêtre par l'outil n'a eu aucun effet (largeur restée à 1 728 px) ; non testé.
