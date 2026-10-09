# Revue : Calculateur de convoi (`convoy`)

- Relecteur : sous-agent D
- Date : 2026-10-08
- Version : `package.json` 1.0.1, commit e228c3a (les notifications, annoncées non commitées, sont dans ce commit)
- Pages testées : `commerce.php` sur s5, compte Achak avec Compte+ (saisies sans envoi, page rechargée ensuite), `laboratoire.php`, `construction.php` (lecture) ; interrupteur « Calculateur de convoi » coupé puis rétabli
- Doc lue : `docs/features/convoy.md` (+ `docs/research/temps-de-trajet.md`, `docs/research/fourmizzz-pages.md` « commerce.php »)

## Résumé

Feature légère, propre et bien testée sur le cœur (lecture des convois en cours, ouvrières, trajet, tri des destinataires). En jeu, le bloc s'affiche dans l'encadré « Convois » du jeu, sous le bouton, en texte simple qui hérite de ses styles (capture `img/convoy-00.jpg`) : « Brosse à 18,4 cases · trajet ≈ 5 h 58 · arrivée ≈ aujourd'hui 23 h 39 », puis « 2 000 ouvrières, dont 575 au travail : ≈ 6 854 de récolte perdue pendant le trajet ». « 20k » est bien compris. Une fois la feature coupée, rien n'est injecté (ni bloc, ni `datalist`, ni `<style>`). Les défauts sont surtout des cas limites (expéditeur absent de l'export, échec réseau qui fait aussi tomber les heures d'arrivée des convois en cours) et une règle de récolte recopiée au lieu d'être partagée.

| Bloquant | Majeur | Mineur | Suggestion |
| -------- | ------ | ------ | ---------- |
| 0        | 0      | 5      | 3          |

## Constats

### convoy-01 · Un échec réseau fait aussi disparaître les heures d'arrivée des convois en cours

- **Gravité** : mineur
- **Catégorie** : bug
- **Emplacement** : `src/features/convoy/index.ts:22-26`
- **Ce qui se passe** : `run` attend `Promise.all([loadPlayersExport, loadLevelsOf, loadIncome])` avant de monter quoi que ce soit. Si l'une échoue (export indisponible, `loadIncome` sans cache et `Ressources.php` en erreur, `loadLevelsOf` qui lance sur un `fetch` en échec), la feature lance une exception (loguée par `runFeatures`) et rien n'est affiché, **y compris** « · arrivée … » après les convois en cours, qui ne dépend que de la page.
- **Ce qui est attendu** : les heures d'arrivée des convois en cours posées d'abord, sans dépendance réseau ; le calculateur dégradé (message « export indisponible ») plutôt qu'absent.
- **Touche aussi** : game-levels (`loadLevelsOf` sans gestion d'erreur), resource-forecast (`loadIncome` relance l'erreur sans cache)

### convoy-02 · Message trompeur quand c'est l'expéditeur qui manque dans l'export

