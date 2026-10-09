# Revue : Alertes (`alerts`)

- Relecteur : sous-agent A
- Date : 2026-10-08
- Version : `package.json` 1.0.1, commit e228c3a (les notifications, annoncées non commitées, sont dans ce commit), build `chrome-mv3-dev` chargé dans Chrome
- Pages testées : fenêtre « Paramètres » d'Optizzz dans le jeu (onglets « Fonctionnalités » et « Notifications »), sur Armee.php et construction.php (S5)
- Doc lue : `docs/features/alertes.md` (+ `end-times.md`, `resource-forecast.md`, `PRIVACY.md`, `docs/store/fiche.md`)

## Résumé

Badge et survol fidèles à la doc, bien testés (`badge.test.ts`, `notifications.test.ts`, `store.test.ts`) ; la permission optionnelle est demandée proprement depuis une page de l'extension, et `PRIVACY.md` / la fiche sont à jour. Le défaut principal : les notifications dépendent en silence de l'option « Badge de l'icône » et de la feature « Heures de fin » ; sans elles, rien n'est jamais notifié. Quelques risques de notifications en double. En jeu, seul l'onglet « Notifications » des paramètres a pu être vu (les quatre cases cochées, permission déjà accordée, pas de message « bloquées ») : la popup et le badge ne sont pas accessibles à l'outil de test.

| Bloquant | Majeur | Mineur | Suggestion |
| -------- | ------ | ------ | ---------- |
| 0        | 1      | 6      | 2          |

## Constats

### alerts-01 · Badge coupé = plus aucune notification

- **Gravité** : majeur
- **Catégorie** : bug
- **Emplacement** : `src/features/alerts/index.ts:15` ; `src/features/alerts/background.ts:37-39` ; `src/features/alerts/store.ts:29-45`
- **Ce qui se passe** : le stock de chaque page n'est mémorisé que si l'option « Badge de l'icône » est active. Or les notifications partent de `loadServers()`, qui ne connaît que les serveurs de ce stock : badge coupé et « Notifications » active, la famine et l'entrepôt plein ne sont plus notifiés au bout de 24 h (stock périmé), et les notifications « Chantier terminé » / « Chasse rentrée » ne partent jamais pour un serveur jamais mémorisé (`ends` est construit à partir de `servers`). Rien ne l'indique au joueur ; la doc décrit bien le stockage « quand le badge est actif » mais pas la conséquence.
- **Ce qui est attendu** : mémoriser le stock dès que l'une des deux options est active (et lister les serveurs des notifications de fin à partir des sections d'Heures de fin, pas des stocks).
- **Capture** : —
- **Touche aussi** : end-times

### alerts-02 · Notifications de fin dépendantes des « Heures de fin », sans le dire

- **Gravité** : mineur
- **Catégorie** : UX
- **Emplacement** : `src/features/end-times/index.ts:29-31` (stocke seulement si la feature est active) ; `src/features/alerts/background.ts:37-39` ; `src/features/settings/notifications-section.ts:12-17`
- **Ce qui se passe** : « Chantier terminé » et « Chasse rentrée » lisent les sections mémorisées par Heures de fin. Si le joueur coupe Heures de fin, les sections ne sont plus mises à jour et ces cases restent cochées sans effet.
- **Ce qui est attendu** : stocker les sections indépendamment de l'affichage, ou signaler la dépendance dans l'onglet Notifications et dans « Fonctionnalités ».
- **Capture** : —
- **Touche aussi** : end-times, settings

### alerts-03 · Deux interrupteurs pour les notifications

- **Gravité** : mineur
- **Catégorie** : UX
- **Emplacement** : `src/features/catalog.ts` (option `alerts.notifications`) ; `src/features/settings/notifications-section.ts` ; `src/features/alerts/background.ts:32`
- **Ce qui se passe** : il faut à la fois l'option « Notifications » dans « Fonctionnalités » et une case dans l'onglet « Notifications ». L'option étant active par défaut et les cases décochées, ça marche au départ ; mais si le joueur coupe l'option, les cases restent modifiables et cochées sans effet, sans indication.
- **Ce qui est attendu** : griser l'onglet (ou afficher « Notifications coupées dans Fonctionnalités ») quand l'option ou la feature est coupée.
- **Capture** : —
- **Touche aussi** : settings

### alerts-04 · Notifications en double possibles (rafraîchissements concurrents)

- **Gravité** : mineur
- **Catégorie** : bug
- **Emplacement** : `src/features/alerts/background.ts:40-54, 64-68, 96-103`
- **Ce qui se passe** : `refresh()` part à chaque alarme, à chaque écriture de `local:alerts:stocks` (chaque page chargée, dans chaque onglet) et à chaque changement d'interrupteur, sans attendre le précédent. Deux `sendNotifications` concurrents lisent le même `sent`, calculent les mêmes notifications et les créent toutes deux (même id : Chrome remplace la notification, mais Firefox / le son peuvent la rejouer), puis la seconde écriture de `sent` écrase la première.
- **Ce qui est attendu** : sérialiser `update()` (une promesse en cours à la fois, comme `pendingWrite` ailleurs).
- **Capture** : —
- **Touche aussi** : —

### alerts-05 · Arrondi au quart d'heure : la même famine peut être notifiée deux fois

