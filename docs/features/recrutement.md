# Feature : Recrutement

Décidé lors d'une session de cadrage (`/grill-me`) le 2026-11-20, avec `analyse-joueurs.md` et `analyse-alliances.md`.

## But

Trouver des joueurs à recruter pour son alliance : sans alliance, actifs, qui progressent vite et vivent près de l'alliance.

## Comportement

- **Où** : entrée « Recrutement » du menu d'alliance (`alliance-menu`), `alliance.php?Membres#recrutement` ; remplace le tableau des membres tant que le hash est `#recrutement`, comme la Progression et les Statistiques. Dans le jeu seulement. Sans alliance : pas d'entrée.
- **Qui** : joueurs sans alliance dans le dernier export, ni en vacances, ni bannis, ni inactifs probables (règle de `analyse-joueurs.md`). Les colonisés restent, avec leur maître : ce sont souvent les plus motivés pour rejoindre une alliance.
- **Colonnes** : pseudo (lien vers le profil), TDC, gain sur 7 j en %, distance au centre de l'alliance en cases, maître s'il est colonisé (et son alliance).
- **Centre de l'alliance** : la médiane des x et des y de ses membres (dernier export), insensible à un membre isolé.
- **Filtres** : TDC minimum, TDC maximum, distance maximum, mémorisés par serveur (`useStoredSettings`).
- **Tri** : gain sur 7 j en % décroissant par défaut ; triable sur toutes les colonnes. Les 50 premiers, puis « Voir plus (N restants) ».
- Données : export en cache et nuits de l'Historique. Gain inconnu (joueur trop récent) : « — », en bas.
- Rien n'est envoyé au joueur : le pseudo mène à son profil, où l'on écrit soi-même.

## Interrupteur

Feature « Recrutement » dans « Fonctionnalités », **coupée par défaut** (elle ne sert qu'aux chefs).

## Fichiers

| Fichier                                                   | Rôle                                                               |
| --------------------------------------------------------- | ------------------------------------------------------------------ |
| `packages/game/src/analysis/recruits.ts` (+ test)         | Liste, centre de l'alliance, filtres, tri                          |
| `apps/extension/src/features/recruitment/menu.ts`         | Entrée « Recrutement » du menu d'alliance, après « Partage »       |
| `apps/extension/src/features/recruitment/Recruitment.tsx` | La vue, montée par le script des Statistiques d'alliance           |
| `apps/extension/src/features/recruitment/settings.ts`     | Filtres mémorisés par serveur (`local:recruitment:<host>:filters`) |

## Ordre

Lot 4 (fait le 2026-11-20). Le gain sur 7 j vient de la nuit d'il y a 7 jours (8 nuits de l'Historique, aujourd'hui compris) ; une nuit manquante laisse le gain inconnu (« — »). Les inactifs probables sont ceux de `analyse-joueurs.md`, d'après les mêmes nuits. Le tri par défaut est le gain décroissant ; un clic sur un en-tête trie par cette colonne (Distance et Pseudo d'abord croissants).
