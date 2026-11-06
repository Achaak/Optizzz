# Feature : Timing à la seconde

Cadrée avec le joueur le 2026-11-04 (`/grilling`, chantier 30 du lot de novembre) ; recherche et mesures : `../research/timing-attaques.md`, dont la section « Cadrage » fixe les décisions reprises ici. Codée le 2026-11-04.

## But

Faire arriver une attaque à la 59e seconde d'une minute : le jeu règle ensemble, à la minute suivante, toutes les attaques arrivées dans une même minute, dans l'ordre de leur seconde d'arrivée. À :59, la sienne passe après les autres (utile dans une synchro).

## Règles du jeu respectées (`../research/reglement.md`, C2 et C3)

- **Le clic reste celui du joueur** : Optizzz ne clique jamais, n'envoie jamais le formulaire, ne grise ni n'active le bouton « Attaquer », n'ajoute aucun raccourci d'envoi. Entrée dans « Arrivée visée » ne fait rien (le champ est dans le formulaire du jeu : sans ça, Entrée enverrait l'attaque).
- Les requêtes ne lisent que le jeu (`HEAD` puis `GET` d'`Armee.php`), à l'ouverture du formulaire ou de la page suivante par le joueur ; rien ne part ailleurs que vers Fourmizzz.
- Rien d'équivalent au Compte+ : le trajet ne vient pas du Simulateur Durée.

## Comportement

- **Où** : sur le formulaire d'attaque (`ennemie.php?Attaquer=<id>`), un encart juste au-dessus du bouton « Attaquer », dans le formulaire du jeu. Indépendant du Plan de flood (encart sous le formulaire) : son propre interrupteur « Timing à la seconde », il marche Plan de flood coupé.
- **Heure du jeu** : 5 `HEAD /Armee.php` espacés de 230 ms à l'ouverture (`Armee.php` plutôt que le formulaire : relire le formulaire pourrait changer son jeton). Chaque en-tête `Date` dit dans quelle seconde était le serveur pendant l'aller-retour ; l'intersection donne l'écart serveur − PC (mesuré le 2026-11-04 sur S2 : + 98 ms à ± 137 ms près, allers-retours de 20 ms). Si les réponses se contredisent, l'écart est la moyenne des milieux d'aller-retour. « Heure du jeu : 11:05:09 » avance ensuite chaque seconde ; l'écart n'est écrit qu'au-delà d'1 s (« Votre horloge retarde de 3 s : le bloc en tient compte. »). Sans en-tête `Date` : « Heure du jeu illisible ».
- **Trajet** : « Temps de trajet » du profil de la cible quand il l'affiche (Compte+ ; relu avec le Plan de flood, une seule requête), sinon la formule d'Optizzz (`packages/game/src/travel.ts`) avec les coordonnées de l'export et la Vitesse d'attaque mémorisée. Quand le profil et la formule diffèrent : « Trajet du profil de X ; la formule d'Optizzz donne … ». Sans trajet, l'encart dit pourquoi et ne montre que l'heure du jeu.
- **Arrivée visée** : par défaut, la prochaine :59 dont le départ est à au moins 10 s ; une fois la fenêtre ratée, « Trop tard pour 9 h 39 min 59 s » reste 5 s et la cible passe à la minute suivante. Le champ « Arrivée visée » (« 23 h 40 », « 23h40 », « 23:40 ») choisit une minute, heure de Paris : la première :59 de cette minute dont le départ n'est pas passé (demain si besoin). Une minute écrite ratée reste affichée « Trop tard pour … ». Texte illisible : « Écrivez une heure, par exemple 23 h 40. » et retour à la prochaine :59.
- Ligne « Trajet : 15 h 09 min 08 s · arrivée visée : 23 h 39 min 59 s · départ : 8 h 30 min 51 s » (heure du jeu).
- **Compte à rebours**, en gros : « Cliquez dans 11 s » (« 2 min 05 s » au-delà d'une minute), en dixièmes sous 5 s (« 2,4 s »), puis « Cliquez maintenant » dans un cadre épais (texte et forme, pas la seule couleur, ADR 0003).
- **Fenêtre** : le serveur doit recevoir l'envoi dans la seconde de départ (arrivée − trajet). Le bloc vise le milieu de cette seconde, moins la moitié de l'aller-retour médian (le temps que l'envoi met à atteindre le jeu), ramené sur l'horloge du PC ; « Cliquez maintenant » dure 0,6 s centrée dessus.
- **Son** : case « Son », décochée par défaut, mémorisée par serveur. Trois bips courts à 3, 2 et 1 s du milieu de la fenêtre, un bip long au milieu (Web Audio, sans fichier ni permission). Un saut de plus d'une seconde (onglet remis au premier plan) ne rejoue pas les bips. Le navigateur ne joue le son qu'après un clic dans la page (cocher la case en est un). Le son ne déclenche rien.
- **« Pourquoi :59 ? »**, replié : la règle mesurée (ordre de la seconde d'arrivée dans le paquet d'une minute), l'inconnue (deux attaques de la même seconde) et le rappel qu'Optizzz n'envoie jamais l'attaque.

### Vérification après l'envoi

- À l'envoi du formulaire par le joueur, l'attaque est notée dans le `sessionStorage` de l'onglet (cible, arrivée visée, horloge mesurée, heure du clic) **si** une minute est écrite dans « Arrivée visée » ou si le clic tombe à moins de 3 s du milieu de la fenêtre (le joueur visait). Une attaque envoyée sans viser n'est pas suivie.
- Au chargement suivant d'`Armee.php` ou du formulaire d'attaque, s'il y a une attaque notée : **un** `GET /Armee.php`, retardé pour atteindre le serveur 200 ms après le début d'une seconde. Son en-tête `Date` et les `reste(N)` de la page comptent alors depuis la même seconde, et `Date + N` est l'arrivée exacte (lu de la même réponse, comme le décide la recherche ; le moment de la requête évite le cas, vu 2 fois sur 12, où le jeu calcule `N` dans la seconde suivante). Écart à la décision 6 du cadrage (« sans requête de plus ») : l'en-tête d'une page chargée par le navigateur n'est pas lisible par l'extension, d'où cette lecture.
- L'attaque listée vers la même cible dont l'arrivée est la plus proche de celle visée (10 min au plus) est retenue, avec son numéro (`attaque_<n>`), dans le stockage de l'extension. Une attaque notée que le jeu ne liste toujours pas 2 min après le clic (refusée, annulée) est oubliée.
- Sa ligne dans « Attaque(s) en cours » (Armée et formulaire d'attaque) dit alors « Arrivée à 23:39:59 ✓ :59 visé » ou « Arrivée à 23:40:00 ✗ une seconde trop tard » (texte et symbole) : dans la ligne d'« Attaques en cours » quand cette feature est allumée, sinon après le décompte du jeu. Gardé jusqu'à une heure après l'arrivée.

## Non vérifié

- Aucune attaque n'a été envoyée avec le bloc : la fenêtre « Cliquez maintenant » et la vérification après l'envoi ne sont vérifiées que par les tests et par les mesures de la recherche (trajets exacts, `Date + reste`).
- Le délai d'un clic jusqu'à l'arrivée de l'envoi au serveur est pris égal à un demi-aller-retour d'un `HEAD` ; un `POST` avec son formulaire peut être un peu plus lent.
- Le bloc mesure l'heure à l'ouverture du formulaire seulement : pour une synchro préparée des heures à l'avance, recharger la page peu avant le départ remesure l'écart.
- Firefox : le `HEAD` et la lecture de l'en-tête `Date` depuis le content script ne sont vérifiés que sur Chrome.

## Code

| Fichier                                                | Rôle                                                                                                                                                                           |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/game/src/timing.ts` (+ test)                 | Horloge du serveur d'après les `Date`, prochaine :59, minute écrite, fenêtre de clic, compte à rebours, bips, textes (heure du jeu, arrivée, écart, verdict), délai de lecture |
| `packages/game/src/pages/scores.ts` (+ test)           | `readProfileTravelTime` : « Temps de trajet » du profil (Compte+)                                                                                                              |
| `apps/extension/src/features/timing/clock.ts` (+ test) | Les 5 `HEAD`                                                                                                                                                                   |
| `apps/extension/src/features/timing/mount.ts` (+ test) | L'encart au-dessus du bouton « Attaquer »                                                                                                                                      |
| `apps/extension/src/features/timing/sent.ts` (+ test)  | Attaques notées, lecture d'`Armee.php` après l'envoi, verdict sur les lignes                                                                                                   |
| `apps/extension/src/features/timing/index.ts`          | La feature (interrupteur `timing`), trajet, son                                                                                                                                |
| `apps/extension/src/utils/on-way-list.ts`              | `id` d'une ligne (`data-optizzz-on-way`) : le verdict y trouve sa ligne                                                                                                        |