- **Gravité** : mineur
- **Catégorie** : bug
- **Emplacement** : `src/features/alerts/notifications.ts:49-50`
- **Ce qui se passe** : l'id d'un problème contient `Math.round(at / 15 min)`. Une prévision qui glisse de quelques secondes autour d'une frontière (17 h 07 min 29 s → 17 h 07 min 31 s) change d'id et la notification repart.
- **Ce qui est attendu** : dédoublonner par serveur + type sur une fenêtre (par ex. pas de nouvelle notification du même type tant que la précédente date de moins d'1 h ou que l'heure prévue a bougé de moins de 15 min).
- **Capture** : —
- **Touche aussi** : —

### alerts-06 · Onglet Notifications : permission inconnue au premier clic, état non rafraîchi

- **Gravité** : mineur
- **Catégorie** : UX
- **Emplacement** : `src/features/settings/notifications-section.ts:33, 64-69, 78-87`
- **Ce qui se passe** : 1) tant que le background n'a pas répondu (`permitted === null`), cocher une case n'ouvre pas la page d'autorisation ; 2) une fois la permission accordée dans l'autre onglet, « Notifications bloquées par le navigateur · Autoriser » reste affiché jusqu'à la réouverture des paramètres (aucune écoute de `permissions.onAdded`).
- **Ce qui est attendu** : attendre la réponse avant de décider, et réécouter la permission (ou revérifier au retour du focus).
- **Capture** : — (permission déjà accordée sur ce navigateur : état « bloquées » non reproductible sans la retirer)
- **Touche aussi** : settings

### alerts-07 · Notification « chantier terminé » pour un chantier annulé ailleurs

- **Gravité** : mineur
- **Catégorie** : bug
- **Emplacement** : `src/features/alerts/notifications.ts:69-81`
- **Ce qui se passe** : les fins viennent des sections mémorisées. Un chantier annulé depuis un autre appareil (téléphone) reste dans la section jusqu'à la prochaine lecture de construction.php ; la notification « chantier terminé » part quand même à l'heure prévue.
- **Ce qui est attendu** : accepté comme limite (à documenter), ou relire la section dont la lecture date de plus de N min avant d'annoncer… ce qui contredirait « sans interroger le jeu ». À trancher.
- **Capture** : —
- **Touche aussi** : end-times

### alerts-08 · Doc : tableau « Code » incomplet

- **Gravité** : suggestion
- **Catégorie** : doc
- **Emplacement** : `docs/features/alertes.md` (« Code »)
- **Ce qui se passe** : le tableau ne cite ni `notifications.ts` (+ test), ni `notification-settings.ts`, ni `permission.ts`, ni `src/entrypoints/notifications-permission/`, ni `src/entrypoints/popup/main.ts`, ni `src/features/settings/notifications-section.ts`.
- **Ce qui est attendu** : compléter.
- **Capture** : —
- **Touche aussi** : —

### alerts-09 · Couleurs codées en dur (badge, popup, page d'autorisation), sans test du background

- **Gravité** : suggestion
- **Catégorie** : code
- **Emplacement** : `src/features/alerts/background.ts:16-20` ; `src/entrypoints/popup/main.ts:8-12` ; `src/entrypoints/notifications-permission/main.ts:4-8` ; `src/features/settings/notifications-section.ts:4-10`
- **Ce qui se passe** : couleurs du badge différentes de celles des Prévisions pour le même niveau d'urgence (voir resource-forecast-03) ; fond `#efe0ad`, bordure `#a8894a` etc. répétés entre popup et page d'autorisation. `background.ts` (messages de permission, clic sur notification, alarme) n'a pas de test.
- **Ce qui est attendu** : tokens communs ; un test du routage des messages et de `openNotified` avec `fakeBrowser`.
- **Capture** : —
- **Touche aussi** : resource-forecast, settings

## Questions ouvertes

### Q1 · Seuils du badge (2 h / 12 h) contre ceux de l'en-tête (6 h / 24 h)

- **Observation** : voir resource-forecast-03. Le badge est peut-être volontairement plus discret (on ne veut pas d'orange permanent sur l'icône).
- **Comment trancher** : question au joueur, puis l'écrire dans les deux docs.

### Q2 · Notifications quand le navigateur dort

- **Observation** : l'alarme d'1 min réveille le service worker MV3 ; « jusqu'à 1 min de retard » dans la doc. Après une veille de l'ordinateur, les événements de plus de 15 min sont ignorés (voulu).
- **Comment trancher** : rien à trancher sauf avis contraire du joueur.

## Préparation au mode « moderne »

- **Facilite** : popup et paramètres en jeu partagent `settingsTabs` / `TABS_STYLE` (une seule source pour les onglets) ; logique du badge pure.
- **Bloque** : palette de la popup et de la page d'autorisation recopiée à la main ; couleurs du badge distinctes des couleurs d'urgence du jeu.

## Hors périmètre / non testé

- Popup de l'icône (`popup.html`) : l'outil de navigation réécrit les URL `chrome-extension://` en `https://` ; la popup n'a pas pu être ouverte dans un onglet. Non testée.
- Badge et survol de l'icône : pas lisibles depuis une page du jeu ; non testés en vrai, seulement par `badge.test.ts`.
- Notifications réelles : la permission est déjà accordée et les quatre cases sont cochées sur ce navigateur, mais aucun événement (famine, entrepôt plein sous 1 h, fin de chantier ou de chasse) n'est survenu pendant la revue ; aucune autorisation n'a été modifiée.
- Effet de la coupure du badge sur `local:alerts:stocks` (alerts-01) : stockage de l'extension non lisible depuis la page ; constat établi par le code.
- Petites largeurs : le redimensionnement de la fenêtre par l'outil n'a eu aucun effet ; non testé.
- Badge d'un second serveur : le compte n'est que sur S5.
