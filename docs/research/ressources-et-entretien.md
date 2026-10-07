# Ressources, entretien de l'armée et taxe de colonie

Relevé le 2026-10-07 sur S5 (compte avec Compte+) et sur s1 (compte colonisé, sans Compte+). Sélecteurs : `fourmizzz-pages.md`.

## Récolte

- Une ouvrière au travail rapporte **1 ressource toutes les 30 min**, soit 48 par jour (`calculProduction` de `Ressources.php` : ouvrières × 48 ; vérifié : 4 004 × 48 = 192 192).
- Au travail : min(TDC, ouvrières), une ouvrière par cm². Le reste ne récolte pas.
- La récolte arrive **par paquets**, toutes les 30 min, à une heure propre à chaque joueur (pas à :00/:30). Délai jusqu'au prochain paquet : `reste(<s>, "retour_ouvrieres")` sur `Ressources.php`.
- La champignonnière et la consommation de l'armée sont **continues** (`#nb_nourriture` est décimal).
- La ligne Compte+ « Temps pour récolter les matériaux manquants » (`construction.php`) compte en paquets : 8 892 manquants, 4 004 ouvrières → 3 paquets → 16 min (prochain paquet) + 2 × 30 min ≈ 1 h 18.

## Champignonnière

Production par jour, dans sa description sur `construction.php` (niveau actuel et suivant) et sur `Ressources.php`. 5 022/j au niveau 8, 8 538/j au niveau 9.

## Entretien de l'armée

Tutoriel attaque et défense : chaque jour, une unité consomme une part de son **coût en nourriture** (page Reine), répartie sur la journée :

| Emplacement                                  | Part par jour |
| -------------------------------------------- | ------------- |
| Dehors : terrain de chasse, chasse, attaque… | 5 %           |
| Fourmilière / Dôme                           | 10 %          |
| Loge                                         | 15 %          |

- Vérifié : 1 975 JSN × 16 × 5 % + 124 SN × 20 × 5 % = 1 704 = « votre armée consomme » de `Ressources.php`, alors que toute l'armée était en chasse. **Ce chiffre compte les troupes en déplacement.** Une chasse qui revient pose ses troupes sur le terrain de chasse (5 %) : la consommation ne bondit pas.
- Les ouvrières ne consomment rien.
- Coût en nourriture par unité (Reine, S5) : ouvrière 5, JSN 16, SN 20, NE 26, JS 30, S 36, C 70, A 30, AE 34, SE 44, Tk 100, T 80, TE 90.
- Sans nourriture, l'armée perd **0,5 % toutes les 30 min** (tutoriel ; non observé).

## Chasses

`Ressources.php` donne le gain de TDC (« vont conquérir 122 cm² ») et les secondes restantes. Au retour, des ouvrières jusque-là sans travail peuvent récolter (min(gain, ouvrières sans travail)). Avec Compte+, elles vont selon `choixOuvriere` ; sans, elles restent sans travail jusqu'à ce que le joueur les affecte (déduit du texte de l'encart Compte+).

## Taxe de colonie

- Tutoriel colonies : le colonisateur prend **20 % + 1 % par niveau de son étable à pucerons** de ce qui arrive chez le colonisé (récolte des ouvrières et champignonnière). Il ne touche rien des colonies du colonisé.
- `Ressources.php` du colonisé donne le taux directement : `var pourcentagePillage = 43;`, et la ligne « … vous pille `#nbNourritureMaitre` / `#nbMateriauxMaitre` ».
- Les chiffres « Chaque jour, vous récoltez… » sont **avant taxe** (vérifié : 6 360 × 48 = 305 280 = `#nbNourriture`). La taxe se calcule comme dans le script de la page :
  - nourriture : floor(taux × (récolte nourriture + champignonnière) / 100) ;
  - matériaux : floor(taux × récolte matériaux / 100) ;
  - la consommation de l'armée n'entre pas dans l'assiette.
- Net par jour : nourriture = récolte + champignonnière − taxe − armée ; matériaux = récolte − taxe. Aucun net n'est affiché par le jeu.
- Côté colonisateur : non relevé (aucune colonie sur les comptes vus).

## Durées des niveaux

D'après `bot-fourmizzz/research/development-cost-curves.md` : chaque niveau dure ×1,6 (construction) ou ×1,7 (recherche) de plus que le précédent ; Architecture et Salle d'analyse divisent par 0,9 par niveau. Les durées affichées incluent déjà ces bonus. **À vérifier** sur des valeurs réelles.

## À vérifier

- Taxe : la récolte est-elle taxée paquet par paquet (le forum le dit) ou en continu ?
- Nombre de places de la file d'attente Compte+.
- Page de confirmation de l'annulation d'un chantier.