- **Gravité** : mineur
- **Catégorie** : bug
- **Emplacement** : `src/features/convoy/mount.ts:68-69`
- **Ce qui se passe** : la condition `typed && (!recipient || !sender)` affiche « <destinataire> n'est pas dans l'export d'hier » même quand le destinataire y est et que c'est le joueur lui-même qui manque (compte créé depuis l'export de la nuit, pseudo changé). Les suggestions perdent aussi leur distance (`mount.ts:48-50`) sans explication.
- **Ce qui est attendu** : un message distinct, par exemple « Vous n'êtes pas encore dans l'export d'hier : pas de temps de trajet. »
- **Touche aussi** : —

### convoy-03 · Récolte perdue : règle recopiée, sans la taxe

- **Gravité** : mineur
- **Catégorie** : cohérence
- **Emplacement** : `src/features/convoy/convoy.ts:75-76`, `:90` ; à comparer avec `src/features/resource-forecast/forecast.ts:22` et `:71-72`
- **Ce qui se passe** : le convoi code en dur « 2 ressources par ouvrière et par heure » (`workingTaken * 2 * duration / 3 600 000`). Les Prévisions de ressources modélisent la même règle autrement : une récolte toutes les 30 min (`HARVEST_INTERVAL`), multipliée par `1 − taxRate`. Le chiffre du convoi ignore donc la taxe et peut différer de celui des Prévisions pour la même colonie.
- **Ce qui est attendu** : une seule règle de récolte dans `src/game/` (intervalle, quantité par ouvrière, taxe), utilisée par les deux features.
- **Touche aussi** : resource-forecast, game

### convoy-04 · Convoi vers soi-même : « à 0 cases · trajet ≈ 0 min »

- **Gravité** : mineur
- **Catégorie** : UX
- **Emplacement** : `src/features/convoy/mount.ts:66-89`
- **Ce qui se passe** : vu en jeu. Avec « Achak » (ou « achak ») et 20k matériaux, le bloc affiche « Achak à 0 cases · trajet ≈ 0 min · arrivée ≈ aujourd'hui 17 h 42 », puis « 2 000 ouvrières, dont 575 au travail : ≈ 0 de récolte perdue pendant le trajet ». Le tri des suggestions exclut bien l'expéditeur (`convoy.ts:96-98`), mais pas la saisie libre.
- **Ce qui est attendu** : un message du type « Vous ne pouvez pas vous envoyer un convoi » (à confirmer avec le refus réel du jeu, sans soumettre).
- **Touche aussi** : —

### convoy-05 · Le calculateur relit Ressources.php en arrière-plan, non documenté

- **Gravité** : mineur
- **Catégorie** : doc
- **Emplacement** : `src/features/convoy/index.ts:25` (`loadIncome(location.origin, INCOME_MAX_AGE, now)`, 15 min) ; `docs/features/convoy.md`
- **Ce qui se passe** : sur `commerce.php`, si les revenus ont plus de 15 min, la feature fait un GET de `Ressources.php` (et de `laboratoire.php` / `construction.php` via `loadLevelsOf` si les niveaux sont inconnus). C'est vrai même si « Prévisions de ressources » est coupée. La doc mentionne la relecture du Laboratoire, pas celle de Ressources ni de Construction.
- **Ce qui est attendu** : une section « Données » dans `convoy.md` qui liste les pages relues et à quelle fréquence.
- **Touche aussi** : resource-forecast, settings (dépendances cachées entre features)

### convoy-06 · Les suggestions contiennent tout l'export du serveur

- **Gravité** : suggestion
- **Catégorie** : UX
- **Emplacement** : `src/features/convoy/mount.ts:42-56`
- **Ce qui se passe** : en jeu sur s5, la `datalist` contient **1 651 options**, de « Brosse | UPTEP · 18,4 cases » à « Jogywan | C6P · 105,6 cases ». Le navigateur les propose toutes dès le focus du champ. Au tout premier chargement de `commerce.php`, l'onglet est resté figé plus de 45 s (« renderer unresponsive »). Ce n'est pas reproduit sur les deux chargements suivants (`datalist` construite en moins de 2,5 s) : la cause n'est pas établie, ce peut être le jeu ou le réseau.
- **Ce qui est attendu** : limiter la liste (l'alliance, puis les N plus proches ou une distance maximale).
- **Touche aussi** : —

### convoy-07 · Utilitaires recopiés et dépendances vers d'autres features

- **Gravité** : suggestion
- **Catégorie** : code
- **Emplacement** : `src/features/convoy/convoy.ts:22` et `mount.ts:23` (`toInteger` deux fois dans la même feature) ; `mount.ts:49` et `:86` (format de distance répété) ; imports `../work-queue/queue` (`parseGameDuration`), `../alliance-map/api` et `../alliance-map/pages`, `../resource-forecast/*`
- **Ce qui se passe** : la feature dépend de quatre autres features pour des briques génériques (lecture des durées du jeu, export public, pseudo connecté, stock). Couper ou renommer l'une d'elles casse le convoi. Voir `transverse-ui.md` pour l'inventaire global.
- **Ce qui est attendu** : ces briques dans `src/utils/` ou un module partagé « pages du jeu », et `formatDistance` à côté de `formatNumber`.
- **Touche aussi** : transverse-ui, alliance-map, work-queue, resource-forecast

### convoy-08 · Trous dans les tests

- **Gravité** : suggestion
- **Catégorie** : code
- **Emplacement** : `src/features/convoy/mount.test.ts`, `convoy.test.ts`
- **Ce qui se passe** : non couverts : la branche « N ouvrières, toutes sans travail » (`mount.ts:95`), l'expéditeur absent de l'export, le compte d'ouvrières du jeu (`#nbOuvriere` > 0) contre le calcul par étable, un niveau d'étable > 0 de bout en bout, et `index.ts` (garde-fous, échec réseau).
- **Ce qui est attendu** : un test par branche affichée.
- **Touche aussi** : —

## Questions ouvertes

### Q1 · « Récolte perdue pendant le trajet » alors que les ouvrières ne reviennent pas

- **Observation** : `docs/research/fourmizzz-pages.md` (« commerce.php ») et `convoy.ts:69` notent que les ouvrières ne font pas de trajet retour. Le texte affiché parle pourtant de « récolte perdue pendant le trajet » et compte seulement la durée de l'aller (`convoy.ts:90`).
- **Hypothèses** : 1) les ouvrières reviennent instantanément à l'arrivée : la perte se limite bien au trajet ; 2) les ouvrières sont perdues pour l'expéditeur (données avec la cargaison, ou disparues) : la perte est définitive, et le vrai coût est « N ouvrières », pas une récolte bornée dans le temps ; 3) elles rentrent au même rythme mais le retour n'est pas affiché par le jeu.
- **Comment trancher** : comparer le nombre d'ouvrières (`#data`) avant le départ, pendant le trajet et après l'arrivée d'un petit convoi (action de jeu : à demander au joueur) ; aide `#explication_convois`.

