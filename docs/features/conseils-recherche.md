# Feature : Conseils

Ajoutée le 2026-10-16 à la demande du joueur, d'après une autre extension qui affiche un conseil semblable sous Armes et Bouclier Thoracique. Seules l'idée et la méthode de comparaison en sont reprises.

## But

- Savoir, avant de lancer Armes ou Bouclier Thoracique, si le niveau suivant renforce plus l'armée que les unités que la Reine pondrait à la place.
- Savoir, avant de commander une construction (ou une recherche), s'il vaut mieux attendre le niveau suivant d'Architecture (ou de la Salle d'analyse) : demandé par le joueur le 2026-10-16.

Une entrée « Conseils » dans « Fonctionnalités », avec une option par conseil (`weapons-shield`, `architecture`, `analysis-room`).

## Armes et Bouclier Thoracique

- Une recherche coûte des **ouvrières** : les repondre prend `ouvrières × 60 s × vitesse de ponte`. Pendant ce temps, la Reine pourrait pondre des unités à la place : c'est à elles qu'on compare la recherche.
- **Gain de la recherche** : +10 % de la caractéristique de base de toute l'armée (vie pour Bouclier ; dégâts en attaque ou en défense pour Armes, au choix du joueur).
- **Gain d'une unité** : le nombre pondu dans ce temps (temps de base `tcaste` × vitesse, arrondi à l'unité inférieure) × sa caractéristique × le bonus actuel (`1 + 0,1 × niveau`).
- La meilleure unité **débloquée** (sur Reine.php : un champ de quantité et aucune exigence en `verificationNonOK` ; une unité verrouillée a pourtant un formulaire) sert de référence ; le détail compare toutes les unités.
- **Seuil** : la recherche l'emporte dès que la caractéristique de base de l'armée dépasse 10 × le gain de la meilleure unité.
- **Verdict** : « Recherche préférable » ou « Ponte préférable » avec l'écart (« +73 % de vie », « 3,5 × plus de défense » au-delà du triple), « se valent » à 5 % près. Le verdict est toujours écrit ; la couleur (vert pour la recherche, bleu pour la ponte : écart vérifié en protanopie et deutéranopie) ne fait que le doubler.
- Hors calcul, écrit dans la note : XP, bonus de Dôme et de Loge, nourriture et matériaux (la nourriture pour repondre les ouvrières est indiquée), perte de récolte pendant la ponte. Laboratoire et Reine travaillent en parallèle : la durée de la recherche ne compte pas.
- Recherche en cours sur la même ligne : le jeu montre déjà le coût du niveau d'après, le conseil part du niveau en file.

## Attendre Architecture ou la Salle d'analyse

- Chaque niveau multiplie le temps par 0,9 (voir `docs/research/fourmizzz-pages.md`, « Temps des chantiers »).
- On compare deux fins, le temps étant fixé à la commande :
  - **maintenant** : fin de la file de la page + temps affiché ;
  - **après** : plus tard de la fin de la file et de la fin du niveau d'accélération, + temps × 0,9.
