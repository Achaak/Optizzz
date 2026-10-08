# Feature : Alertes

Décidé lors d'une session de cadrage (`/grill-me`) le 2026-10-08. Voir aussi `roadmap.md`, `resource-forecast.md` et `end-times.md`.

## But

Voir sans ouvrir le jeu que la famine approche ou qu'un entrepôt va être plein, sur tous ses serveurs.

## 1. Badge de l'icône (option « Badge de l'icône »)

- Calculé par le background script à partir des données mémorisées, **sans jamais interroger le jeu**. Recalcul toutes les minutes (alarme `alarms`), et tout de suite quand une page mémorise un nouveau stock ou qu'un interrupteur change.
- Par serveur, le premier problème : famine, entrepôt de nourriture plein ou entrepôt de matériaux plein (`outlook()` des Prévisions de ressources), calculé à partir du moment où le stock a été lu.
- Le badge montre le pire serveur :
  - « 45m » en dessous d'1 h, « 1h40 » jusqu'à 2 h (rouge), « 5h » de 2 à 12 h (orange, heures arrondies vers le bas) ;
  - « ! » rouge si le problème est déjà arrivé ;
  - rien au-delà de 12 h ;
  - « ? » gris si aucun serveur n'a de problème sous 12 h et qu'au moins un a des données de plus de 24 h (stock ou revenus), ou n'a jamais eu sa page Ressources lue.
- Un serveur dont le stock a été lu il y a plus de 7 jours est oublié (ni badge, ni survol).
- Survol : « Optizzz » puis une ligne par serveur, dans cet ordre : problèmes sous 12 h (le plus proche d'abord), données périmées, problèmes plus lointains, rien de prévu (ou rien avant 30 j : au-delà, la prévision ne veut plus rien dire).

  ```
  Optizzz
  S5 : famine dans 1 h 40 (18 h 20)
  S3 : données d'il y a 2 j 2 h, ouvrez le jeu
  S4 : ouvrez la page Ressources
  S2 : entrepôt de matériaux plein dans 2 j 4 h (sam. 20 h 40)
  S1 : rien de prévu
  ```

  Un problème déjà arrivé : « S5 : famine depuis 16 h 20 ».

- Sans capacités connues (Construction jamais lue), pas d'alerte d'entrepôt plein, mais la famine reste calculée.

## Données

- **Stock** (`#data`) : mémorisé sur chaque page du jeu par la feature `alerts` quand le badge est actif, dans une seule clé pour tous les serveurs (`local:alerts:stocks`, par host), pour que le background sache quels serveurs lire.
- **Revenus et capacités** : ceux des Prévisions de ressources (`local:resourceForecast:<host>:income` / `:capacities`), lus tels quels (`loadStoredIncome`, `loadCapacities(origin, false)`).

## 2. Notifications (option « Notifications »)

- Onglet « Notifications » de la fenêtre Paramètres et de la popup : quatre cases, toutes décochées par défaut (`sync:alertNotifications`, global à tous les serveurs) :
  - **Famine dans moins d'1 h** et **Entrepôt plein dans moins d'1 h** : une fois par événement (clé : serveur, type, heure prévue arrondie à 15 min, pour qu'un léger glissement de la prévision ne la renvoie pas). Pas de notification sur des données de plus de 24 h ;
  - **Chantier terminé** (construction ou recherche) et **Chasse rentrée** : à l'heure de fin mémorisée par Heures de fin, avec jusqu'à 1 min de retard (l'alarme). Ni pontes ni convois ;
  - rien pour ce qui est arrivé il y a plus de 15 min (navigateur fermé entre-temps).
- Texte : « S5 : famine dans 52 min (17 h 32) », « S5 : chantier terminé · Couveuse 12 », « S5 : chasse rentrée · 183 cm² ». Un clic ouvre la page du jeu concernée (Ressources, Construction ou Laboratoire).
- Les notifications envoyées sont mémorisées 2 jours (`local:alerts:sentNotifications`, avec l'URL du clic).
- Pas d'attaque entrante.

### Permission `notifications` (optionnelle)

Un content script n'a pas l'API `permissions` : la fenêtre Paramètres demande au background si la permission est accordée (message `notifications-permitted`). Cocher une case sans la permission ouvre un onglet de l'extension (`notifications-permission.html`, message `grant-notifications`) avec un bouton « Autoriser les notifications » : seule une page de l'extension peut la demander, et seulement sur un clic. La popup ouvre aussi cet onglet plutôt que de demander elle-même : sur Firefox, la demande ferme la popup et sa réponse se perd. Tant qu'une case est cochée sans la permission, l'onglet affiche « Notifications bloquées par le navigateur · Autoriser ».

## Code

| Fichier                                 | Rôle                                                        |
| --------------------------------------- | ----------------------------------------------------------- |
| `src/features/alerts/badge.ts` (+ test) | Texte, couleur et survol du badge à partir des données      |
| `src/features/alerts/store.ts` (+ test) | Stock par serveur, et tout ce que le background doit lire   |
| `src/features/alerts/index.ts`          | Feature du registre : mémorise le stock de chaque page      |
| `src/features/alerts/background.ts`     | Alarme, écoute du stockage, `action.setBadge*` / `setTitle` |
| `src/entrypoints/background.ts`         | Lance le badge                                              |
