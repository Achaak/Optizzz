# Outil du site : simulateur de combat

Décidé lors d'une session de cadrage (`/grill-me`) le 2026-10-23 (ticket 04). Socle commun : `site-outils.md`. Le simulateur de l'extension : `combat-simulator.md` ; règles : `../research/combat.md`.

## Adresse

`/tools/combat`. État dans `#p=` : les deux côtés (armées par lieu, niveaux, TDC, stocks) et le lieu visé. Schéma dans `packages/game/src/site-links/` : l'extension le remplit aussi.

## Partage avec l'extension

- La logique du formulaire (`apps/extension/src/features/combat-simulator/form.ts` : lecture d'une armée collée, d'un rapport, construction de l'entrée du moteur) passe dans `packages/game`, détachée du stockage de l'extension. L'extension s'en sert ; ses tests passent inchangés.
- Le moteur (`packages/game/src/army/battle.ts`, `rounds.ts`) est déjà partagé.
- La vue React est propre à chaque app (le site : shadcn/ui).

## Comme dans l'extension

- Saisie : attaquant (armée, Armes, Bouclier, TDC, Étable à pucerons) ; défenseur (armée par lieu, Armes, Bouclier, Dôme, Loge, TDC, nourriture, matériaux) ; lieu visé.
- Un rapport collé ou une liste « 300 Jeunes Soldates, 2 Tanks » remplit une armée ; les noms inconnus sont signalés.
- Résultat recalculé à chaque saisie : verdict et gains ; par lieu combattu : victoire ou défaite, riposte, pertes par unité des deux côtés, attaque nécessaire pour une riposte à 50 / 30 / 10 % ; avertissement hors portée.
- Bandeau permanent : règles non vérifiées sur un vrai combat entre joueurs.

## Changé

- Pas de pré-remplissage depuis le jeu, pas de « J'attaque / Je défends », pas de « Simuler » depuis un rapport.
- Bouton **« Échanger les côtés »**.
- « Mes niveaux » pré-remplit Armes, Bouclier (et Dôme, Loge, Étable à pucerons) d'un côté, au choix du visiteur (« Mes niveaux : attaquant / défenseur »).

## Depuis l'extension

Le simulateur de l'extension a « Ouvrir sur optizzz.fr » et « Copier le lien » (`site-outils.md`) : les deux côtés tels qu'ils sont saisis. Le site doit donner le même résultat.

## Doit

Marcher en clair, en sombre et sur téléphone (chaque côté défile horizontalement s'il le faut).
