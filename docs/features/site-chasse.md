# Outil du site : simulateur de chasse

Décidé lors d'une session de cadrage (`/grill-me`) le 2026-10-23 (ticket 04). Socle commun : `site-outils.md`. Le Lanceur de chasse de l'extension : `hunt-launcher.md` ; mécaniques et sources (Calystene, cité) : `../research/chasse.md`.

## Adresse

`/tools/hunt`. État dans `#p=` : armée envoyée, niveaux, TDC au lancement et à l'arrivée, affichage, objectif, ratio, répartition, nombre et surface des chasses, chasses changées à la main. Schéma dans `packages/game/src/site-links/` : l'extension le remplit aussi.

## Partage avec l'extension

- Le moteur (`apps/extension/src/features/hunt-launcher/engine/` : difficulté, tirage, évaluation, Calystene, planificateur, extras, requêtes) et son worker passent dans **`packages/game/src/hunt/`**. Le worker s'écrit comme un module (`new Worker(new URL("./engine.worker.ts", import.meta.url), { type: "module" })`), compris par Vite (WXT) et Next ; repli en ligne si le worker est refusé, comme aujourd'hui.
- Le Lanceur de chasse s'en sert ; ses tests passent inchangés.
- La vue React est propre à chaque app.

## Comme dans l'extension

- Les deux affichages : **simple** (Prudent, Équilibré, Rapide ; « Faire monter mes troupes » ; chiffres clés ; tableau des chasses) et **avancé** (Vos données, Paramètres de chasse, Informations sur la chasse, Pertes selon le TdC à l'arrivée, tableau des chasses, Détails avec Calystene, promotions et courbe).
- Calcul dans le worker : la page ne fige pas pendant la recherche du plan.

## Changé

- **Saisie de l'armée** : par unité, ou collée (« 2 000 JSN, 300 SN »), comme dans le simulateur de combat. Pas de réserve mémorisée ni d'anti-sondes : on saisit l'armée envoyée.
- **Niveaux** : Armes, Bouclier, Vitesse de chasse, Étable à cochenilles, pré-remplis avec « Mes niveaux ». Niveau manquant : champ à remplir, jamais 0 supposé.
- **TDC** saisi (lancement et arrivée).
- **Vitesse de ponte** facultative : niveaux de Couveuse, Solarium et Technique de ponte (« Mes niveaux »). Sans eux, les pertes ne sont pas données en temps de ponte (colonne et chiffre masqués).
- **Retirés** : lancement des chasses, chasses en cours, « attendre le retour » (Compte+). « Retour souhaité » reste, compté depuis maintenant (heure de Paris).

## Depuis l'extension

Le Lanceur de chasse a « Ouvrir sur optizzz.fr » et « Copier le lien » (`site-outils.md`) : armée envoyée, niveaux, TDC et réglages. Le site doit donner le même plan.

## Doit

Marcher en clair, en sombre et sur téléphone.
