# Feature : Plan de flood

Décidé lors d'une session de cadrage (`/grill-me`) le 2026-10-08. Règles et sources : `../research/combat.md` ; page : `../research/fourmizzz-pages.md` (« ennemie.php »).

## But

Prendre le plus de TDC possible à une cible en plusieurs attaques (un flood), avec mon armée, et savoir sur quel joueur un flood rapporte le plus.

## Règles utilisées (non vérifiées sur un vrai flood)

- Une attaque gagnée prend `min(fourmis, floor(20 % de son TDC))`.
- La portée 50 % (inclus) – 300 % (exclu) est revérifiée à chaque arrivée, les deux TDC ayant bougé.
- Attaques simultanées : Vitesse d'attaque + 1.

L'encart les rappelle dans un bandeau, comme le simulateur de combat.

## Comportement

- **Calcul** (`src/game/flood.ts`) :
  - attaques de 20 % tant que la cible reste à portée pour la suivante ;
  - quand 20 % la ferait sortir et qu'il reste une attaque, la plus grosse prise qui la laisse à 50 % de mon TDC + 1 % de marge, puis une dernière de 20 % ;
  - jamais plus de fourmis que mon armée.
- **Défense** : inconnue, elle compte comme nulle. Collée (rapport ou « 300 Jeunes Soldates Naines, … »), la première attaque est la plus petite armée, des plus fortes aux plus faibles, qui gagne avec une riposte à 10 % au plus d'après le simulateur, pertes en infobulle ; ses survivants plafonnent sa prise. Si mon armée ne suffit pas, rien n'est proposé. Les niveaux de la cible étant inconnus, on prend les miens.
- **Unités** : sans défense, les moins chères d'abord (JSN), car toute fourmi prend 1 cm².
- **Sur le formulaire d'attaque** (`ennemie.php?Attaquer=<id>`), sous le formulaire du jeu :
  - le TDC de la cible lu sur son profil (`Membre.php`), sinon l'export ;
  - ses attaques possibles, le trajet et l'arrivée ;
  - un tableau N° | Armée | Prise | Son TDC après | Mon TDC après | « Remplir » ;
  - « Remplir » met les unités dans les champs du jeu, **les autres à 0** (le jeu pré-remplit toute l'armée), et vise le TDC. Le joueur valide lui-même ;
  - le total ;
  - la case « Compter les troupes de la Loge » (décochée, mémorisée par serveur) ;
  - la zone pour coller sa défense, mémorisée pour cette cible avec sa date, effaçable.
- **Suivi** : à l'envoi du formulaire par le joueur, l'attaque (cible, fourmis, prise prévue, arrivée) est notée tout de suite dans le `sessionStorage` de l'onglet (le jeu change de page aussitôt), puis versée au chargement suivant dans le stockage de l'extension. Sur le formulaire d'attaque (lecture d'`Armee.php` en arrière-plan) et à chaque passage sur `Armee.php`, ces attaques sont rapprochées de la liste « Attaque(s) en cours » du jeu, cible par cible, à l'arrivée la plus proche :
  - une attaque notée que le jeu ne liste plus a été **annulée** : oubliée ;
  - une attaque listée mais pas notée a été lancée sans le plan : elle prend un créneau, sa prise n'est pas comptée (l'encart le dit) ;
  - l'heure d'arrivée du jeu remplace celle estimée.
- **Cibles à portée** : colonne « Flood max », triable, d'après l'armée mémorisée sur `Armee.php` (Terrain + Dôme, + Loge si la case est cochée), les créneaux libres et les défenses collées.
- Interrupteur « Plan de flood » : coupé, rien sur le formulaire, pas de colonne, aucune lecture.

## Hors v1

Floods furtifs (tailles arrondies), antisonde, floods entre membres d'une chaîne (étape 9), recalage des règles sur de vrais rapports ([#1](https://github.com/Achaak/Optizzz/issues/1)).

## Code

| Fichier                                  | Rôle                                                                        |
| ---------------------------------------- | --------------------------------------------------------------------------- |
| `src/game/flood.ts` (+ test)             | Portée, plan des prises, première vague contre une défense, unités envoyées |
| `src/features/flood/page.ts` (+ test)    | Lecture et remplissage du formulaire d'attaque, envoi, TDC du profil        |
| `src/features/flood/store.ts` (+ test)   | Attaques en route, défenses collées, case Loge, file de session             |
| `src/features/flood/mount.ts` (+ test)   | L'encart sous le formulaire                                                 |
| `src/features/flood/index.ts`            | La feature (interrupteur `flood`), mémorise l'armée sur `Armee.php`         |
| `src/features/targets/mount.ts` (+ test) | Colonne « Flood max »                                                       |
| `src/features/flood/__fixtures__/*.html` | Formulaire d'attaque et profil relevés sur S2, effectifs et pseudos fictifs |
