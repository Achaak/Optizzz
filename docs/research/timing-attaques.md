# Timing d'une attaque à la seconde

Recherche du chantier 30 (lot de novembre 2026), menée le 2026-11-04 (nuit du 3 au 4, heure de Paris) sur S5 et S2, **en lecture seule** : uniquement des `GET` de pages du jeu, aucune attaque, aucun envoi. Heures relevées dans l'en-tête HTTP `Date`, en UTC (Paris = UTC + 1 en novembre).

## En bref

| Question                                       | Réponse                                                                                                                                                                                                                            | Statut                     |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| Le jeu montre-t-il l'heure du serveur ?        | Non, aucune horloge dans les pages. Seuls l'en-tête HTTP `Date` (à la seconde) et les décomptes `reste(<secondes>)` la donnent.                                                                                                    | Confirmé                   |
| L'heure du serveur et celle du PC concordent ? | Sur le PC du joueur, à ± 0,4 s près (10 requêtes). Un autre PC peut dériver de plusieurs secondes : il faut mesurer l'écart.                                                                                                       | Confirmé (une mesure)      |
| Un trajet est-il arrondi à la seconde ?        | Oui : durées et fins sont des secondes entières (profil, `reste()`, en-tête `Date`).                                                                                                                                               | Confirmé                   |
| « Arrivée à 19h54 » arrondit-il ?              | Tronqué à la minute (« Retour le … à 00h52 » pour une arrivée à 00:52:38).                                                                                                                                                         | Confirmé sur les convois   |
| Un convoi arrive-t-il à sa seconde ?           | **Non** : il est traité **après la fin de sa minute** (convoi dû à 00:52:38, encore listé à 00:52:55, livré entre 00:52:55 et 00:53:17, message « Convoi livré » daté 00h53).                                                      | Confirmé (une mesure)      |
| Une attaque arrive-t-elle à sa seconde ?       | Pas mesuré (aucune attaque en route sur S5 ni S2). Probablement comme le convoi (même liste de mouvements), mais rien ne le prouve.                                                                                                | **Non confirmé**           |
| Pourquoi la 59e seconde ?                      | D'après un guide de joueurs : les attaques d'une même minute sont traitées en un paquet, dans l'ordre de leur seconde d'arrivée ; arriver à :59 fait passer en dernier. Cohérent avec le convoi, rien dans le règlement ni l'aide. | Témoignage, **non mesuré** |

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

### Attaque : non mesurée

Aucune attaque n'était en route sur S5 ni S2. Les attaques sont des mouvements de troupes comme les convois (même décompte, même « Arrivée à HHhMM » tronqué), et le message « Butin chez X » arrive « à la même minute » que le rapport (`fourmizzz-pages.md`) ; ce n'est **pas** une preuve qu'elles suivent le même passage par minute.

**Mesure à faire** (sur une attaque que le joueur lance lui-même, ou une attaque déjà en route) : relire `Armee.php` chaque seconde autour de l'arrivée, noter quand la ligne disparaît, et comparer l'heure du rapport de combat à celle de l'arrivée. Deux attaques arrivant à :05 et :55 d'une même minute diraient aussi si l'ordre de traitement suit la seconde d'arrivée.

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

**Ce qui le recoupe** : le convoi mesuré ci-dessus est bien traité par un passage après la fin de sa minute, et son message porte l'heure du passage. **Ce qui reste à mesurer** : qu'une attaque suit le même passage, et l'ordre dans le paquet (la mesure décrite plus haut, deux attaques à :05 et :55 de la même minute).

## Ce qu'une feature peut montrer de fiable

- **L'heure du serveur à la seconde**, et l'écart avec le PC, à quelques dixièmes près : quelques `HEAD` sur la page courante, sans rien envoyer au jeu de plus qu'une lecture.
- **L'arrivée à la seconde d'une attaque envoyée maintenant** : heure du serveur + temps de trajet (formule vérifiée sur les profils), à la seconde près si la formule est exacte pour cette distance.
- **Le moment de cliquer** pour arriver dans une seconde voulue : la fenêtre ne dure qu'une seconde (trajet 15:09:08 → le serveur doit recevoir l'envoi entre :51,0 et :51,999). Avec l'écart PC/serveur connu à ± 0,3 s et le délai réseau de l'envoi, il faut viser **le milieu de la seconde** (:51,5 sur l'horloge du serveur, moins le délai d'envoi), pas son début : un clic à :51,0 a une chance sur deux de partir à :50.
- **L'ordre de traitement dans la minute** : seulement sur la foi du guide, tant que la mesure sur une attaque n'est pas faite.

