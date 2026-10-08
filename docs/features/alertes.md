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

## 2. Notifications (à venir)

Permission `notifications` **optionnelle**, demandée quand le joueur coche une première case dans une section « Notifications » de la fenêtre Paramètres (réglages `sync:`, globaux). Si elle est refusée, la case se décoche avec un message. Types activables un par un, tous coupés par défaut :

- famine et entrepôt plein : une notification quand le délai passe sous 1 h, une seule fois par événement (clé : type et heure prévue arrondie à 15 min) ;
- chantier terminé et chasse rentrée : à l'heure de fin mémorisée par Heures de fin (jusqu'à 1 min de retard) ;
- rien pour ce qui a fini il y a plus de 15 min (navigateur fermé entre-temps) ;
- le serveur est nommé (« S5 : … ») ; un clic ouvre la page du jeu concernée ;
- pas d'attaque entrante.

## Code

| Fichier                                 | Rôle                                                        |
| --------------------------------------- | ----------------------------------------------------------- |
| `src/features/alerts/badge.ts` (+ test) | Texte, couleur et survol du badge à partir des données      |
| `src/features/alerts/store.ts` (+ test) | Stock par serveur, et tout ce que le background doit lire   |
| `src/features/alerts/index.ts`          | Feature du registre : mémorise le stock de chaque page      |
| `src/features/alerts/background.ts`     | Alarme, écoute du stockage, `action.setBadge*` / `setTitle` |
| `src/entrypoints/background.ts`         | Lance le badge                                              |
