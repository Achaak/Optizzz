# Revue : Logique de jeu partagée (`game`, avec `game-levels`)

- Relecteur : sous-agent D
- Date : 2026-10-08
- Version : `package.json` 1.0.1, commit e228c3a
- Pages testées : `laboratoire.php` (page) et `construction.php` (GET en arrière-plan) sur s5 ; recoupement du trajet dans `commerce.php` et `alliance.php?Membres#carte`
- Doc lue : `docs/research/combat.md`, `docs/research/chasse.md` (titres et règles), `docs/research/temps-de-trajet.md`, `docs/research/fourmizzz-pages.md` (commerce, ennemie, Armée), `docs/features/flood.md` (règles)
- Code : `src/game/` (`travel.ts`, `flood.ts`, `army/units.ts`, `army/prey.ts`, `army/battle.ts`, `army/combat.ts`, `army/rounds.ts`) et `src/features/game-levels/`

## Résumé

`src/game/` est bien tenu : règles commentées avec leur source, fonctions pures testées, et `UNITS` sert de référentiel unique à 10 features. Mais plusieurs règles du jeu sont encore recopiées dans les features : prise de 20 %, portée avec marge, attaques simultanées = VA + 1, distance, bonus +10 %/niveau, récolte. `game-levels` marche, mais un niveau illisible devient 0 sans prévenir, et la page est relue à chaque fois.

| Bloquant | Majeur | Mineur | Suggestion |
| -------- | ------ | ------ | ---------- |
| 0        | 0      | 7      | 5          |

## Constats

### game-01 · `game-levels` : un niveau illisible devient 0 en silence, et la page est relue à chaque appel

- **Gravité** : mineur
- **Catégorie** : bug
- **Emplacement** : `src/features/game-levels/levels.ts:75-89`
- **Ce qui se passe** : `loadLevelsOf` relit `laboratoire.php` ou `construction.php` pour toute clé encore `undefined`, sans vérifier `response.ok` (contrairement à `resource-forecast/income.ts:57` et `end-times/store.ts:41`). Si la page n'a pas la ligne (session expirée, page de maintenance, bâtiment ou recherche absent du tableau), rien n'est mémorisé : la clé reste `undefined`, elle **vaut 0** pour l'appelant et la page sera **relue au prochain appel**, sur chaque page qui en a besoin (convoi, cibles, flood, chaîne, simulateur, rapports, lanceur). Résultat : temps de trajet calculé avec VA 0, une seule attaque simultanée, combats sans Armes ni Bouclier, sans aucun signe à l'écran. Un `fetch` en erreur, lui, lance et fait échouer toute la feature appelante (voir convoy-01).
- **Vu en jeu** : sur s5, toutes les lignes lues existent, même au niveau 0 (« Dôme = niveau 0 », « Etable à pucerons = niveau 0 », « Vitesse d'attaque = niveau 4 »). La relecture à chaque appel ne se produit donc que sur une page illisible (session expirée, maintenance, page d'erreur), pas en temps normal.
- **Ce qui est attendu** : `response.ok` vérifié ; « inconnu » distinct de 0 pour l'appelant (`null`, ou un drapeau `estimated` comme dans la carte d'alliance) ; ne pas relire plus d'une fois par chargement (ou mémoriser « absent »).
- **Touche aussi** : convoy, targets, flood, tdc-chain, combat-simulator, hunt-reports, hunt-launcher

### game-02 · La Vitesse d'attaque est lue deux fois, par deux codes différents

- **Gravité** : mineur
- **Catégorie** : code
- **Emplacement** : `src/features/alliance-map/pages.ts:25-32` (`readAttackSpeedLevel`), `src/features/alliance-map/AllianceMap.tsx:19-22` (`fetchLabLevel`) ; à comparer avec `src/features/game-levels/levels.ts:17-39`
- **Ce qui se passe** : la carte d'alliance refait un GET de `laboratoire.php` à chaque ouverture et lit la VA avec son propre sélecteur (`.desciption_amelioration h2`), alors que `game-levels` la mémorise déjà (`.ligneAmelioration h2`). La chaîne de TDC, elle, passe par `loadLevelsOf` (`TdcChain.tsx:89`). Deux sélecteurs pour la même donnée : si le jeu change sa page, l'un des deux cassera sans que l'autre le signale.
- **Ce qui est attendu** : `loadLevelsOf(origin, ["attackSpeed"])` dans la carte, et suppression de `readAttackSpeedLevel`.
- **Touche aussi** : alliance-map

