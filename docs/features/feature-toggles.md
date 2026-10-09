# Feature : Activer / désactiver les fonctionnalités

Décidé lors d'une session de cadrage (`/grill-me`) le 2026-10-07. Voir aussi `roadmap.md`.

## But

Laisser le joueur couper ce qu'il ne veut pas, feature par feature, et parfois plus finement.

## Comportement

- **Accès** : onglet « Fonctionnalités » dans la fenêtre Paramètres du jeu (le premier) et dans la popup de l'icône.
- **Une ligne par feature** : nom, phrase de description, case à cocher. Certaines ont des sous-options, en retrait sous elles. La liste, ses textes et ses sous-options sont dans `src/features/catalog.ts`, seule source de vérité (14 features, 9 sous-options le 2026-10-08) ; un test (`catalog.test.ts`) vérifie que chaque entrée et chaque sous-option est lue par le code.

- **Tout est activé par défaut.** Paramètres, `game-levels` (mémorise des niveaux) et `collect` (mémorise ce que montre la page), invisibles, ne sont pas dans la liste et restent toujours actives.
- **Feature coupée** : ses sous-options sont grisées et gardent leur état. Rien n'est injecté et aucune page n'est relue pour elle en arrière-plan. Ce que montre la page courante reste mémorisé (sans requête) par la feature `collect`, toujours active, tant qu'une autre feature allumée en a besoin : couper « Heures de fin » n'arrête pas les notifications de fin des Alertes, couper les « Prévisions » ne fait pas vieillir les revenus du badge. Un content script lourd (carte, chaîne, historique, lanceur de chasse) démarre quand même (son `matches` est dans le manifest), lit son interrupteur et s'arrête. Un lien vers une vue d'alliance coupée (`#carte`, `#chaine`, `#historique`) montre le tableau Membres du jeu.
- **Collecte** (`src/features/collect/`) : listes de fins (pour « Heures de fin » ou les notifications), revenus et capacités (Prévisions, Alertes, Ponte, Convoi), armée par lieu (Simulateur, Plan de flood). Rien n'est mémorisé quand aucune feature qui s'en sert n'est allumée.
- **Application** : au prochain chargement de page. Après un changement, la fenêtre du jeu propose « Recharger la page » ; la popup rappelle de recharger les pages du jeu.
- **Stockage** : un seul objet `sync:featureToggles`, global et synchronisé entre navigateurs. Exception assumée à la règle « clés préfixées par le host » : c'est une préférence du joueur, pas une donnée d'un serveur. Seules les valeurs `false` comptent ; une clé absente vaut « activé ».

## Code

| Fichier                                              | Rôle                                                                     |
| ---------------------------------------------------- | ------------------------------------------------------------------------ |
| `src/features/catalog.ts`                            | Liste des features et sous-options : id stable (clé de stockage), textes |
| `src/features/toggles.ts` (+ test)                   | Lecture / écriture des interrupteurs, règle feature → sous-option        |
| `src/features/settings/features-section.ts` (+ test) | Onglet « Fonctionnalités », partagé avec la popup                        |
| `src/features/catalog.test.ts`                       | Chaque entrée et sous-option du catalogue a un lecteur                   |

Une nouvelle feature visible ajoute son entrée dans `catalog.ts`. Une feature légère indique son entrée par `toggle` dans `Feature` ; le content script commun la saute si elle est coupée et passe les interrupteurs à `run` pour les sous-options. Un content script lourd appelle `isFeatureEnabled` au début de `main`.
