# Timing d'une attaque à la seconde

Recherche du chantier 30 (lot de novembre 2026), menée le 2026-11-04 (nuit du 3 au 4, heure de Paris) sur S5 et S2, d'abord **en lecture seule** (`GET` des pages du jeu), puis avec cinq petites attaques de test sur S2, lancées par Claude avec l'accord du joueur (16 JSN en tout, sur deux joueurs à portée). Heures relevées dans l'en-tête HTTP `Date`, en UTC (Paris = UTC + 1 en novembre).

## En bref

| Question                                       | Réponse                                                                                                                                                                                                                                                                                                         | Statut                    |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| Le jeu montre-t-il l'heure du serveur ?        | Non, aucune horloge dans les pages. Seuls l'en-tête HTTP `Date` (à la seconde) et les décomptes `reste(<secondes>)` la donnent.                                                                                                                                                                                 | Confirmé                  |
| L'heure du serveur et celle du PC concordent ? | Sur le PC du joueur, à ± 0,4 s près (10 requêtes). Un autre PC peut dériver de plusieurs secondes : il faut mesurer l'écart.                                                                                                                                                                                    | Confirmé (une mesure)     |
| Un trajet est-il arrondi à la seconde ?        | Oui : durées et fins sont des secondes entières (profil, `reste()`, en-tête `Date`).                                                                                                                                                                                                                            | Confirmé                  |
| « Arrivée à 19h54 » arrondit-il ?              | Tronqué à la minute (« Retour le … à 00h52 » pour une arrivée à 00:52:38).                                                                                                                                                                                                                                      | Confirmé sur les convois  |
| Un convoi arrive-t-il à sa seconde ?           | **Non** : il est traité **après la fin de sa minute** (convoi dû à 00:52:38, encore listé à 00:52:55, livré entre 00:52:55 et 00:53:17, message « Convoi livré » daté 00h53).                                                                                                                                   | Confirmé (une mesure)     |
| Une attaque est-elle réglée à sa seconde ?     | **Non** : elle quitte « Attaque(s) en cours » pile à sa seconde, mais son « Butin » est daté de la **minute suivante** (arrivées 01:35:55, 01:37:01 et 01:37:23 → messages 01h36, 01h38 et 01h38, heure de Paris).                                                                                              | Confirmé (trois attaques) |
| Pourquoi la 59e seconde ?                      | Les attaques d'une même minute sont réglées ensemble à la minute suivante, **dans l'ordre de leur seconde d'arrivée**, pas dans l'ordre d'envoi (mesuré : arrivée :15 envoyée en second, réglée avant l'arrivée :48 envoyée en premier). Arriver à :59 fait donc passer après les autres attaques de la minute. | Confirmé (deux tests)     |

## L'heure du serveur

### Ce que les pages donnent

- **Aucune horloge** dans les pages (`Armee.php`, `construction.php`, `commerce.php`, `Reine.php`, `reglement.php`) : ni heure affichée, ni variable de script.
- **Décomptes** : `reste(<secondes>, "<id>")` (et `resteTemps` dans la boîte Compte+) reçoivent un nombre **entier** de secondes, calculé au moment où le serveur fabrique la page. Le script du jeu (relu le 2026-11-04 sur S5) affiche ce nombre puis se rappelle par `setTimeout(…, 1000)` en retirant 1 : il **ne corrige ni le temps de chargement de la page, ni la dérive du minuteur** (un onglet en arrière-plan est ralenti par le navigateur). Le décompte affiché n'est donc qu'approximatif, à plusieurs secondes près au bout d'un moment.
- **En-tête HTTP `Date`** de chaque réponse : heure du serveur à la seconde, en UTC. Le serveur répond derrière un relais (`x-envoy-upstream-service-time`), mais l'en-tête concorde avec l'horloge du jeu (ci-dessous).
- `https://` répond désormais sur S5 (`http://` y redirige) ; S2 se lit encore en `http://`.

### Concordance de l'en-tête `Date` et de l'horloge du jeu

