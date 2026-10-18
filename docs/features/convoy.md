# Feature : Calculateur de convoi

Décidé lors d'une session de cadrage (`/grill-me`) le 2026-10-07. Relevés de la page et du premier convoi : `../research/fourmizzz-pages.md` (« commerce.php »), `../research/temps-de-trajet.md`.

## But

Savoir, en préparant un convoi, quand il arrivera et ce qu'il coûte en ouvrières ; retrouver un destinataire sans chercher son pseudo ; voir l'heure d'arrivée des convois partis.

## Comportement

- **Où** : `commerce.php`, sous le formulaire du jeu (feature légère). Recalculé à chaque frappe et aux clics sur les titres qui remplissent le maximum.
- **Destinataire tapé** : « Messor à 3,2 cases · trajet ≈ 1 h 36 · arrivée ≈ aujourd'hui 22 h 07 », avec la Vitesse d'attaque mémorisée (`game-levels`, relue sur le Laboratoire si inconnue). Messages sans temps de trajet : destinataire absent de l'export (« … n'est pas dans l'export public (mis à jour chaque heure) »), moi-même absent (« Vous n'êtes pas encore dans l'export public… »), convoi vers soi (« C'est vous : choisissez un autre destinataire. »), export injoignable, niveaux illisibles (« Niveaux inconnus : passez par… »).
- **Ressources saisies** (nombres lus dans les champs cachés du jeu, donc « 2k » compris) : « 500 ouvrières, dont 200 au travail : ≈ 637 de récolte perdue pendant le trajet ». Ouvrières : le compte du jeu, sinon 10 ressources par ouvrière + 5 % par niveau d'étable à pucerons. Au travail = au-delà des ouvrières sans travail (total − récolteuses) ; une ouvrière au travail récolte comme le comptent les Prévisions de ressources (48 fois par jour, moins la taxe d'un colonisateur) ; pas de trajet retour. Puis le rappel « Le surplus est perdu si ses entrepôts débordent. » (la place chez lui n'est pas publique).
- **Suggestions** sur le champ du destinataire (`datalist`) : mon alliance d'abord, puis les 100 autres joueurs les plus proches (tout l'export faisait plus de 1 600 options), chacun du plus proche au plus loin, avec l'alliance et la distance. Tout pseudo de l'export peut quand même être tapé.
- **Total des ouvrières dans l'en-tête** (sous-option « Total des ouvrières, convois compris, dans l'en-tête », ajoutée le 2026-10-13) : sur toutes les pages, sous la ligne des ouvrières de la colonne de gauche, « Total 5 421 · 1 251 en convoi ». Le jeu retire du compteur les ouvrières qui portent un convoi et les rend à son arrivée (observation du joueur) : total = compteur de la page + ouvrières des convois envoyés encore en route au chargement. Ouvrières d'un convoi comptées d'après ses ressources (même calcul que ci-dessus, étable à pucerons mémorisée, sinon 10 par ouvrière : borne haute). Au survol : chaque convoi (ouvrières, destinataire, heure de retour), et les réserves (étable inconnue, convois lus il y a plus de 15 min). Rien quand aucun convoi n'est en route.
- **Convois en cours** (refaits le 2026-10-16) : les lignes du jeu laissent place à un encart, une ligne par convoi : « → destinataire » (lien du jeu), la charge (icônes du jeu, nombre et « nourriture » / « matériaux » écrits, pas seulement la couleur), un compte à rebours « dans 1H 22m 22s » au format du jeu (« arrivé » une fois là), « arrivée aujourd'hui 21 h 54 » et, avec Compte+, le « Retour le … » du jeu. Tant que le jeu propose « Annuler » (un temps après l'envoi), son lien passe dans la ligne du convoi, à côté de « Copier ». Un bouton « Copier » met le convoi en une ligne dans le presse-papiers, le temps restant compté au clic : « Vous allez livrer 0 nourriture et 350 000 matériaux à X dans 47m 21s · arrivée aujourd'hui 17 h 13 - Retour le 16 oct. à 17h13 ». Les lignes du jeu restent dans la page, masquées (relues telles quelles). Posé avant toute requête (une panne réseau ne l'empêche pas). Les convois reçus (ajoutés le 2026-10-18) suivent dans le même encart : « ← de X », leur charge, le compte à rebours et l'arrivée ; leur « Retour le » (l'arrivée, chez le jeu) n'est pas repris, et « Copier » donne « Vous allez recevoir … de X dans … · arrivée … ». Ils ne comptent pas dans le total des ouvrières de l'en-tête. Les convois entrent dans l'encart « Prochaines fins » (🐜 Convoi → X, Convoi ← X pour un convoi reçu), `commerce.php` étant relu comme les autres pages.

## Données

- Export public des joueurs (`/api/exports/`, mis à jour chaque heure, en cache par version).
- Vitesse d'attaque et étable à pucerons (`game-levels`) : `laboratoire.php` / `construction.php` relues en arrière-plan si inconnues ou lues il y a plus de 12 h.
- Convois en route (total de l'en-tête) : mémorisés par `collect` à chaque passage sur `commerce.php`, relus en arrière-plan s'ils ont plus de 15 min (un convoi a pu partir d'un autre appareil).
- Revenus (`Ressources.php`) : cache des Prévisions de ressources, relu en arrière-plan s'il a plus de 15 min, même si la feature Prévisions est coupée. Sans eux, toutes les ouvrières comptent comme au travail (borne haute de la récolte perdue).

## Code

| Fichier                                         | Rôle                                                               |
| ----------------------------------------------- | ------------------------------------------------------------------ |
| `src/game/travel.ts` (+ test)                   | Temps de trajet et distance, partagés avec la carte d'alliance     |
| `src/features/convoy/convoy.ts` (+ test)        | Convois en cours, message à copier, ouvrières, plan                |
| `src/features/convoy/mount.ts` (+ test)         | Affichage sous le formulaire, suggestions, liste des convois       |
| `src/features/convoy/mount-workers.ts` (+ test) | Total des ouvrières sous la ligne de l'en-tête                     |
| `src/features/convoy/index.ts`                  | Les features (calculateur, total de l'en-tête)                     |
| `src/data/convoys.ts` (+ test)                  | Convois en route mémorisés par serveur, relus en arrière-plan      |
| `src/utils/on-way-list.ts`                      | Liste partagée avec les attaques en cours (`attaques-en-cours.md`) |