### game-03 · La prise de 20 % du TDC est écrite cinq fois

- **Gravité** : mineur
- **Catégorie** : code
- **Emplacement** : `src/game/flood.ts:47` et `:171` ; `src/features/targets/targets.ts:50` (`takeMax`) ; `src/features/tdc-chain/chain.ts:6` (`fullTake`) ; `src/features/flood/mount.ts:231`
- **Ce qui se passe** : `Math.floor(field * 0.2)` est recopié dans trois features en plus de `src/game/flood.ts`. Si la règle était précisée (prise sur fourmis envoyées ou survivantes, question ouverte de `combat.md`), il faudrait penser à cinq endroits.
- **Ce qui est attendu** : un `maxTake(field)` exporté de `src/game/flood.ts`.
- **Touche aussi** : targets, tdc-chain, flood

### game-04 · La portée avec marge est dupliquée dans la Chaîne de TDC

- **Gravité** : mineur
- **Catégorie** : code
- **Emplacement** : `src/features/tdc-chain/chain.ts:47-48` (`inRangeWithMargin`) ; `src/game/flood.ts:32-33` (`nextInRange`, non exporté)
- **Ce qui se passe** : même formule, copiée parce que la version de `src/game/` n'est pas exportée. Elle sert au calcul de la chaîne et à `planFlood`.
- **Ce qui est attendu** : exporter `inRange(attacker, target, margin = 0)` depuis `src/game/flood.ts`.
- **Touche aussi** : tdc-chain

### game-05 · « Attaques simultanées = VA + 1 » vit dans deux features

- **Gravité** : mineur
- **Catégorie** : code
- **Emplacement** : `src/features/targets/index.ts:29` ; `src/features/flood/mount.ts:121`
- **Ce qui se passe** : `attackSpeed + 1 − attaques en route` est calculé séparément par Cibles et par Flood. La règle n'est **pas vérifiée en jeu** (`combat.md`, voir Q1) : si elle change, les deux doivent bouger ensemble.
- **Ce qui est attendu** : `attackSlots(attackSpeed, onWay)` dans `src/game/flood.ts`.
- **Touche aussi** : targets, flood

### game-06 · Règles de jeu restées dans des features

- **Gravité** : mineur
- **Catégorie** : code
- **Emplacement** : `src/features/hunt-launcher/engine/difficulty.ts` (difficulté, paliers, durée de chasse `0,9^VC`) ; `src/features/resource-forecast/forecast.ts:22-23`, `:71-72` (récolte toutes les 30 min, taxe) ; `src/features/convoy/convoy.ts:48` (charge par ouvrière, étable à pucerons) et `:90` (récolte recopiée, voir convoy-03) ; `src/features/alliance-map/neighbors.ts:12-14` (`distance`, copie de `src/game/travel.ts:13`)
- **Ce qui se passe** : ces règles (documentées dans `docs/research/chasse.md`, `ressources-et-entretien.md`, `temps-de-trajet.md`) sont importées d'une feature à l'autre (`alerts`, `laying-planner`, `convoy` dépendent de `resource-forecast`) ou recopiées. C'est contraire au `CLAUDE.md` (« Les règles du jeu partagées par plusieurs features vivent dans `src/game/` »).
- **Ce qui est attendu** : `src/game/hunt.ts` (difficulté, durée), `src/game/economy.ts` (récolte, taxe, charge d'un convoi), et `distance` importée de `src/game/travel.ts` par la carte.
- **Touche aussi** : hunt-launcher, resource-forecast, convoy, alliance-map, alerts, laying-planner

### game-07 · Commentaire et tests de `travel.ts` en retard

- **Gravité** : mineur
- **Catégorie** : doc
- **Emplacement** : `src/game/travel.ts:1` ; `src/game/travel.test.ts` ; `docs/research/temps-de-trajet.md` (« À vérifier »)
- **Ce qui se passe** : le commentaire dit « Shared by the alliance map and the convoy calculator », mais `travelTime` sert aussi aux Cibles, au Flood et à la Chaîne. Le test ne contient que l'exemple de la doc ; la seule mesure en jeu (convoi Achak → Osirus_jack, écart d'environ 4 %) n'y est pas, même comme cas « connu faux ».
- **Ce qui est attendu** : commentaire à jour ; ajouter la mesure au test (avec une tolérance ou un `it.todo`) pour que l'écart reste visible.
- **Touche aussi** : —