12 lectures de `construction.php` à 0,7 s d'intervalle (S5, 2026-11-03 23:44 UTC) : `Date + reste(N)` donne la même fin à la seconde pour chaque chantier, sauf 2 fois sur 12 où elle vaut une seconde de moins, toujours quand la requête partait en fin de seconde (x,8 ou x,9 s). L'en-tête est donc posé à la réception de la requête, et le jeu calcule `N` un peu après, parfois dans la seconde suivante. **Les deux horloges sont les mêmes à moins d'une seconde près.**

### Écart avec le PC

10 requêtes `HEAD` (S5, 2026-11-03 23:45 UTC, aller-retour 270 à 580 ms) : en encadrant le passage d'une seconde du serveur entre l'envoi et la réponse de chaque requête, l'écart serveur − PC du joueur tient dans **[−0,36 s ; +0,27 s]**. Plus de requêtes (et l'hypothèse que le serveur répond au milieu de l'aller-retour) resserrent la fourchette ; on ne descendra pas sous la moitié d'un aller-retour (≈ 0,15 s) sans hypothèse.

### Durée d'un trajet

- La formule (`temps-de-trajet.md`) est arrondie à la seconde **inférieure** ; le profil l'affiche à la seconde (« 10H 1m 2s »).
- Le décompte d'une attaque en cours est un nombre entier de secondes (`reste(559, "attaque_<n>")`, `fourmizzz-pages.md`).
- La fin d'un événement est donc une seconde entière du serveur ; l'heure « Arrivée à HHhMM » (Compte+) et « Retour le … à HHhMM » la **tronquent** à la minute : quatre convois relevés le 2026-11-04, fin 00:52:38 → « 00h52 », 02:01:13 → « 02h01 », 03:15:45 → « 03h15 », 11:06:39 → « 11h06 » (heure de Paris).

## Quand un événement est-il traité ?

### Ponte : à la seconde

Fin de ponte due à 23:57:07 UTC (S5) : `Reine.php` relue chaque seconde montre la ponte dans la liste jusqu'à 23:57:06 (« 1 s »), puis la suivante en tête dès 23:57:07. Une ponte est traitée **pile à sa seconde** (au moins quand on lit la page).

### Convoi : après la fin de la minute

Convoi dû à 23:52:38 UTC (S5), `commerce.php` relue chaque seconde :

- de 23:52:27 à 23:52:38 : « dans 11s » … « dans 0s » ;
- de 23:52:39 à 23:52:55 : **toujours listé**, « dans 59s », « dans 58s »… : le temps restant est négatif (−1 s s'écrit « 59s » quand le jeu calcule les minutes par division entière) ;
- à 23:53:17 (lecture suivante) : disparu ;
- message « Convoi livré à … » daté **00h53** (Paris), donc à l'heure du traitement, pas à celle de l'arrivée (00:52:38).

Un convoi est donc traité **par un passage périodique, après la fin de la minute où il arrive**, entre 17 et 39 secondes plus tard sur cette mesure. Une seule mesure : le moment exact du passage (pile à la minute, ou quelques secondes après) n'est pas connu.

### Attaque : réglée à la minute suivante

Mesure du 2026-11-04 sur S2 : trois attaques de lexa2 (27;1419) sur le Terrain de chasse de Le_gasteropode (25;1422), Vitesse d'attaque 17, lancées par Claude avec l'accord du joueur, relues sur `Armee.php` chaque seconde et dans la messagerie. Heures UTC (+ 1 h pour Paris).

| Attaque  | Envoi (horloge du PC) | Arrivée (`Date` + `reste`) | Quitte la liste | Message « Butin » | N° du message |
| -------- | --------------------- | -------------------------- | --------------- | ----------------- | ------------- |
| A, 5 JSN | 00:17:46,1            | 00:35:55                   | à 00:35:56      | 01h36 (Paris)     | 87295722      |
| B, 2 JSN | 00:18:52,2            | 00:37:01                   | à 00:37:02      | 01h38 (Paris)     | 87295731      |
| C, 3 JSN | 00:19:14,3            | 00:37:23                   | à 00:37:24      | 01h38 (Paris)     | 87295733      |

- **Trajet** : 1 089 s pour les trois, ce que donne la formule (`temps-de-trajet.md` : 1 089,098 s, arrondi en dessous ou au plus proche ; pas au-dessus).
- **La liste** : la ligne disparaît d'« Attaque(s) en cours » à la seconde d'arrivée (dernière lecture avec « 0 », la suivante sans la ligne), comme une ponte.
- **Le règlement du combat** : le « Butin chez Le_gasteropode » de A est daté 01h36 alors qu'elle arrivait à 01:35:55 ; B, arrivée à 01:37:01, n'est réglée qu'à 01h38, pas au passage de 01:37 qui a eu lieu juste avant son arrivée. Une attaque est donc réglée **au passage qui suit la fin de sa minute d'arrivée**, avec toutes celles de la même minute, comme le convoi.
- **L'ordre dans le paquet** : B (arrivée :01) avant C (arrivée :23), d'après l'ordre des messages dans la conversation et leurs numéros. Comme B est aussi partie la première (numéro d'attaque 25079827 contre 25079828), ce test ne dit pas si l'ordre suit la seconde d'arrivée ou l'ordre d'envoi. Le test suivant tranche.

