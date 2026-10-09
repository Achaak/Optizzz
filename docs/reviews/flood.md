# Revue : Plan de flood (`flood`)

- Relecteur : sous-agent C
- Date : 2026-10-08
- Version : `package.json` 1.0.1, commit e228c3a (aucune modification non commitée hors `docs/reviews/`)
- Pages testées : `ennemie.php?Attaquer=1187&lieu=1` (GET), `Armee.php`, `ennemie.php` (colonne « Flood max », Plan de flood coupé puis rallumé)
- Doc lue : `docs/features/flood.md` (+ `docs/research/fourmizzz-pages.md` « ennemie.php » et « Armee.php », `docs/research/fourmizzz-api-exports.md`)

## Résumé

Le compte de test n'a **aucune unité** en garnison. Le jeu affiche alors « Vous n'avez pas d'armée a envoyer » à la place du formulaire, et l'encart ne peut pas apparaître : ce rapport repose donc surtout sur le code et les tests. Le calcul (`src/game/flood.ts`), la lecture du formulaire et le suivi des attaques en route sont testés, et Optizzz n'envoie jamais le formulaire. Le défaut principal : une attaque envoyée sur la Fourmilière ou la Loge est notée comme une prise de TDC, ce qui fausse les plans suivants. Autres points : la règle des 20 % est écrite à six endroits, et une panne de l'API supprime tout l'encart.

| Bloquant | Majeur | Mineur | Suggestion |
| -------- | ------ | ------ | ---------- |
| 0        | 1      | 6      | 2          |

## Constats

### flood-01 · Une attaque sur la Fourmilière ou la Loge est comptée comme une prise de TDC

- **Gravité** : majeur
- **Catégorie** : bug
- **Emplacement** : `src/features/flood/mount.ts:223-234` ; `src/features/flood/page.ts:65-72`
- **Ce qui se passe** : `onAttackSent` transmet le lieu choisi (`place`), mais `mountFloodPlanner` l'ignore. Toute attaque envoyée par le formulaire est notée avec `take = min(fourmis, floor(20 % du TDC de la cible))`. Si le joueur attaque la Fourmilière (lieu 2) ou la Loge (lieu 3), Optizzz suppose une prise de TDC qui n'aura pas lieu. Jusqu'à l'arrivée, mon TDC est surestimé et celui de la cible sous-estimé, dans le plan de toutes les cibles (`mount.ts:118-120`), et la portée affichée peut être fausse.
- **Ce qui est attendu** : noter `take: 0` hors du Terrain de Chasse, tout en comptant le créneau. Ajouter un test `onAttackSent` avec `lieu=2`.
- **Touche aussi** : targets (créneaux libres de « Flood max »)

### flood-02 · La prise notée ignore la défense et l'attaque remplie

- **Gravité** : mineur
- **Catégorie** : bug
- **Emplacement** : `src/features/flood/mount.ts:231` ; à comparer avec `src/game/flood.ts:171`
- **Ce qui se passe** : contre une défense collée, la première vague prend au plus ses survivants (`min(survivants, 20 %)`), mais l'envoi note `min(fourmis envoyées, 20 %)`, ce qui surestime la prise. Le plan connaît pourtant la prise prévue de la ligne « Remplir » utilisée (`planned[index].take`).
- **Ce qui est attendu** : noter la prise prévue de la ligne remplie si l'armée envoyée est la même, sinon le calcul actuel.
- **Touche aussi** : —

### flood-03 · Sans l'export public, aucun plan ne s'affiche

