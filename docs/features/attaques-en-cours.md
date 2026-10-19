# Feature : Attaques en cours

Demandée le 2026-10-16, sur le modèle de la liste des convois en cours (`convoy.md`). Page : `../research/fourmizzz-pages.md` (« Armee.php »).

## But

Lire d'un coup d'œil les attaques parties, et pouvoir en coller une (Discord de l'alliance…) sans recopier à la main.

## Comportement

- **Où** : sous le titre « Attaque(s) en cours », sur `Armee.php` et sur le formulaire d'attaque (`ennemie.php?Attaquer=<id>`), où le jeu écrit la liste de la même façon (feature légère, interrupteur « Attaques en cours »).
- **Une ligne par attaque** : « → cible(TAG) » (liens du jeu), le lieu (« Terrain de chasse », « Fourmilière »…), les troupes avec Compte+ abrégées comme le jeu (« 1 488 JSN, 485 SN, 29 NE », le texte du jeu au survol ou s'il contient une unité inconnue), un compte à rebours « dans 3H 14m 54s » au format du jeu (« arrivé » une fois là) et « arrivée aujourd'hui 19 h 54 ».
- **« Annuler »** : tant que le jeu le propose (un temps après l'envoi), son lien passe dans la ligne de l'attaque, à côté de « Copier ».
- **Bouton « Copier »** : l'attaque telle que le jeu l'écrit, avec son décompte au moment du clic, puis la note Compte+ ligne par ligne : « Vous allez attaquer X(TAG) (Terrain de chasse) dans 3 heures 14 minutes 54 secondes », « Troupes en attaques : 4 047 Jeunes Soldates Naines. », « Arrivée à 19h54 ». Sans Compte+, la première ligne seule.
- Les lignes du jeu restent dans la page, repliées dans un bloc masqué : le Plan de flood, le partage d'alliance et le décompte du jeu les lisent comme avant.
- **Renforts** (2026-10-19) : les troupes qui rentrent d'une colonie (« Rappeler l'armée » ou « Libérer la colonie » sur `colonies.php`), que le jeu écrit « - Des renforts arrivent dans 42m 36s » sans cible ni troupes, ont leur ligne « ← Renforts · votre armée qui rentre (d'une colonie) », avec décompte et heure d'arrivée, à leur place parmi les attaques ; « Copier » donne la phrase du jeu. Avant, un joueur de S1 ne voyait plus son armée rentrer : la ligne était repliée avec ses floods.
- Une ligne du jeu qu'Optizzz ne lit pas reste visible, sous la liste, telle que le jeu l'écrit.
- Rien n'est chargé : tout vient de la page.

## Code

| Fichier                                         | Rôle                                                                  |
| ----------------------------------------------- | --------------------------------------------------------------------- |
| `src/features/flood/attacks.ts` (+ test)        | Lecture des attaques (`readAttackLines`), texte du jeu à copier       |
| `src/features/attacks-on-way/mount.ts` (+ test) | La liste à la place des lignes du jeu                                 |
| `src/features/attacks-on-way/index.ts`          | La feature                                                            |
| `src/utils/on-way-list.ts`                      | Liste partagée avec les convois : lignes, décompte, bouton « Copier » |
| `src/game/army/units.ts`                        | `readTroops` : troupes écrites par le jeu → effectifs par unité       |