Règles à respecter (`reglement.md`, C2 et C3) : le clic final reste celui du joueur, **jamais d'envoi sur minuterie** ; une extension ne doit pas offrir sans Compte+ une fonction équivalente au Compte+ (le jeu a un « Simulateur Durée » réservé au Compte+, qui donne le temps d'un trajet).

## Cadrage de la feature « Timing à la seconde »

Décidé avec le joueur le 2026-11-04 (`/grilling`). Le code reste à faire (chantier 30) ; la page de feature (`docs/features/`) s'écrira avec lui.

1. **Où** : sur le formulaire d'attaque seulement (`ennemie.php?Attaquer=<id>`), un bloc juste au-dessus du bouton « Attaquer », indépendant du Plan de flood (son propre interrupteur « Timing à la seconde » dans « Fonctionnalités », il marche Plan de flood coupé, sans toucher à son encart).
2. **Arrivée visée** : par défaut, la prochaine arrivée à :59 qu'on a encore le temps de viser (au moins 10 s de préparation), qui passe à la minute suivante quand la fenêtre est ratée. Un champ facultatif « Arrivée visée » (« 23 h 40 ») choisit la minute pour une synchro ; le bloc donne alors l'heure de départ et le compte à rebours quand elle approche. La seconde visée est toujours :59, sans réglage.
3. **Trajet** : celui que le jeu écrit sur le profil de la cible (`Membre.php`, « Temps de trajet »), lu par la même lecture en arrière-plan que le TDC du Plan de flood. Profil illisible : la formule d'Optizzz, avec l'avertissement « Trajet calculé par Optizzz, pas lu dans le jeu : la seconde d'arrivée peut être fausse d'une seconde. »
4. **Affichage**, dans cet ordre :
   - « Heure du jeu : 08:30:40 », qui avance chaque seconde, recalée sur l'en-tête `Date` de quelques `HEAD` à l'ouverture du formulaire ; l'écart avec le PC n'est écrit que s'il dépasse 1 s (« Votre horloge retarde de 3 s : le bloc en tient compte ») ;
   - « Trajet : 15 h 09 min 08 s · arrivée visée : 23 h 39 min 59 s », et le champ « Arrivée visée » ;
   - le compte à rebours en gros, « Cliquez dans 11 s », en dixièmes sous 5 s (« 2,4 s »), puis « Cliquez maintenant » dans un cadre épais pendant la fenêtre (texte et forme, pas la seule couleur, ADR 0003) ;
   - après la fenêtre : « Trop tard pour 23 h 39 min 59 s », puis la cible suivante.
   - La fenêtre « Cliquez maintenant » dure ≈ 0,6 s, centrée sur le milieu de la seconde de départ côté serveur, avancée de la moitié de l'aller-retour mesuré (le temps que l'envoi met à atteindre le serveur).
5. **Son** : case « Son », décochée par défaut et mémorisée par serveur ; trois bips courts aux trois dernières secondes, un bip plus long au milieu de la fenêtre (Web Audio, sans fichier ni permission). Le son ne déclenche rien.
6. **Vérification après l'envoi** : pour une attaque lancée depuis le bloc avec une arrivée visée, sa ligne dans « Attaque(s) en cours » (formulaire d'attaque, `Armee.php`) dit l'arrivée exacte, tirée de `reste(N)` et de l'en-tête `Date` de la même réponse, sans requête de plus : « Arrivée à 23:39:59 ✓ :59 visé » ou « Arrivée à 23:40:00 : une seconde trop tard » (texte et symbole). Rapprochement comme celui du Plan de flood (`flood.md`, « Suivi »).
7. **Coder sans attendre la mesure d'une attaque** : la règle de la 59e seconde est présentée comme venant des joueurs, dans « Pourquoi :59 ? » replié : « D'après les joueurs, le jeu traite les attaques de chaque minute ensemble, dans l'ordre de leur seconde d'arrivée. » La mesure (deux attaques lancées par le joueur à :05 et :55 de la même minute, sur une cible sans danger, puis relecture d'`Armee.php` et des rapports) reste à faire à la prochaine occasion ; elle mettra à jour ce document et ce texte.

**Garde-fous** (règlement C2 et C3) : Optizzz ne clique jamais, n'envoie jamais le formulaire, ne grise ni n'active le bouton « Attaquer », n'ajoute aucun raccourci clavier d'envoi. Les `HEAD` ne lisent que le jeu, à l'ouverture du formulaire par le joueur ; rien ne part ailleurs que vers Fourmizzz (pas de mise à jour de `PRIVACY.md`). Rien d'équivalent au Compte+ : le trajet vient du profil, gratuit, pas du Simulateur Durée.