### game-08 · Le bonus « +10 % par niveau » est réécrit partout

- **Gravité** : suggestion
- **Catégorie** : code
- **Emplacement** : `src/game/army/battle.ts:83-89`, `:113`, `:150` ; `src/game/army/combat.ts:21-22`, `:58-59` ; `src/game/army/units.ts:220` ; `src/features/combat-simulator/CombatSimulator.tsx:94-96` (recalcule `armyAttack` à la main)
- **Ce qui se passe** : `1 + 0.1 * niveau` apparaît une dizaine de fois, et le simulateur recalcule l'attaque d'une armée au lieu d'appeler `armyAttack`.
- **Ce qui est attendu** : `levelBonus(level)` dans `units.ts` et `armyAttack` réutilisée par le simulateur.
- **Touche aussi** : combat-simulator

### game-09 · `game-levels` ne remarque pas une recherche terminée

- **Gravité** : suggestion
- **Catégorie** : code
- **Emplacement** : `src/features/game-levels/levels.ts:43-51`, `:80-81`
- **Ce qui se passe** : un niveau mémorisé n'expire jamais. Il n'est corrigé qu'en repassant par Laboratoire ou Construction. Une VA ou des Armes montées pendant qu'on est ailleurs restent à l'ancien niveau dans le convoi, le flood, les cibles. Pourtant `work-queue` / `end-times` connaissent l'heure de fin des chantiers.
- **Ce qui est attendu** : invalider la clé quand un chantier mémorisé sur ce niveau est passé (ou mémoriser la date de lecture et relire au-delà d'un âge).
- **Touche aussi** : work-queue, end-times

### game-10 · Titres de lignes reconnus à l'orthographe exacte

- **Gravité** : suggestion
- **Catégorie** : code
- **Emplacement** : `src/features/game-levels/levels.ts:18-29`
- **Ce qui se passe** : `normalize` ne traite que l'apostrophe et la casse : « Etable à pucerons » doit s'écrire sans accent. C'est bien le cas aujourd'hui sur s5 (« Etable à pucerons », « Etable à cochenilles », mais « Dôme » et « Loge Impériale » accentués). Un « Étable » (autre serveur, correction du jeu) ne serait plus reconnu, et retomberait sur game-01 (0 silencieux). `unitKeyOf` (`units.ts:231`) a la même fragilité.
- **Ce qui est attendu** : retirer les diacritiques dans `normalize` (`normalize("NFD")` puis suppression des marques).
- **Touche aussi** : hunt-reports, combat-simulator

### game-11 · Fichiers de règles sans test propre

- **Gravité** : suggestion
- **Catégorie** : code
- **Emplacement** : `src/game/army/prey.ts` (valeur et nourriture des proies), `src/game/army/rounds.ts` ; `src/features/game-levels/levels.test.ts`
- **Ce qui se passe** : `prey.ts` et `rounds.ts` ne sont testés qu'à travers `battle` et `combat`. `levels.test.ts` ne couvre ni une réponse en erreur, ni une ligne absente, ni deux appels simultanés.
- **Ce qui est attendu** : un test de la table des proies (valeurs du Bestiaire) et des cas d'échec de `loadLevelsOf`.
- **Touche aussi** : —

### game-12 · `units.ts` se présente comme « vu par la chasse »

- **Gravité** : suggestion
- **Catégorie** : doc
- **Emplacement** : `src/game/army/units.ts:1-3`
- **Ce qui se passe** : le commentaire d'en-tête (« Ant units as a hunt sees them ») date d'avant le combat entre joueurs. `UNITS` sert maintenant au simulateur, au flood, à la ponte et aux cibles.
- **Ce qui est attendu** : un en-tête qui décrit le référentiel commun.
- **Touche aussi** : —

## Questions ouvertes

### Q1 · Nombre d'attaques simultanées : VA + 1 ou VA + 2 ?

- **Observation** : `docs/research/combat.md` écrit « Vitesse d'attaque + 1 », mais cite Toolzzz `Attaquer.js` : `niveau + 2 − lignes « Vous allez attaquer »`. Le code utilise + 1 (`targets/index.ts:29`, `flood/mount.ts:121`). « Non vérifié en jeu ».
- **Hypothèses** : 1) + 1, et Toolzzz compte une ligne de plus (en-tête) ; 2) + 2, et Optizzz sous-estime d'une attaque ; 3) le niveau affiché par Toolzzz est décalé d'un.
- **Comment trancher** : aide du jeu sur la Vitesse d'attaque (Laboratoire), formulaire d'attaque (nombre d'attaques permises affiché ?), site de Calystene.

### Q2 · Écart de 4 % sur le temps de trajet

- **Observation** : formule 1 h 35 min 32 s, jeu ≈ 1 h 39 pour d = 3,16 (`temps-de-trajet.md`). Par ailleurs, la distance affichée sur `ennemie.php` est arrondie à l'entier supérieur.
- **Hypothèses** : 1) heure de départ imprécise (minute seule) ; 2) le jeu calcule avec une autre constante ou un autre arrondi ; 3) le jeu arrondit la distance (non : d = 4 donnerait environ 2 h).
- **Comment trancher** : relever un temps restant affiché sur `Armee.php` ou `commerce.php` quand un mouvement est en cours, et le comparer à la formule ; ou `simulateurDuree.php` (le compte s5 a le Compte+, mais il faut soumettre son formulaire : à faire par le joueur).