- **Gravité** : mineur
- **Catégorie** : bug
- **Emplacement** : `src/features/flood/index.ts:80-90`
- **Ce qui se passe** : `loadPlayersExport` est dans un `Promise.all`. Si l'API est injoignable et que le cache est vide (premier usage, serveur neuf), la promesse rejette et la feature s'arrête en silence (seulement `console.error` dans `run.ts`). L'export ne sert pourtant qu'au trajet et au TDC de repli : le TDC est lu sur le profil.
- **Ce qui est attendu** : un plan quand même, avec « trajet inconnu » (cas déjà prévu, `mount.ts:133-134`).
- **Touche aussi** : targets (même `Promise.all`, l'encart disparaît sans message)

### flood-04 · Une défense vide ou illisible est enregistrée comme « aucune »

- **Gravité** : mineur
- **Catégorie** : UX
- **Emplacement** : `src/features/flood/mount.ts:209-216`
- **Ce qui se passe** : « Utiliser cette défense » avec une zone vide ou un texte non reconnu enregistre une armée à zéro, datée, affichée « Sa défense sur le TDC (relevée il y a 1 min) : aucune ». Les Cibles la présentent ensuite comme « sa défense connue comprise » (`targets/mount.ts:232`). Aucun message ne signale que rien n'a été lu.
- **Ce qui est attendu** : bouton inactif sur une zone vide, et un message si rien n'est reconnu.
- **Touche aussi** : targets

### flood-05 · Vouvoiement ici, tutoiement dans la Carte et la Chaîne

- **Gravité** : mineur
- **Catégorie** : cohérence
- **Emplacement** : `src/features/flood/mount.ts:127,163,167,169,188` (« vous », « votre armée », « cochez ») ; à comparer avec `alliance-map/AllianceMap.tsx:84`, `tdc-chain/TdcChain.tsx:211,280,447` (« Ton alliance », « toi », « saisis », « colle-le »)
- **Ce qui se passe** : les features de l'extension ne s'adressent pas au joueur de la même façon. Les Cibles et l'Historique vouvoient, la Carte et la Chaîne tutoient. Le jeu vouvoie (« Vous allez attaquer… »).
- **Ce qui est attendu** : une règle (le vouvoiement du jeu, a priori), écrite dans `CLAUDE.md`.
- **Touche aussi** : alliance-map, tdc-chain, targets, history

### flood-06 · La prise de 20 % est écrite à six endroits

- **Gravité** : mineur
- **Catégorie** : code
- **Emplacement** : `src/game/flood.ts:47,171` ; `src/features/flood/mount.ts:231` ; `src/features/targets/targets.ts:50` ; `src/features/tdc-chain/chain.ts:6` ; `src/game/army/battle.ts:143`
- **Ce qui se passe** : `Math.floor(x * 0.2)` est réécrit partout. La portée avec marge l'est aussi deux fois (`flood.ts:32` et `chain.ts:47`). Les règles sont marquées « non vérifiées » (issue #1) : les recaler demandera de toucher tous ces fichiers.
- **Ce qui est attendu** : `fieldTake()`, `inRange()` et `inRangeWithMargin()` exportés de `src/game/flood.ts` (ou `src/game/army/`), et utilisés partout.
- **Touche aussi** : targets, tdc-chain

### flood-07 · La première vague contre une défense ne respecte pas la marge

- **Gravité** : mineur
- **Catégorie** : bug
- **Emplacement** : `src/game/flood.ts:168-192`
- **Ce qui se passe** : la vague d'ouverture prend `min(survivants, 20 %)` sans vérifier qu'une attaque suivante resterait dans la portée avec 1 % de marge. `planFlood` enchaîne ensuite avec `inRange` **sans** marge (`flood.ts:46`). Après l'ouverture, la cible peut se trouver entre 50 % et 50,5 % de mon TDC, et une deuxième attaque est quand même proposée. C'est le cas que la marge devait éviter.
- **Ce qui est attendu** : appliquer à la vague d'ouverture la même règle de prise limite qu'aux autres.
- **Touche aussi** : targets (« Flood max »)

### flood-08 · La doc ne cite pas `attacks.ts`

- **Gravité** : suggestion
- **Catégorie** : doc
- **Emplacement** : `docs/features/flood.md` (table « Code »)
- **Ce qui se passe** : le rapprochement avec la liste d'`Armee.php` (`src/features/flood/attacks.ts`, son test et `__fixtures__/armee-attacks.html`) manque à la table. La feature réutilise aussi `combat-simulator/garrison.ts`, `combat-simulator/form.ts` et `resource-forecast/pages.ts`, sans que la doc le dise.
- **Ce qui est attendu** : compléter la table.
- **Touche aussi** : —

### flood-09 · Deux pages lues en arrière-plan à chaque formulaire d'attaque

- **Gravité** : suggestion
- **Catégorie** : code
- **Emplacement** : `src/features/flood/index.ts:30-52,80-89`
- **Ce qui se passe** : chaque ouverture de `ennemie.php?Attaquer=…` déclenche un GET d'`Armee.php` et un GET de `Membre.php`, plus `/api/exports/` (et `laboratoire.php` la première fois). C'est documenté et raisonnable, mais un joueur qui passe d'une cible à l'autre multiplie les requêtes.
- **Ce qui est attendu** : par exemple, garder la lecture d'`Armee.php` quelques dizaines de secondes.
- **Touche aussi** : —

## Questions ouvertes

### Q1 · Les règles du flood

- **Observation** : prise `min(fourmis, floor(20 %))`, portée de 50 % à 300 % revérifiée à l'arrivée, Vitesse d'attaque + 1 attaques simultanées. Le bandeau dit que ces règles ne sont pas vérifiées.
- **Hypothèses** : 1) elles sont justes (Toolzzz, tutoriel) ; 2) l'arrondi ou la portée diffèrent.
- **Comment trancher** : de vrais rapports de flood (issue #1), ou le site de Calystene.

### Q2 · Les chasses prennent-elles un créneau d'attaque ?

- **Observation** : les créneaux libres valent Vitesse d'attaque + 1, moins mes attaques notées et celles listées sur `Armee.php` (`mount.ts:121`). Les chasses en cours n'entrent pas dans ce compte.
- **Hypothèses** : 1) les chasses ont leur propre limite ; 2) elles occupent aussi un créneau d'attaque.
- **Comment trancher** : aide du jeu, ou Calystene.

