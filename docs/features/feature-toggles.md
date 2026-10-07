# Feature : Activer / désactiver les fonctionnalités

Décidé lors d'une session de cadrage (`/grill-me`) le 2026-10-07. Voir aussi `roadmap.md`.

## But

Laisser le joueur couper ce qu'il ne veut pas, feature par feature, et parfois plus finement.

## Comportement

- **Accès** : onglet « Fonctionnalités » dans la fenêtre Paramètres du jeu (le premier) et dans la popup de l'icône.
- **Une ligne par feature** : nom, phrase de description, case à cocher. Certaines ont des sous-options, en retrait sous elles :

| Feature                  | Sous-options                                                                                                 |
| ------------------------ | ------------------------------------------------------------------------------------------------------------ |
| Chantiers en cours       | —                                                                                                            |
| Prévisions de ressources | Délais sur Construction et Laboratoire · Famine et entrepôt plein dans l'en-tête · Simulation sur Ressources |
| Carte de l'alliance      | —                                                                                                            |
| Lanceur de chasse        | —                                                                                                            |

- **Tout est activé par défaut.** Paramètres et `game-levels` (mémorise des niveaux, invisible) ne sont pas dans la liste et restent toujours actives.
- **Feature coupée** : ses sous-options sont grisées et gardent leur état. Rien n'est injecté, aucune requête, aucune lecture de page. Un content script lourd (carte, chasse) démarre quand même (son `matches` est dans le manifest), lit son interrupteur et s'arrête.
- **Application** : au prochain chargement de page. Après un changement, la fenêtre du jeu propose « Recharger la page » ; la popup rappelle de recharger les pages du jeu.
- **Stockage** : un seul objet `sync:featureToggles`, global et synchronisé entre navigateurs. Exception assumée à la règle « clés préfixées par le host » : c'est une préférence du joueur, pas une donnée d'un serveur. Seules les valeurs `false` comptent ; une clé absente vaut « activé ».

## Code

| Fichier                                              | Rôle                                                                     |
| ---------------------------------------------------- | ------------------------------------------------------------------------ |
| `src/features/catalog.ts`                            | Liste des features et sous-options : id stable (clé de stockage), textes |
| `src/features/toggles.ts` (+ test)                   | Lecture / écriture des interrupteurs, règle feature → sous-option        |
| `src/features/settings/features-section.ts` (+ test) | Onglet « Fonctionnalités », partagé avec la popup                        |

Une nouvelle feature visible ajoute son entrée dans `catalog.ts`. Une feature légère indique son entrée par `toggle` dans `Feature` ; le content script commun la saute si elle est coupée et passe les interrupteurs à `run` pour les sous-options. Un content script lourd appelle `isFeatureEnabled` au début de `main`.
