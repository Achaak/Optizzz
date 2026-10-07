# Feature : Calculateur de convoi

Décidé lors d'une session de cadrage (`/grill-me`) le 2026-10-07. Relevés de la page et du premier convoi : `../research/fourmizzz-pages.md` (« commerce.php »), `../research/temps-de-trajet.md`.

## But

Savoir, en préparant un convoi, quand il arrivera et ce qu'il coûte en ouvrières ; retrouver un destinataire sans chercher son pseudo ; voir l'heure d'arrivée des convois partis.

## Comportement

- **Où** : `commerce.php`, sous le formulaire du jeu (feature légère). Recalculé à chaque frappe et aux clics sur les titres qui remplissent le maximum.
- **Destinataire tapé** : « Osirus_jack à 3,2 cases · trajet ≈ 1 h 36 · arrivée ≈ aujourd'hui 22 h 07 », avec la Vitesse d'attaque mémorisée (`game-levels`, relue sur le Laboratoire si inconnue). Pseudo absent de l'export : « … n'est pas dans l'export d'hier ».
- **Ressources saisies** (nombres lus dans les champs cachés du jeu, donc « 2k » compris) : « 500 ouvrières, dont 200 au travail : ≈ 637 de récolte perdue pendant le trajet ». Ouvrières : le compte du jeu, sinon 10 ressources par ouvrière + 5 % par niveau d'étable à pucerons. Au travail = au-delà des ouvrières sans travail (total − récolteuses) ; une ouvrière au travail récolte 2 ressources par heure ; pas de trajet retour. Puis le rappel « Le surplus est perdu si ses entrepôts débordent. » (la place chez lui n'est pas publique).
- **Suggestions** sur le champ du destinataire (`datalist`) : ton alliance d'abord, puis les autres joueurs de l'export, chacun du plus proche au plus loin, avec l'alliance et la distance.
- **Convois en cours** : « · arrivée aujourd'hui 21 h 54 » après chaque ligne, d'après le temps écrit par le jeu. Ils entrent dans l'encart « Prochaines fins » (🐜 Convoi → X), `commerce.php` étant relu comme les autres pages.

## Code

| Fichier                                  | Rôle                                                           |
| ---------------------------------------- | -------------------------------------------------------------- |
| `src/game/travel.ts` (+ test)            | Temps de trajet et distance, partagés avec la carte d'alliance |
| `src/features/convoy/convoy.ts` (+ test) | Convois en cours, ouvrières nécessaires, plan, destinataires   |
| `src/features/convoy/mount.ts` (+ test)  | Affichage sous le formulaire, suggestions, heures d'arrivée    |
| `src/features/convoy/index.ts`           | La feature                                                     |