### Q3 · « Remplir » et le recalcul du jeu

- **Observation** : `fillAttackForm` écrit `input.value` sans déclencher `onkeyup="lireEtReecrireChamps(...)"`, la fonction du jeu sur ces champs.
- **Hypothèses** : 1) le jeu relit les champs à l'envoi, donc aucun effet ; 2) un total ou une capacité affichés par le jeu restent faux après « Remplir ».
- **Comment trancher** : avec un compte qui a une armée, cliquer « Remplir » **sans valider** et regarder la page. Non testé ici, faute d’armée.

## Préparation au mode « moderne »

- **Facilite** : classes préfixées `optizzz-flood-*`, styles regroupés dans une constante `FLOOD_STYLE`.
- **Bloque** :
  - les couleurs (`rgb(215, 195, 132)`, `rgb(102, 88, 50)`, `rgb(201, 174, 99)`) sont en dur dans une chaîne JS (`mount.ts:10-21`), hors des fichiers CSS ;
  - la palette diffère des vues React (alliance-map-11) ;
  - la balise `<style>` est injectée dans le `<head>` du jeu, sans Shadow DOM : un thème moderne devra surcharger ces règles globales.

## Hors périmètre / non testé

- **Encart non vu en jeu** : sans armée, `ennemie.php?Attaquer=…` n'a pas de `#formulaireChoixArmee`, et `readAttackForm` renvoie `null` (`index.ts:74-78`). « Remplir », la zone de défense, la case Loge et le résumé n'ont donc pas pu être testés, et Q3 reste ouverte.
- **Envoi** : le formulaire n'a jamais été envoyé. Le suivi à l'envoi (`onAttackSent`, file de session) n'est vérifié que par le code et les tests.
- `Armee.php` : pas d'erreur console. La garnison (vide) est bien mémorisée, puisque les Cibles affichent la colonne « Flood max » à 0 (targets-02).
- « Plan de flood » coupé : la colonne « Flood max » disparaît des Cibles. Rallumé ensuite, et l'état initial (tout allumé) a été vérifié.
- Pas de rappel de la perte de protection débutant en cas d'attaque : voir targets-03, qui touche aussi cet encart.