### Ordre dans le paquet : la seconde d'arrivée

Mesure du 2026-11-04 sur S2, deux cibles à des distances différentes, 3 JSN chacune, même méthode (heures UTC) :

| Attaque                 | Trajet  | Envoi      | N° d'attaque | Arrivée  | Message « Butin » | N° du message |
| ----------------------- | ------- | ---------- | ------------ | -------- | ----------------- | ------------- |
| theo66 (33;1419), d = 6 | 1 806 s | 00:44:42,1 | 25079831     | 01:14:48 | 02h15 (Paris)     | 87295795      |
| Le_gasteropode, d = 3,6 | 1 089 s | 00:56:06,0 | 25079832     | 01:14:15 | 02h15 (Paris)     | 87295793      |

L'attaque envoyée **en second** (numéro d'attaque plus grand) mais arrivée **plus tôt dans la minute** (:15) est réglée **avant** celle envoyée en premier et arrivée à :48 (numéros de message croissants dans l'ordre du règlement ; le 87295794, entre les deux, n'est pas dans ma messagerie : sans doute l'avis du défenseur). **Dans le paquet d'une minute, le jeu règle les attaques dans l'ordre de leur seconde d'arrivée**, comme le dit le guide. Une seule mesure de ce cas ; l'ordre entre deux attaques de la même seconde reste inconnu. Les deux trajets tombent pile sur la formule (1 806,19 → 1 806 ; 1 089,10 → 1 089).

- **Messagerie** : les « Butin » d'une même cible s'empilent dans **une seule conversation** (`conversation_<n>`, titre et heure du dernier message, « (3) » non lus) ; chaque message porte « 04/11/26 à 01h38 », à la minute. Le contenu s'ouvre par `POST messagerie.php` (`traitement=afficher`, `conversation=<n>`), ce qui le marque comme lu. Aucun rapport de combat séparé n'est arrivé pour ces trois attaques (défense nulle ?).
- Les numéros d'attaque se suivent (…826, …827, …828) : personne d'autre n'a lancé d'attaque sur S2 dans ces 90 secondes.

## Pourquoi la 59e seconde

**Rien dans les sources officielles** :

- le règlement (`reglement.php`, version lue le 2026-11-04, sections C1 à C3) ne parle ni de seconde ni d'ordre de résolution ;
- l'aide du jeu (`tutorial.php`, parties Attaque + Défense, Combat, Colonie, Divers) ne parle que de l'ordre de mort des unités, du rappel « dans les 2 minutes qui suivent le départ » et des attaques maintenues pendant le mode vacances ;
- `docs/research/` n'en disait rien.

**Témoignage de joueurs** : un petit guide illustré, « Le secret de la 59e seconde » (6 pages, transmis par le joueur le 2026-11-04 ; il précise lui-même présenter le fonctionnement « selon l'explication fournie par le joueur »). Ce qu'il affirme :

- un programme automatique (cron) regroupe les attaques et les traite **toutes les minutes** ;
- dans le paquet, il les traite **l'une après l'autre, dans l'ordre de leur seconde d'arrivée** (exemple : :12, puis :34, puis :59) ; arriver à :59 fait donc passer **en fin de paquet** ;
- à quoi ça sert : dans une synchro (caler une attaque sur le mouvement d'une autre armée), passer après l'adversaire peut laisser son armée survivre à son attaque, ou au contraire battre son armée à son retour. L'avantage est d'ordre de traitement, pas une victoire garantie, et d'autres joueurs peuvent viser :59 aussi (l'ordre entre deux attaques de la même seconde n'est pas dit) ;
- le calcul : seconde du clic = 59 − secondes du trajet (trajet 15:09:08 → clic à :51) ; les heures et minutes du départ choisissent la minute d'arrivée ;
- l'horloge : le **chat d'alliance** affiche l'heure de chaque message **avec les secondes** (« 13:40:59 ») ; on y envoie « 59 » quand son horloge montre :59 pour vérifier l'écart (non vérifié par nous) ;
- la vérification : renvoyer tout de suite une seconde attaque au même trajet ; si son « Arrivée à » affiche la minute d'après, la première arrivait en fin de minute (un indice, pas une preuve de :59). Cohérent avec la troncature de « Arrivée à HHhMM » mesurée ci-dessus.

**Ce qui est confirmé** : les attaques (et les convois) d'une même minute sont réglés ensemble au passage qui suit cette minute, dans l'ordre de leur seconde d'arrivée et non d'envoi (deux tests ci-dessus). **Ce qui reste inconnu** : l'ordre entre deux attaques de la même seconde (deux joueurs qui visent tous deux :59), et ce que le guide dit des synchros (survivre à l'attaque adverse, battre l'armée adverse), qui découle de cet ordre mais n'a pas été observé dans un vrai combat.

## Ce qu'une feature peut montrer de fiable

- **L'heure du serveur à la seconde**, et l'écart avec le PC, à quelques dixièmes près : quelques `HEAD` sur la page courante, sans rien envoyer au jeu de plus qu'une lecture.
- **L'arrivée à la seconde d'une attaque envoyée maintenant** : heure du serveur + temps de trajet (formule vérifiée sur un profil de S5 et sur trois attaques de S2), à la seconde près si la formule est exacte pour cette distance.
- **Le moment de cliquer** pour arriver dans une seconde voulue : la fenêtre ne dure qu'une seconde (trajet 15:09:08 → le serveur doit recevoir l'envoi entre :51,0 et :51,999). Avec l'écart PC/serveur connu à ± 0,3 s et le délai réseau de l'envoi, il faut viser **le milieu de la seconde** (:51,5 sur l'horloge du serveur, moins le délai d'envoi), pas son début : un clic à :51,0 a une chance sur deux de partir à :50.
- **Pourquoi :59** : mesuré, toutes les attaques d'une minute sont réglées ensemble à la minute suivante, dans l'ordre de leur seconde d'arrivée.

Règles à respecter (`reglement.md`, C2 et C3) : le clic final reste celui du joueur, **jamais d'envoi sur minuterie** ; une extension ne doit pas offrir sans Compte+ une fonction équivalente au Compte+ (le jeu a un « Simulateur Durée » réservé au Compte+, qui donne le temps d'un trajet).

## Cadrage de la feature « Timing à la seconde »

Décidé avec le joueur le 2026-11-04 (`/grilling`). Le code reste à faire (chantier 30) ; la page de feature (`docs/features/`) s'écrira avec lui.

1. **Où** : sur le formulaire d'attaque seulement (`ennemie.php?Attaquer=<id>`), un bloc juste au-dessus du bouton « Attaquer », indépendant du Plan de flood (son propre interrupteur « Timing à la seconde » dans « Fonctionnalités », il marche Plan de flood coupé, sans toucher à son encart).
2. **Arrivée visée** : par défaut, la prochaine arrivée à :59 qu'on a encore le temps de viser (au moins 10 s de préparation), qui passe à la minute suivante quand la fenêtre est ratée. Un champ facultatif « Arrivée visée » (« 23 h 40 ») choisit la minute pour une synchro ; le bloc donne alors l'heure de départ et le compte à rebours quand elle approche. La seconde visée est toujours :59, sans réglage.
3. **Trajet** (revu le 2026-11-04 après les tests) : **la formule d'Optizzz** (`packages/game/src/travel.ts`), exacte à la seconde sur les cinq attaques mesurées, avec les coordonnées de l'export et la Vitesse d'attaque mémorisée. Quand le profil de la cible affiche « Temps de trajet » (Compte+), il sert de contrôle : en cas d'écart, le bloc prend le temps du jeu et le dit. La vérification après l'envoi (décision 6) montre l'arrivée réelle.
4. **Affichage**, dans cet ordre :
   - « Heure du jeu : 08:30:40 », qui avance chaque seconde, recalée sur l'en-tête `Date` de quelques `HEAD` à l'ouverture du formulaire ; l'écart avec le PC n'est écrit que s'il dépasse 1 s (« Votre horloge retarde de 3 s : le bloc en tient compte ») ;
   - « Trajet : 15 h 09 min 08 s · arrivée visée : 23 h 39 min 59 s », et le champ « Arrivée visée » ;
   - le compte à rebours en gros, « Cliquez dans 11 s », en dixièmes sous 5 s (« 2,4 s »), puis « Cliquez maintenant » dans un cadre épais pendant la fenêtre (texte et forme, pas la seule couleur, ADR 0003) ;
   - après la fenêtre : « Trop tard pour 23 h 39 min 59 s », puis la cible suivante.
   - La fenêtre « Cliquez maintenant » dure ≈ 0,6 s, centrée sur le milieu de la seconde de départ côté serveur, avancée de la moitié de l'aller-retour mesuré (le temps que l'envoi met à atteindre le serveur).
