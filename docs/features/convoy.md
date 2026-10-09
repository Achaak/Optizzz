# Feature : Calculateur de convoi

Décidé lors d'une session de cadrage (`/grill-me`) le 2026-10-07. Relevés de la page et du premier convoi : `../research/fourmizzz-pages.md` (« commerce.php »), `../research/temps-de-trajet.md`.

## But

Savoir, en préparant un convoi, quand il arrivera et ce qu'il coûte en ouvrières ; retrouver un destinataire sans chercher son pseudo ; voir l'heure d'arrivée des convois partis.

## Comportement

- **Où** : `commerce.php`, sous le formulaire du jeu (feature légère). Recalculé à chaque frappe et aux clics sur les titres qui remplissent le maximum.
- **Destinataire tapé** : « Osirus_jack à 3,2 cases · trajet ≈ 1 h 36 · arrivée ≈ aujourd'hui 22 h 07 », avec la Vitesse d'attaque mémorisée (`game-levels`, relue sur le Laboratoire si inconnue). Messages sans temps de trajet : destinataire absent de l'export (« … n'est pas dans l'export public (mis à jour chaque heure) »), moi-même absent (« Vous n'êtes pas encore dans l'export public… »), convoi vers soi (« C'est vous : choisissez un autre destinataire. »), export injoignable, niveaux illisibles (« Niveaux inconnus : passez par… »).
- **Ressources saisies** (nombres lus dans les champs cachés du jeu, donc « 2k » compris) : « 500 ouvrières, dont 200 au travail : ≈ 637 de récolte perdue pendant le trajet ». Ouvrières : le compte du jeu, sinon 10 ressources par ouvrière + 5 % par niveau d'étable à pucerons. Au travail = au-delà des ouvrières sans travail (total − récolteuses) ; une ouvrière au travail récolte comme le comptent les Prévisions de ressources (48 fois par jour, moins la taxe d'un colonisateur) ; pas de trajet retour. Puis le rappel « Le surplus est perdu si ses entrepôts débordent. » (la place chez lui n'est pas publique).
- **Suggestions** sur le champ du destinataire (`datalist`) : mon alliance d'abord, puis les 100 autres joueurs les plus proches (tout l'export faisait plus de 1 600 options), chacun du plus proche au plus loin, avec l'alliance et la distance. Tout pseudo de l'export peut quand même être tapé.
- **Convois en cours** : « · arrivée aujourd'hui 21 h 54 » après chaque ligne, d'après le temps écrit par le jeu, posé avant toute requête (une panne réseau ne l'empêche pas). Ils entrent dans l'encart « Prochaines fins » (🐜 Convoi → X), `commerce.php` étant relu comme les autres pages.

## Données

- Export public des joueurs (`/api/exports/`, mis à jour chaque heure, en cache par version).
- Vitesse d'attaque et étable à pucerons (`game-levels`) : `laboratoire.php` / `construction.php` relues en arrière-plan si inconnues ou lues il y a plus de 12 h.
- Revenus (`Ressources.php`) : cache des Prévisions de ressources, relu en arrière-plan s'il a plus de 15 min, même si la feature Prévisions est coupée. Sans eux, toutes les ouvrières comptent comme au travail (borne haute de la récolte perdue).

## Code

| Fichier                                  | Rôle                                                           |
| ---------------------------------------- | -------------------------------------------------------------- |
| `src/game/travel.ts` (+ test)            | Temps de trajet et distance, partagés avec la carte d'alliance |
| `src/features/convoy/convoy.ts` (+ test) | Convois en cours, ouvrières nécessaires, plan, destinataires   |
| `src/features/convoy/mount.ts` (+ test)  | Affichage sous le formulaire, suggestions, heures d'arrivée    |
| `src/features/convoy/index.ts`           | La feature                                                     |
