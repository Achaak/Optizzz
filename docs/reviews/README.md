# Revue complète des features — 2026-10-08

Revue de toutes les features d'Optizzz avant d'aller plus loin. Rien n'a été corrigé : ce document sert à décider quoi traiter.

- 17 rapports, un par feature ou sujet, sur le modèle de [`_template.md`](_template.md). Captures dans [`img/`](img/).
- Répartition :
  - A, base et ressources : work-queue, end-times, resource-forecast, alerts.
  - B, armée et combat : laying-planner, hunt-reports, combat-simulator, hunt-launcher.
  - C, alliance : alliance-map, tdc-chain, flood, targets, history.
  - D, transverse : convoy, settings, game (`src/game/` + game-levels), transverse-ui.
- Méthode : lecture de la doc, du code et des tests en parallèle, puis test en jeu sur S5, un relecteur à la fois dans son propre onglet Chrome.
- Lecture seule : aucune action de jeu, aucun formulaire envoyé. Les interrupteurs Optizzz et les réglages touchés ont été remis dans leur état initial.

## État de départ

Mesuré avant la revue, sur la version 1.0.1, commit `15560d1`, avec les notifications d'alertes encore non commitées. Elles ont été commitées pendant la revue en `e228c3a` ; les rapports citent ce commit. C'est le même code.

| Vérification        | Résultat                                       |
| ------------------- | ---------------------------------------------- |
| `pnpm build`        | ✅ (`.output/chrome-mv3/`, 3,47 Mo)            |
| `pnpm typecheck`    | ✅                                             |
| `pnpm lint`         | ✅ 0 erreur, 0 avertissement                   |
| `pnpm test`         | ✅ 72 fichiers, 495 tests                      |
| `pnpm format:check` | ✅                                             |
| Navigateur          | Chrome, extension chargée par `pnpm dev` (WXT) |
| Session de jeu      | S5 ouverte, compte Achak, avec Compte+         |

Ce compte a influencé ce qu'on a pu voir :

- Il a le Compte+, donc l'encart « Prochaines fins » n'apparaît pas.
- Il n'avait aucune armée en garnison au moment du test, donc pas de formulaire d'attaque et pas d'encart Plan de flood.
- Il n'y avait ni chantier, ni recherche, ni convoi en cours.

## Récapitulatif par feature

