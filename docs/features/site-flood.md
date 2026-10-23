# Outil du site : simulateur de flood

Décidé lors d'une session de cadrage (`/grill-me`) le 2026-10-23 (ticket 04). Socle commun : `site-outils.md`. Le Plan de flood de l'extension : `flood.md` ; règles : `../research/combat.md`, codées dans `packages/game/src/flood.ts` et `attack.ts`.

## Adresse

`/tools/flood`. État dans `#p=` : serveur et joueurs choisis (s'il y en a), les deux TDC, mon armée, Vitesse d'attaque, Armes, Bouclier, défense collée. Schéma dans `packages/game/src/site-links/` : l'extension le remplit aussi.

## Saisie

- **À la main** : mon TDC, le TDC de la cible, mon armée (par unité ou collée), ma Vitesse d'attaque (attaques simultanées : VA + 1), Armes et Bouclier (« Mes niveaux »). Cela suffit à calculer.
- **Ou par pseudo** : un serveur, puis l'attaquant et la cible (sélecteur de joueur du socle). Leurs TDC sont repris de la base du site (modifiables) ; le trajet et l'arrivée (« si vous lancez maintenant », heure de Paris) s'affichent.
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

## Doit

Marcher en clair, en sombre et sur téléphone.
