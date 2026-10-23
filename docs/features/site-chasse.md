# Outil du site : simulateur de chasse

Décidé lors d'une session de cadrage (`/grill-me`) le 2026-10-23 (ticket 04). Socle commun : `site-outils.md`. Le Lanceur de chasse de l'extension : `hunt-launcher.md` ; mécaniques et sources (Calystene, cité) : `../research/chasse.md`.

## Adresse

`/tools/hunt`. État dans `#p=` : armée envoyée, niveaux, TDC au lancement et à l'arrivée, affichage, objectif, ratio, répartition, nombre et surface des chasses, chasses changées à la main. Schéma dans `packages/game/src/site-links/` : l'extension le remplit aussi.

## Partage avec l'extension

- Le moteur (`apps/extension/src/features/hunt-launcher/engine/` : difficulté, tirage, évaluation, Calystene, planificateur, extras, requêtes) et son worker passent dans **`packages/game/src/hunt/`**. Le worker s'écrit comme un module (`new Worker(new URL("./engine.worker.ts", import.meta.url), { type: "module" })`), compris par Vite (WXT) et Next ; repli en ligne si le worker est refusé, comme aujourd'hui. Fait le 2026-10-23 : chaque app donne à `createEngine` la façon de lancer le worker. Le site prend le worker module (`hunt/module-worker.ts`) ; le Lanceur garde le même fichier inliné (`?worker&inline`), car dans un content script l'adresse du worker module pointe sur le domaine du jeu (vérifié au build : `new URL("/assets/engine.worker-….js", self.location.href)`), le worker n'y chargerait pas et tout tournerait en ligne, page figée.
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

## Décidé au codage (2026-10-23, ticket 10)

- **Chasses déjà en cours** (affichage avancé, 0 par défaut) : les créneaux libres sont Vitesse de chasse + 1 moins ce nombre, comme dans le Lanceur. Sans lui, un lien ouvert depuis le Lanceur alors que des chasses sont en cours chercherait un plan sur plus de créneaux, donc un autre plan. Ce n'est qu'un nombre : la liste des chasses en cours reste retirée.
- **TdC à l'arrivée** vide : celui du lancement.
- **Vitesse de ponte depuis l'extension** : le Lanceur ne connaît que la vitesse lue sur la Reine, pas les trois niveaux ; son lien laisse donc Couveuse, Solarium et Technique de ponte vides. Le plan n'en dépend pas.
- **Colonnes en plus** et parties repliées : propres au navigateur, hors de l'adresse.
- Les textes du Lanceur (`view.ts`) passent dans `packages/game/src/hunt/texts.ts`, partagés.

## Code

| Fichier                                                                                                                                 | Rôle                                                                                                                                                                   |
| --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/game/src/hunt/` (+ tests)                                                                                                     | Le moteur, partagé avec le Lanceur ; `module-worker.ts` lance le worker module du site                                                                                 |
| `packages/game/src/hunt/hunt-form.ts` (+ test)                                                                                          | Les entrées de l'outil (`HuntForm`) et la requête au moteur qu'elles donnent (`planInput`), la même pour le site et le Lanceur ; chasses changées à la main enchaînées |
| `packages/game/src/hunt/texts.ts` (+ test)                                                                                              | Textes partagés (préréglages, découpage, ratios, retour souhaité…)                                                                                                     |
| `packages/game/src/site-links/hunt.ts` (+ test)                                                                                         | État dans `#p=` (version 1) : armée dans l'ordre de `UNITS`, niveaux, TdC, réglages, chasses changées à la main, affichage ; rempli aussi par le Lanceur               |
| `apps/web/src/app/tools/hunt/page.tsx`                                                                                                  | La page                                                                                                                                                                |
| `apps/web/src/components/tools/hunt/hunt-tool.tsx`                                                                                      | État, actions, affichages simple et avancé                                                                                                                             |
| `use-hunt-plan.ts`                                                                                                                      | Le plan, les extras, la liste des ratios et les chasses changées, demandés au worker après une pause                                                                   |
| `hunt-entries.tsx`, `hunt-simple.tsx`, `hunt-parameters.tsx`, `hunt-result.tsx`, `hunt-table.tsx`, `hunt-details.tsx`, `hunt-parts.tsx` | Vos données ; affichage simple ; Paramètres ; Informations et pertes selon le TdC ; chasses ; Détails et courbe (Recharts) ; petites briques                           |
| `hunt-settings.ts` (+ test)                                                                                                             | « Mes niveaux » (Armes, Bouclier, Vitesse de chasse, Étable à cochenilles, Couveuse, Solarium, Technique de ponte), réglages avancés en cours, chasse changée          |