- **Plusieurs niveaux** (demandé le 2026-10-16) : on essaie d'attendre les niveaux déjà en file, puis 1 à 10 niveaux de plus, enchaînés après la file de l'autre page. Chaque niveau dure 1,7 × (recherche) ou 1,6 × (bâtiment) le précédent et coûte le double ; il commence une fois les niveaux d'avant payés ensemble et le précédent fini. On garde le plan qui fait finir la ligne le plus tôt ; un niveau de plus qui fait gagner moins d'une minute n'est pas conseillé. Exemple S5 : la Champignonnière bâtit jusqu'à demain 3 h 57, Architecture 8, 9 et 10 (9 h 18) finissent avant, d'où « Architecture jusqu'au niveau 10 d'abord : fin 4 h 59 plus tôt ».
- Une file occupée rend l'attente gratuite : si la Champignonnière bâtit jusqu'à demain, Architecture 8 a le temps de finir avant.
- Ligne dans la description, **seulement quand attendre fait finir plus tôt** (plus d'une minute) : « Conseil · Architecture 8 d'abord : **fin 1 h 51 plus tôt** (demain 20 h 30 au lieu de demain 22 h 20) », ou « Attendez la fin d'Architecture 8 : … » quand elle est déjà en file. Revu le 2026-10-16 : les lignes « ne change rien » ou « retarderait » se répétaient sur presque toutes les lignes sans rien apprendre au joueur.
- Les deux fins partent du moment où la ligne peut commencer : payée (stock et revenus, comme « Disponible … » des Prévisions de ressources), puis sa file libre ; de même pour le niveau d'accélération. Revenus illisibles : comme si tout était payable maintenant.
- Non comptés : ce que le niveau d'accélération coûte (il retarde peut-être le paiement de la ligne), et le gain sur les chantiers suivants.
- Données : l'autre page (`laboratoire.php` depuis Construction, `construction.php` depuis le Laboratoire), relue en arrière-plan à chaque visite.

## Données (Armes et Bouclier)

- **Armée** : `Armee.php` relue en arrière-plan à chaque visite du Laboratoire (garnison des trois lieux et troupes des attaques en cours), et `Ressources.php` pour les troupes des chasses (requête partagée avec les Prévisions de ressources). Sans Compte+, le jeu n'écrit pas les troupes des sorties : la note dit combien ne sont pas comptées. `Armee.php` illisible : la garnison mémorisée (ou la dernière vue avec des unités), troupes sorties non comptées.
- **Vitesse de ponte et unités débloquées** : lues sur `Reine.php` (`temps_ponte_base*…` dans le script, formulaires de ponte), mémorisées par serveur par `collect` quand le joueur y passe, relues en arrière-plan si inconnues ou vieilles de plus de 12 h (Couveuse et Technique de ponte les changent).
- **Niveau et coût** : la ligne du Laboratoire elle-même.

## Affichage

- Un bloc dans la description de la ligne, comme le planificateur de ponte sur la Reine, replié sur son verdict ; déplié : deux barres (recherche, meilleure unité) avec leurs valeurs, le temps de ponte, le seuil, « Comparer les unités débloquées » (tableau), puis la note sur les hypothèses et l'âge des données. Déplié, les cellules de la ligne s'alignent en haut. D'abord une bande sous la ligne, hors de sa carte : déplacée le 2026-10-16 par cohérence avec les autres ajouts.
- Armes : « Comparer sur : l'attaque / la défense ». Le choix et l'état plié/déplié de chaque bande sont mémorisés par serveur.
- Donnée manquante : la bande dit quoi faire (« passez par la Reine »), sans deviner.

## Cohérence sur Construction et Laboratoire

- Tout ce qu'Optizzz ajoute dans la description d'une ligne suit le même ordre, quel que soit l'ordre de dessin (`src/utils/row-extras.ts`) : la ligne ⏳ des Prévisions de ressources, la ligne « Conseil » d'accélération, puis le bloc « Conseil » Armes / Bouclier.
- Les deux conseils commencent par la même étiquette « Conseil ». Les nombres du bloc ne se coupent pas en fin de ligne (espaces insécables).
- **Téléphone** (vu à 520 px, mise en page mobile du jeu) : les barres mettent libellé et valeur au-dessus de la barre, le tableau des unités défile dans son bloc, rien ne déborde de la page. Le tableau « Chantiers en cours » y masque « Temps restant » (« Fin » le dit) pour garder « Annuler » à l'écran.

## Code

| Fichier                                                                                     | Rôle                                                           |
| ------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `src/features/research-advice/advice.ts` (+ test)                                           | Comparaison recherche / ponte, seuil, verdict                  |
| `src/features/research-advice/army.ts` (+ test)                                             | Armée entière : garnison, attaques et chasses en cours         |
| `src/features/research-advice/mount.ts` (+ test)                                            | Bande sous la ligne : verdict, barres, tableau, note, réglages |
| `src/features/research-advice/index.ts`                                                     | La feature, chargement des données                             |
| `src/game/speed-up.ts` (+ test)                                                             | Fin maintenant ou après le niveau d'accélération               |
| `src/features/research-advice/speed-up-rows.ts`, `speed-up-mount.ts` (+ `speed-up.test.ts`) | Lignes, files, niveau d'accélération ; ligne de conseil        |
| `src/utils/row-extras.ts` (+ test)                                                          | Ordre des ajouts dans la description d'une ligne               |
| `src/data/laying.ts` (+ test)                                                               | Vitesse de ponte et unités débloquées, mémorisées par serveur  |
| `src/game/pages/queen.ts`                                                                   | Lecture de Reine.php (vitesse, unités débloquées)              |
