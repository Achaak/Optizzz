# 30 · Aide au timing d'une attaque à la seconde près (extension)

Priorité 4 · effort à estimer · **commence par une recherche** · conflits : `ennemie.php` (Plan de flood).

## But

Aider à faire arriver une attaque à une seconde voulue (la 59e d'une minute, par exemple) : connaître l'heure du serveur à la seconde, l'écart avec l'horloge du PC, et un compte à rebours jusqu'au moment de cliquer. **Le clic reste celui du joueur** (jamais d'envoi sur minuterie, `docs/research/reglement.md`).

## Ce qui existe déjà

- Plan de flood sur le formulaire d'attaque (`flood.md`), heures de fin (`end-times.md`), formule du trajet (`docs/research/temps-de-trajet.md`).

## À faire d'abord (session de recherche, sans code)

1. Comment le jeu donne l'heure du serveur (en-tête HTTP `Date`, horloge de la page, décompte des attaques) et avec quelle précision ; un trajet est-il arrondi à la seconde ?
2. Pourquoi la 59e seconde compte (ordre de résolution des attaques d'une même minute ?) : chercher dans le règlement, l'aide et `docs/research/`, ne rien deviner.
3. Écrire `docs/research/timing-attaques.md` avec les sources, puis cadrer la feature (`/grilling`).

## À cadrer ensuite

Où (formulaire d'attaque, Plan de flood), ce qu'on montre (heure du serveur, écart, « cliquez dans 12 s »), son ou pas, règles du jeu à respecter.

## Fini quand

La recherche est écrite et la feature cadrée ; le code seulement si la recherche confirme qu'il y a quelque chose de fiable à montrer.