### Q3 · Statistiques des unités d'élite

- **Observation** : `units.ts` reprend `combat.md` : Concierge d'élite 40/1/35, Tank 35 de vie (Calystene : 30, « ancien »), Tank d'élite 50/80/1. Les coûts en nourriture (CE 100, TkE 150) ne sont pas sourcés dans `combat.md`.
- **Hypothèses** : 1) valeurs à jour ; 2) une partie vient d'une version ancienne du jeu.
- **Comment trancher** : `http://alliancead2.free.fr/Scripts/Utilities_CArmy.js` (lecture seule) et la page Reine du jeu, qui fait foi.

### Q4 · Niveau affiché pendant une amélioration

- **Observation** : `readLevels` lit `.niveau_amelioration` sans savoir si un chantier est en cours sur la même ligne.
- **Hypothèses** : 1) le jeu affiche le niveau actuel jusqu'à la fin ; 2) il affiche le niveau visé.
- **Comment trancher** : Construction ou Laboratoire pendant un chantier (lecture seule).

## Préparation au mode « moderne »

- **Facilite** : `src/game/` ne contient aucun DOM ni style ; tout ce qui est affiché passe par les features.
- **Bloque** : sans objet.

## Recoupement en jeu

- Trajet Achak → Brosse (VA 4, lue sur le Laboratoire) : la carte affiche « 18.44 » et « 5h 57m 35s », le convoi « 18,4 cases · trajet ≈ 5 h 58 ». Les deux s'appuient bien sur `travelTime` (le convoi arrondit à la minute supérieure). Les formats diffèrent : voir transverse-ui-03 et 04.

## Hors périmètre / non testé

- Validation des formules de combat sur un vrai rapport d'attaque (issue #1) : demande une attaque, donc une action de jeu.
- Q2 : aucun mouvement en cours sur le compte (« Aucune attaque », « Aucun convoi »), donc aucun temps du jeu à comparer à la formule. Une mesure demanderait d'envoyer un mouvement, ce qui est une action de jeu.
- Q4 : aucune construction ni recherche en cours pendant la revue.
- Q1 et Q3 : l'aide du Laboratoire et le fichier `Utilities_CArmy.js` de Calystene n'ont pas été consultés pendant cette session de test. Ils restent la marche à suivre.