5. **Son** : case « Son », décochée par défaut et mémorisée par serveur ; trois bips courts aux trois dernières secondes, un bip plus long au milieu de la fenêtre (Web Audio, sans fichier ni permission). Le son ne déclenche rien.
6. **Vérification après l'envoi** : pour une attaque lancée depuis le bloc avec une arrivée visée, sa ligne dans « Attaque(s) en cours » (formulaire d'attaque, `Armee.php`) dit l'arrivée exacte, tirée de `reste(N)` et de l'en-tête `Date` de la même réponse, sans requête de plus : « Arrivée à 23:39:59 ✓ :59 visé » ou « Arrivée à 23:40:00 : une seconde trop tard » (texte et symbole). Rapprochement comme celui du Plan de flood (`flood.md`, « Suivi »).
7. **Coder sans attendre la mesure d'une attaque** : la règle de la 59e seconde est présentée comme venant des joueurs, dans « Pourquoi :59 ? » replié. Depuis la mesure du 2026-11-04 (trois attaques sur S2), puis du test à deux cibles, le texte peut dire : « Le jeu règle ensemble, à la minute suivante, toutes les attaques arrivées dans une même minute, dans l'ordre de leur seconde d'arrivée : à :59, la vôtre passe après les autres. Deux attaques de la même seconde : ordre inconnu. » La règle n'a plus à être présentée comme un simple témoignage.

**Garde-fous** (règlement C2 et C3) : Optizzz ne clique jamais, n'envoie jamais le formulaire, ne grise ni n'active le bouton « Attaquer », n'ajoute aucun raccourci clavier d'envoi. Les `HEAD` ne lisent que le jeu, à l'ouverture du formulaire par le joueur ; rien ne part ailleurs que vers Fourmizzz (pas de mise à jour de `PRIVACY.md`). Rien d'équivalent au Compte+ : le trajet ne vient pas du Simulateur Durée.

**Décision 3 revue** : le 2026-11-04 sur S2, le profil n'affichait ni « Distance » ni « Temps de trajet » (compte sans Compte+ ce jour-là ; sur S5, avec Compte+, il les affiche). D'où la formule comme source principale.