### Q2 · Ordre de prise des ouvrières

- **Observation** : `planConvoy` suppose que le convoi prend d'abord les ouvrières sans travail (`convoy.ts:61`, `:83`). Le jeu distingue « premier clic avec les ouvrières disponibles, second avec toutes » (`fourmizzz-pages.md`).
- **Hypothèses** : 1) « disponibles » = sans travail, et le jeu les prend en premier ; 2) le jeu retire au prorata des récolteuses de nourriture et de matériaux.
- **Comment trancher** : lire l'aide `#explication_convois` et la page Ressources après un convoi.

## Préparation au mode « moderne »

- **Facilite** : aucune couleur ni taille en px ; 4 règles CSS préfixées `.optizzz-convoy*` dans `CONVOY_STYLE` (`mount.ts:6-10`), texte en `<p>` qui hérite de la police du jeu. Un thème n'aurait qu'à surcharger ces classes.
- **Bloque** : rien de spécifique. Le style est une chaîne injectée dans `document.head` (DOM du jeu, pas de Shadow DOM), comme les autres features légères : un thème devra cibler chacune de ces chaînes (voir `transverse-ui.md`).

## Hors périmètre / non testé

- Convois en cours : le compte n'en avait aucun (« Aucun convoi »). Le « · arrivée … » n'est vérifié que sur la fixture.
- Petites largeurs : non testées. Le redimensionnement de la fenêtre n'a pas d'effet dans cet environnement, et le bloc est dans l'encadré à largeur fixe du jeu : il suit sa mise en page.
- Liste déroulante de la `datalist` : le menu natif du navigateur n'apparaît pas sur les captures. Elle a été vérifiée par le DOM.
- Erreurs console : aucune sur `commerce.php` (lecture faite après chargement).
- Aucun convoi envoyé : ni « Lancer le convoi » ni Entrée. La question Q1 demande une action de jeu, laissée au joueur.