| Feature                                                   | Bloquant | Majeur |  Mineur | Suggestion |   Total |
| --------------------------------------------------------- | -------: | -----: | ------: | ---------: | ------: |
| [Chantiers en cours](work-queue.md)                       |        0 |      0 |       4 |          2 |       6 |
| [Heures de fin](end-times.md)                             |        0 |      0 |       5 |          5 |      10 |
| [Prévisions de ressources](resource-forecast.md)          |        0 |      0 |       8 |          3 |      11 |
| [Alertes](alerts.md)                                      |        0 |      1 |       6 |          2 |       9 |
| [Planificateur de ponte](laying-planner.md)               |        0 |      1 |       4 |          3 |       8 |
| [Rapports de chasse](hunt-reports.md)                     |        0 |      0 |       5 |          5 |      10 |
| [Simulateur de combat](combat-simulator.md)               |        0 |      1 |       5 |          4 |      10 |
| [Lanceur de chasse](hunt-launcher.md)                     |        0 |      2 |       8 |          4 |      14 |
| [Carte de l'alliance](alliance-map.md)                    |        0 |      3 |       9 |          6 |      18 |
| [Chaîne de TDC](tdc-chain.md)                             |        0 |      2 |      10 |          2 |      14 |
| [Plan de flood](flood.md)                                 |        0 |      1 |       6 |          2 |       9 |
| [Cibles à portée](targets.md)                             |        0 |      1 |       6 |          3 |      10 |
| [Historique de progression](history.md)                   |        0 |      1 |       5 |          6 |      12 |
| [Calculateur de convoi](convoy.md)                        |        0 |      0 |       5 |          3 |       8 |
| [Paramètres / Fonctionnalités](settings.md)               |        0 |      2 |       5 |          4 |      11 |
| [Règles du jeu (`src/game/`, game-levels)](game.md)       |        0 |      0 |       7 |          5 |      12 |
| [Cohérence visuelle et styles partagés](transverse-ui.md) |        0 |      1 |       8 |          3 |      12 |
| **Total**                                                 |    **0** | **16** | **106** |     **62** | **184** |

Aucun bloquant. Les 16 majeurs viennent de **11 causes distinctes**, car plusieurs rapports décrivent le même défaut :

- `alliance-map-01`, `tdc-chain-01`, `history-01` et `transverse-ui-12` : une seule cause.
- `alliance-map-02` et `tdc-chain-02` : une seule cause.
- `alerts-01` et `settings-01` : une seule cause.

## Constats transverses

Regroupés et dédoublonnés. Les identifiants renvoient aux rapports.

### 1. Interrupteurs : des dépendances cachées entre features

Couper une feature arrête aussi la collecte de données dont d'autres features ont besoin, sans que l'interface le dise. La cause est dans `run.ts:9` : une feature coupée ne s'exécute pas du tout.

- **Badge coupé** : plus de stock mémorisé, donc plus de notifications de famine ni d'entrepôt plein (`alerts-01` = `settings-01`, majeur).
- **« Heures de fin » coupée** : plus de notifications « chantier terminé » ni « chasse rentrée » (`alerts-02`, `settings-02`).
- **« Prévisions » coupée** : les revenus utilisés par le badge vieillissent, et le badge affiche « ? » au bout de 24 h (`settings-02`).
- **Deux interrupteurs qui se recouvrent** pour les notifications : l'option du catalogue et les cases de l'onglet Notifications. L'onglet ignore l'option (`alerts-03`, `settings-03`).
- **Lectures cachées** : le convoi et la ponte relisent `Ressources.php` en arrière-plan, ce que la doc ne dit pas (`convoy-05`).
- **La promesse de `feature-toggles.md`** (« aucune lecture de page » pour une feature coupée) est la source du problème (`settings` Q2).

### 2. Vues d'alliance (Carte, Chaîne, Historique)

- **Une vue ouverte ne se masque plus** :
  - Cause : WXT injecte `:host{all:initial !important}` dans chaque Shadow DOM, ce qui annule `shadowHost.style.display = "none"`.
  - Effet : les vues s'empilent, et la Chaîne commence 2 469 px plus bas. Elles restent aussi au-dessus du tableau Membres.
  - Le même mécanisme touche le lanceur de chasse et la fenêtre des paramètres.
  - Constats : `alliance-map-01`, `tdc-chain-01`, `history-01`, `transverse-ui-12`.
- **Lien `#carte` ou `#chaine` vers une vue coupée** : la page est vide, car `showsAllianceView` ne vérifie pas l'interrupteur (`alliance-map-02`, `tdc-chain-02`).
- **Code recopié dans les trois vues** :
  - trois constructeurs d'entrée de menu presque identiques ;
  - quatre écritures en stockage dans un updater de `setState` ;
  - trois façons d'écrire les titres ;
  - le même message obsolète « chaque nuit à minuit » ;
  - des erreurs brutes en anglais affichées au joueur.
  - Constats : `alliance-map-06`, `-10`, `-14`, `-15`, `tdc-chain-12`, `history-11`.

### 3. Règles du jeu dupliquées hors de `src/game/`

Contraire à `CLAUDE.md`, et déjà source de divergences.

| Règle                         | Copies                                                                                                              | Divergence constatée                                                |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Prise de 20 % du TDC          | `game/flood.ts:47,171`, `flood/mount.ts:231`, `targets/targets.ts:50`, `tdc-chain/chain.ts:6`, `army/battle.ts:143` | `flood-02` : la prise notée ignore la défense                       |
| Portée 50–300 % avec marge    | `game/flood.ts:32`, `tdc-chain/chain.ts:47`, `combat-simulator/CombatSimulator.tsx:192`                             | `tdc-chain-06` (marge ou pas), `combat-simulator-05` (300 % inclus) |
| Attaques simultanées = VA + 1 | `targets/index.ts:29`, `flood/mount.ts:121`                                                                         | + 1 ou + 2 ? (question G1)                                          |
| Algorithme de flood           | `game/flood.ts` contre `tdc-chain/chain.ts:54-77`                                                                   | `tdc-chain-05`                                                      |
| Distance                      | `game/travel.ts:13` contre `alliance-map/neighbors.ts:12`                                                           | —                                                                   |
| Récolte et taxe               | `resource-forecast/forecast.ts` contre `convoy/convoy.ts:90`                                                        | `convoy-03` : le convoi ignore la taxe                              |
| Moteur de prévision           | `resource-forecast/forecast.ts`, utilisé aussi par alerts et end-times                                              | `resource-forecast-09`                                              |
| Difficulté et durée de chasse | `hunt-launcher/engine/difficulty.ts`                                                                                | `game-06`                                                           |
| Bonus + 10 % par niveau       | 6 endroits dans `army/` + `CombatSimulator.tsx:94`                                                                  | `game-08`                                                           |
| Seuils de surpuissance        | `army/battle.ts:112` (`=`) contre `army/rounds.ts:23` (`>`)                                                         | `combat-simulator-04`                                               |

### 4. Briques partagées rangées dans les features

- **30 imports d'une feature vers une autre** (`transverse-ui-06`). Les fournisseurs :
  - `alliance-map/` : client de l'API, `pages`, `dates`, `travel` ;
  - `resource-forecast/` : `pages` et `income` ;
  - `work-queue/queue` ;
  - `game-levels` ;
  - `combat-simulator/garrison`.
- **La clé de cache `allianceMap:*:playersExport`** est lue par cinq features.
- **Lectures en double** :
  - la Vitesse d'attaque est lue par deux codes différents (`game-02`, `alliance-map-04`) ;
  - il existe deux parseurs du profil (`history-08`).
- **Utilitaires recopiés** : `toInteger` environ 10 fois, deux `formatDuration` (`transverse-ui-05`, `convoy-07`).
- **Pas de cache commun pour les pages relues en arrière-plan** :
  - Heures de fin : jusqu'à 5 `GET` ; les Prévisions en font 2 de plus.
  - Plan de flood : 2 pages par formulaire.
  - Historique : deux appels à la liste des versions.
  - `game-levels` relit la page à chaque appel.
  - Constats : `end-times-03`, `flood-09`, `history-09`, `game-01`.

### 5. Thème et styles : aucun socle commun

- **Couleurs** : 156 couleurs codées en dur (67 valeurs distinctes) dans 24 fichiers, et **aucune variable CSS de thème** (`transverse-ui-01`, majeur).
- **Police et tailles** : Verdana déclarée 8 fois, 14 tailles de police différentes.
- **Injection du style** : trois façons de faire, plus des styles en ligne (`transverse-ui-07`).
- **Deux familles visuelles** (`transverse-ui-10`, `alliance-map-11`, `history-04`, `hunt-launcher-10`) :
  - les encarts en DOM reprennent le jeu : Cibles, Convoi, simulateur de répartition ;
  - les vues React ont des panneaux crème arrondis, qui paraissent plaqués : Carte, Chaîne, Historique, Lanceur, encart « Progression ».
- **Couleurs d'urgence** : plusieurs rouges, oranges et verts pour un même état (`transverse-ui-02`). Les seuils diffèrent aussi : l'en-tête passe en rouge sous 6 h et en orange sous 24 h, le badge sous 2 h et 12 h (`resource-forecast-03`).
- **Icônes et contrôles** (`transverse-ui-08`, `combat-simulator-03`, `laying-planner-06`, `hunt-reports-08`) :
  - émojis et SVG au trait mélangés ;
  - « ⚔ » rendu comme « × » ;
  - boutons natifs en Arial à côté des contrôles du jeu.
- **Graphiques** : ECharts garde ses couleurs par défaut (`hunt-launcher-12`).

### 6. Formats et vocabulaire

- **Nombres** : espace simple dans `number-format.ts`, espace fine `Intl` dans la Carte. Distances avec un point (« 18.44 ») dans la Carte, avec une virgule (« 18,4 ») ailleurs (`transverse-ui-03`, `alliance-map-05`, `targets-06`).
- **Durées** : « 5 h 58 », « 5h 57m 35s » dans la Carte et la Chaîne, « 10H 1m 2s » dans le jeu (`transverse-ui-04`).
- **Heures** :
  - Optizzz écrit « 13 h 36 », à côté du « 13h36 » du jeu (`end-times` Q2).
  - Trois formats de date coexistent.
  - Le fuseau est tantôt celui du navigateur, tantôt Europe/Paris (question F1).
- **Tutoiement et vouvoiement** :
  - Tutoiement : hunt-launcher, tdc-chain, alliance-map, resource-forecast (`mount-costs.ts:32`).
  - Vouvoiement : le reste, comme le jeu.
  - Constats : `resource-forecast-04`, `hunt-launcher-04`, `flood-05`, `history-05`.
  - Il faudrait écrire la règle dans `CLAUDE.md`.
- **Vocabulaire** :
  - abréviations d'unités propres à Optizzz (Tu/TuE, alors que le jeu écrit T/TE), sans infobulle (`hunt-reports-02`) ;
  - « Promues » d'un côté, « XP » de l'autre (`hunt-reports-05`) ;
  - trois libellés pour un même chantier (`end-times-09`).

### 7. Erreurs et données manquantes passées sous silence

- **Niveau illisible** : il vaut 0 sans message, et les plans sont calculés avec ce 0 (`game-01`, `combat-simulator-06`, `hunt-launcher-05`). Seuls les Rapports de chasse préviennent.
- **Une requête qui échoue fait disparaître tout l'encart**, à cause d'un `Promise.all` (`flood-03`, `targets-05`, `convoy-01`).
- **Rien ne s'affiche, ou une erreur console** quand les revenus sont illisibles (`laying-planner-05`, `resource-forecast-07`).
- **États bloqués ou vides** :
  - « Lecture de ton armée… » sans fin quand l'armée est dehors (`hunt-launcher-03`) ;
  - « Flood max » à 0 partout quand l'armée est vide (`targets-02`) ;
  - une armée vide est mémorisée pendant une chasse (`combat-simulator-02`).

### 8. Données figées quand une page reste ouverte

Les calculs repartent de ce qui a été lu au chargement :

- le stock, pour la ponte (`laying-planner-04`) ;
- la fin d'un chantier, puisque le jeu ne recharge pas la page (`work-queue-02`) ;
- une recherche terminée (`game-09`) ;
- les niveaux saisis sur la Carte, que la Chaîne ne reçoit pas (`tdc-chain-04`).

Le planificateur de ponte n'écoute pas non plus le nouveau curseur du jeu (`laying-planner-01`).

### 9. Doublons avec le Compte+

Avec le Compte+, Optizzz répète des informations que le jeu affiche déjà :

- « fin aujourd'hui 13 h 36 » à côté de la colonne « Ponte finie » (`end-times-01`) ;
- « ⏳ Disponible dans 2 h 55 » à côté du « 2h 54m » du jeu, avec une minute d'écart (`resource-forecast-02`).

Constat d'ensemble : `transverse-ui-11`.

### 10. Champs de saisie

- **Lanceur de chasse** : les champs contrôlés sont réécrits pendant un recalcul asynchrone. Taper « 150 » a donné 2 300 cm² (`hunt-launcher-01`, majeur).
- **Champ vidé** : un champ de pourcentage vidé repasse aussitôt à 1 (`hunt-launcher-09`).
- **Pas de bornes** : les saisies de niveaux de la Carte ne sont pas bornées (`alliance-map-09`).
- **Encore à vérifier** : les autres vues React utilisent le même schéma de champ contrôlé.

### 11. Protection débutant

L'encart des Cibles propose « Attaquer » sur des centaines de lignes sans rappeler le message du jeu : attaquer fait perdre sa propre protection. Il affiche aussi « libre » pour des cibles proches dont la protection est inconnue (`targets-03`, `targets-04`). Le Plan de flood et la Chaîne sont concernés aussi (questions C3, C4).

### 12. Tests et doc

- **Vues sans test** :
  - `HuntLauncher.tsx`, `TdcChain.tsx` (617 lignes) ;
  - l'option du graphe de la Carte ;
  - le passage d'une vue d'alliance à l'autre ;
  - `laying-planner/index.ts` ;
  - la page du simulateur ;
  - `prey.ts`, `rounds.ts`.
  - Aucun test ne garantit qu'une entrée du catalogue a un consommateur.
  - Constats : `hunt-launcher-14`, `tdc-chain-14`, `alliance-map-16`, `laying-planner-08`, `combat-simulator-10`, `game-11`, `settings-08`.
- **Doc en retard sur le code**, dans 12 rapports : `work-queue-04`, `end-times-02`, `resource-forecast-05`, `alerts-08`, `hunt-launcher-07`, `alliance-map-07`, `tdc-chain-11`, `flood-08`, `targets-07`, `convoy-05`, `settings-06`, `settings-07`, `game-07`.
  - `settings.md` précède les onglets Notifications et Outils.
  - `feature-toggles.md` ne liste que 4 features sur 14.
  - Le lanceur annonce 2 000 tirages, le code en fait 1 000.

### Fausses pistes écartées en cours de revue

- **« Le premier clic sur la roue n'ouvre pas le panneau »** : c'est l'outil de test, dont les clics se perdent avant la première capture d'écran. Ce n'est pas Optizzz.
- **« Le bouton Optizzz déborde de la barre »** : l'écart venait de la différence d'échelle entre les px CSS et les captures réduites.
- **Erreur console `reading 'top'` dans la messagerie** : elle vient du jeu, et se reproduit avec la feature coupée.

## Questions ouvertes

Rien n'est tranché ici. Le détail, avec les hypothèses et la façon de trancher, est dans chaque rapport.

### Décisions produit (à trancher par le joueur)

| #   | Question                                                                                                            | Rapports                                                    |
| --- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| F1  | Heure du navigateur ou heure de Paris, partout ?                                                                    | work-queue Q3, end-times Q1, tdc-chain Q1, transverse-ui Q1 |
| F2  | « 13 h 36 » (Optizzz) ou « 13h36 » (jeu) ? Format des durées à garder ?                                             | end-times Q2                                                |
| F3  | Jusqu'où imiter le jeu ? Mode « classique » calqué sur le jeu, ou identité visuelle Optizzz propre ?                | transverse-ui Q2                                            |
| F4  | Seuils du badge (2 h / 12 h) et de l'en-tête (6 h / 24 h) : volontairement différents ?                             | alerts Q1, resource-forecast-03                             |
| F5  | Deux niveaux d'interrupteur pour les notifications : utile ou à simplifier ?                                        | settings Q1                                                 |
| F6  | Une feature coupée doit-elle encore collecter ses données locales (sans requête) pour les autres ?                  | settings Q2                                                 |
| F7  | Combats anciens rejoués avec les niveaux actuels : acceptable, ou à signaler ?                                      | hunt-reports Q2                                             |
| F8  | Historique : un point par jour, ou un point par heure pour les dernières 24 h ?                                     | history Q2                                                  |
| F9  | Coefficients du simulateur de Calystene recopiés dans `engine/calystene.ts` : faut-il l'accord de l'auteur ?        | hunt-launcher Q2                                            |
| F10 | Notifications quand l'ordinateur dort : le comportement actuel (événements de plus de 15 min ignorés) convient-il ? | alerts Q2                                                   |

### Règles du jeu (référence : site de Calystene, la page du jeu fait foi)

| #   | Question                                                                                                          | Rapports                 |
| --- | ----------------------------------------------------------------------------------------------------------------- | ------------------------ |
| G1  | Attaques simultanées : VA + 1 ou VA + 2 (Toolzzz) ?                                                               | game Q1                  |
| G2  | Prise de flood : `min(fourmis, floor(20 %))`, portée revérifiée à l'arrivée : exact ?                             | flood Q1                 |
| G3  | Les chasses occupent-elles un créneau d'attaque ?                                                                 | flood Q2                 |
| G4  | Surpuissance « 1,5 / 2 / 3 fois la vie » : seuil inclus ou strict ?                                               | combat-simulator Q1      |
| G5  | Gains d'une attaque de la Loge : colonie seule, ou TDC et pillage en plus ?                                       | combat-simulator Q2      |
| G6  | Les blessées « perdues » (règle de la demi-vie) existent-elles ?                                                  | hunt-reports Q1          |
| G7  | Temps de trajet : arrondi (`ceil` contre `floor`, 1 s d'écart) et écart de 4 % sur un relevé ancien               | alliance-map Q1, game Q2 |
| G8  | Statistiques et coûts des unités d'élite (CE, TkE) à jour ?                                                       | game Q3                  |
| G9  | Niveau affiché pendant une amélioration : actuel ou visé ?                                                        | game Q4                  |
| G10 | Facteurs ×1,6 (construction) et ×1,7 (recherche) de la barre de progression                                       | work-queue Q1            |
| G11 | Récolte taxée par paquet ou en continu ?                                                                          | resource-forecast Q1     |
| G12 | Embauche des ouvrières au retour d'une chasse                                                                     | resource-forecast Q2     |
| G13 | Nombre de places de la file Compte+                                                                               | resource-forecast Q3     |
| G14 | Entretien de la ponte : calculé sur le coût affiché ou sur le coût de base ?                                      | laying-planner Q1        |
| G15 | Les ouvrières parties en convoi comptent-elles dans « une ouvrière par cm² » ?                                    | laying-planner Q2        |
| G16 | Convoi : les ouvrières reviennent-elles ? (« récolte perdue pendant le trajet » le suppose, la recherche dit non) | convoy Q1                |
| G17 | Convoi : ordre de prise des ouvrières (sans travail d'abord, ou au prorata) ?                                     | convoy Q2                |
| G18 | « Combat » sur le profil = `trophyScore` de l'export ?                                                            | history Q1               |

### Comportement du jeu à observer (lecture seule, ou action faite par le joueur)

| #   | Question                                                                                                                     | Rapports         |
| --- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| C1  | Le lien « Annuler » recopié par Chantiers en cours garde-t-il la confirmation du jeu ? (DOM à lire pendant un chantier)      | work-queue Q2    |
| C2  | « Remplir » du Plan de flood : le jeu recalcule-t-il ses totaux sans `onkeyup` ? (à voir avec une armée, sans valider)       | flood Q3         |
| C3  | Peut-on attaquer un membre de son alliance sous protection débutant ? Un membre colonisé ?                                   | tdc-chain Q2, Q3 |
| C4  | Peut-on attaquer un joueur colonisé (lignes « Soumis à… ») ?                                                                 | targets Q1       |
| C5  | Guerre déclarée d'un seul côté : le jeu colore-t-il les deux sens ?                                                          | targets Q2       |
| C6  | Lanceur : une très longue chasse renvoie-t-elle la page de confirmation « chasse si longue » ? (réponse d'un vrai lancement) | hunt-launcher Q1 |
| C7  | Sens de l'axe y de la carte du jeu (`carte.php`) contre celui de la Carte d'alliance                                         | alliance-map Q2  |

## Top 10 des priorités

Classement par risque pour le joueur d'abord : une action de jeu faussée, puis une donnée fausse, puis une vue cassée. Viennent ensuite les chantiers de fond.

1. **Lanceur : la saisie de la surface est corrompue** (`hunt-launcher-01`). Taper « 150 » a donné une chasse de 2 300 cm², avec environ 1 900 pertes prévues et « Lancer » actif. C'est le seul défaut qui peut coûter une armée réelle. Il faut aussi vérifier le même schéma de champ contrôlé dans les autres vues React.
2. **Lanceur : après un lancement partiel, tout est à relancer** (`hunt-launcher-02`). Un réglage modifié replanifie avec l'armée et les créneaux d'avant, ce qui permet de lancer des chasses en trop. Même famille : l'encart bloqué sur « Lecture de ton armée… » (`hunt-launcher-03`).
3. **Vues d'alliance empilées** (`alliance-map-01`, `tdc-chain-01`, `history-01`, `transverse-ui-12`). Une seule cause, la règle `all:initial` de WXT contre `style.display`, et trois features cassées dès qu'on navigue dans le menu. À corriger en même temps : la page vide quand la vue est coupée (`alliance-map-02`, `tdc-chain-02`).
4. **Notifications qui s'éteignent en silence** (`alerts-01`/`settings-01`, `settings-02`, `alerts-02`, `alerts-03`). Il faut séparer la collecte des données de l'affichage, ou au moins montrer les dépendances dans « Fonctionnalités ». Décisions F5 et F6 avant de coder.
5. **Suivi des attaques de flood faussé** :
   - une attaque sur la Fourmilière ou la Loge est comptée comme une prise de TDC (`flood-01`) ;
   - « Flood max » ignore les attaques en route (`targets-01`) ;
   - la prise notée ignore la défense (`flood-02`).
     Ces trois défauts faussent tous les plans suivants. On les traite en même temps que l'étape 7.
6. **Planificateur de ponte sourd au nouveau curseur du jeu** (`laying-planner-01`), avec le recalcul qui repart du stock du chargement (`laying-planner-04`).
7. **Rassembler les règles du jeu dans `src/game/`** (constat transverse 3) : prise de 20 %, portée avec marge, VA + 1, algorithme de flood de la Chaîne, récolte du convoi, moteur de prévision. Trancher G1, G2 et G4 au passage. C'est ce qui évite que les étapes 5 et 9 réapparaissent.
8. **Niveaux illisibles à 0 sans message** (`game-01`, `combat-simulator-06`, `hunt-launcher-05`). Le lanceur et le simulateur calculent alors des plans faux sans prévenir. Même famille : les encarts qui disparaissent sans message après un `Promise.all` (`flood-03`, `targets-05`, `convoy-01`).
9. **Correctifs ponctuels à fort effet visible** :
   - changer de côté dans le simulateur efface l'armée adverse (`combat-simulator-01`) ;
   - les axes de la Carte n'ont pas la même échelle, d'où des distances faussées d'environ 23 % (`alliance-map-03`) ;
   - les départs de la Chaîne ne sont pas dans l'ordre chronologique (`tdc-chain-03`).
10. **Socle commun avant le mode « moderne »** :
    - jetons de thème en variables CSS, en partant de l'inventaire de `transverse-ui.md` ;
    - une seule couleur par état d'urgence ;
    - un module de formats (nombres, distances, durées, heures) ;
    - une règle de ton (vouvoiement) écrite dans `CLAUDE.md` ;
    - les briques partagées sorties des features (`api`, `pages`, `toInteger`).
      Décisions F1 à F3 avant de commencer.

## Limites de la revue

- **Firefox** : non testé, l'extension n'y était pas chargée.
- **Petites largeurs** : non testées en conditions réelles. `resize_window` n'a eu aucun effet (la fenêtre est restée à 1 728 px). Les simulations par CSS sont signalées comme telles dans les rapports et ne déclenchent pas les media queries.
- **Popup de l'icône, badge et page du simulateur de combat** : non ouvrables par l'outil (`chrome-extension://` réécrit en `https://`). Seulement relus dans le code.
- **Plan de flood** (pas d'armée), **« Prochaines fins »** (masqué par le Compte+), **lien « Annuler »** (aucun chantier en cours), **convois en cours** (aucun) : non vus en jeu.
- **`convoy-06`** : `commerce.php` est resté figé plus de 45 s au premier chargement, sans que ce soit reproduit ensuite. La liste de suggestions a 1 651 options. La cause n'est pas établie.

## Suivi des corrections (2026-10-08)

Rapports inchangés ci-dessus : ce suivi dit ce qui a été fait ensuite.

**Corrigé** : les constats sûrs de toutes les features (les 16 majeurs sauf flood-01, voir ci-dessous), la plupart des mineurs et des suggestions, la doc. Briques ajoutées : `NumberField`, `useStoredSettings`, `fetchGamePage`, `formatDecimal`, `parseGameInteger`, `alliance-menu`, `urgency`, `src/game/attack.ts`, la feature `collect`.

**Décisions prises avec le joueur** (appliquées) :

| Sujet                   | Décision                                                                    |
| ----------------------- | --------------------------------------------------------------------------- |
| Ton                     | Vouvoiement partout (règle dans `CLAUDE.md`)                                |
| Heures                  | Heure de Paris partout                                                      |
| Formats                 | Format Optizzz partout (« 13 h 36 », « 2 h 55 »), Carte et Chaîne comprises |
| Thème                   | Classique fidèle au jeu, variables CSS `src/theme/` (ADR 0002)              |
| Urgence                 | Une échelle : rouge < 6 h, orange < 24 h (en-tête, simulateur, badge)       |
| Collecte                | Séparée de l'affichage (feature `collect`)                                  |
| Structure               | `src/game/pages/`, `src/data/`, `src/game/forecast.ts`                      |
| Marge de 1 %            | Partout (tableau et rôles de la Chaîne, première vague du flood)            |
| Abréviations            | Celles du jeu à l'affichage (T / TE)                                        |
| Réserve du Lanceur      | Gardée à 0, rappel « toute l'armée » dans le bouton                         |
| « max » des ouvrières   | Plafonné au TDC                                                             |
| Retour des ouvrières    | Plus d'heure de fin dans le titre « Récoltes »                              |
| Temps de trajet         | Arrondi en dessous, comme le jeu sur les profils                            |
| Tables de Calystene     | Gardées, source citée (des mesures, pas du code)                            |
| Interrupteurs de notif. | Les deux niveaux gardés                                                     |

**Vérifié en jeu, revue corrigée** :

- G1 tranchée : **Vitesse d'attaque + 1** attaques à la fois (simulateur de flood du jeu : `joueur0VA = 4`, `joueur0attaquesDispo = 5`).
- **flood-01 était faux** : d'après l'aide du jeu, attaquer la Fourmilière ou la Loge, c'est d'abord attaquer le TDC. Une telle attaque prend donc bien du TDC ; le comportement d'origine était juste et a été rétabli.

**Non fait** : purge du cache de l'Historique (une version purgée serait retéléchargée à chaque « Tout ») ; « Tout charger » des Rapports de chasse (rafale de requêtes) ; mise en cache d'`Armee.php` pour le Plan de flood ; hauteur fixe de la fenêtre Paramètres.

**Questions encore ouvertes** : G2 à G18 sauf G1 et G7, C1 à C7, et F7 / F8 / F10 (inchangés).
