# Outil du site : simulateur de flood

Décidé lors d'une session de cadrage (`/grill-me`) le 2026-10-23 (ticket 04). Socle commun : `site-outils.md`. Le Plan de flood de l'extension : `flood.md` ; règles : `../research/combat.md`, codées dans `packages/game/src/flood.ts` et `attack.ts`.

## Adresse

`/tools/flood`. État dans `#p=` : serveur et joueurs choisis (s'il y en a), les deux TDC, mon armée, Vitesse d'attaque, Armes, Bouclier, attaques déjà en route, défense collée. Schéma dans `packages/game/src/site-links/` : l'extension le remplit aussi.

## Saisie

- **À la main** : mon TDC, le TDC de la cible, mon armée (par unité ou collée), ma Vitesse d'attaque (attaques simultanées : VA + 1), Armes et Bouclier (« Mes niveaux »). Cela suffit à calculer. Armes et Bouclier ne sont demandés que contre une défense.
- **Attaques déjà en route** (0 par défaut) : chacune prend un créneau, comme dans l'extension. Ajouté au codage (2026-10-23) pour que le lien de l'extension donne la même suite d'attaques quand des attaques sont en route.
- **Ou par pseudo** : un serveur, puis l'attaquant et la cible (sélecteur de joueur du socle). Leurs TDC sont repris de la base du site au choix du joueur (modifiables) ; le trajet et l'arrivée (« si vous lancez maintenant », heure de Paris) s'affichent. Le sélecteur accepte aussi des positions (x, y), qui ne donnent que le trajet.
- **Défense de la cible**, facultative : collée (rapport ou liste), comme dans l'extension. Les niveaux de la cible étant inconnus, on prend les miens (une note le dit).

## Résultat

Comme le Plan de flood :

- un tableau N° | Armée | (Pertes) | Prise | Son TDC après | Mon TDC après, avec une ligne Total (prise cumulée, TDC finaux, nombre d'attaques) ; la colonne Pertes n'apparaît que contre une défense ;
- ce qui empêche le plan (hors de portée, trop juste, armée trop faible), encadré ;
- « Règles utilisées (non vérifiées sur un vrai flood) », replié.

## Retiré

« Remplir », suivi des attaques envoyées, attaques en route, anti-sondes, case Loge (l'armée est saisie telle qu'envoyée).

## Depuis l'extension

L'encart du Plan de flood (`ennemie.php`) a « Ouvrir sur optizzz.fr » et « Copier le lien » (`site-outils.md`) : les deux TDC, l'armée planifiée, les niveaux et la défense collée. Le site doit donner la même suite d'attaques.

Les TDC envoyés sont ceux que montre l'encart (après les attaques en route), l'armée celle que le plan envoie (Terrain et Dôme, Loge si la case est cochée, sans les anti-sondes), et le nombre d'attaques en route (celles du plan et celles lancées sans lui).

## Doit

Marcher en clair, en sombre et sur téléphone.

## Code

Fait le 2026-10-23 (ticket 11).

| Fichier                                                | Rôle                                                                                                                                         |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/game/src/flood.ts` (+ test)                  | `floodPlan` : le plan et ce qui l'empêche (`FloodBlock`), `floodBlockText`, `FLOOD_MARGIN` ; partagés par l'encart de l'extension et le site |
| `packages/game/src/site-links/flood.ts` (+ test)       | `floodLinkFormat` (état `#p=`, armées en tableaux dans l'ordre de `UNITS`) et `floodToolPlan` : le plan du site pour un état                 |
| `apps/web/src/app/tools/flood/page.tsx`                | La page                                                                                                                                      |
| `apps/web/src/components/tools/flood/flood-tool.tsx`   | L'outil : état, « Mes niveaux », joueurs, trajet                                                                                             |
| `apps/web/src/components/tools/flood/flood-form.tsx`   | TDC, niveaux, armée, défense collée                                                                                                          |
| `apps/web/src/components/tools/flood/flood-result.tsx` | Chiffres, ce qui empêche le plan, tableau et Total, règles                                                                                   |
