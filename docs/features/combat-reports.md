# Feature : Rapports d'attaque

Issue [#1](https://github.com/Achaak/Optizzz/issues/1), faite le 2026-10-19 à partir des premiers vrais rapports (S2 et S5). Structure des pages : `../research/fourmizzz-pages.md` (« Conversations Combats »). Pendant des chasses : `hunt-reports.md`.

## But

Lire d'un coup d'œil ce qu'a donné une attaque, et la rejouer dans le simulateur avec l'armée vue.

## Comportement

- **Quand** : à l'ouverture d'une conversation `data-type="Combats"` de `messagerie.php` qui contient un rapport d'attaque (les conversations « Butin » et « Colonie conquise » restent telles quelles). Aucune requête.
- **Tableau** au-dessus du texte du jeu, qui reste visible (un message court, ses liens servent) : Date et lieu (le lieu dessous) | Résultat (ce qui a été pris dessous) | Mon armée (mes pertes dessous) | Armée adverse (ses pertes et ses Armes dessous) | « Simuler ». Cinq colonnes, le détail en deuxième ligne grisée : à dix colonnes, le tableau débordait de la messagerie et « Simuler » sortait de l'écran (revu le 2026-10-19). Le lieu dit « Fourmilière, armée d'occupation » quand le colonisateur défendait. Le résultat est écrit (« Victoire », « Défaite »), jamais seulement coloré. Unités abrégées comme le jeu, noms complets en infobulle.
- **Armes adverses** : le bonus de leurs dégâts ÷ leurs dégâts de base × 10, arrondi. Sous 10 dégâts de base, l'arrondi du jeu cache le niveau : « ? » et une infobulle.
- **Pris** : le TDC et les ressources viennent d'une autre conversation, « Butin chez X », à la même minute. Si elle est ouverte sur la page, la colonne les additionne (« 6 044 cm², 15 nourriture ») ; sinon « ? » avec l'infobulle « Ouvrez « Butin chez X » … ». rien pour une défaite.
- **Simuler** ouvre le simulateur de combat par-dessus le jeu : l'armée adverse vue (unités connues du moteur) seule au lieu attaqué, ses Armes, et mon armée d'Armée (voir `combat-simulator.md`).
- Interrupteur « Rapports d'attaque » dans « Fonctionnalités ».

## Pas encore fait

- Rapports de défense (attaque subie) : aucun vu ; ne pas deviner leur texte.
- Comparer le rapport au moteur de combat comme pour les chasses : les deux rapports vus sont trop déséquilibrés pour rien vérifier (un seul échange).

## Code

| Fichier                                         | Rôle                                                           |
| ----------------------------------------------- | -------------------------------------------------------------- |
| `src/game/pages/combat-reports.ts` (+ test)     | Lecture des attaques et du butin, Armes déduites du bonus      |
| `src/features/combat-reports/mount.ts` (+ test) | Tableau, butin des autres conversations, bouton « Simuler »    |
| `src/features/combat-reports/index.ts`          | La feature : repère les conversations « Combats » ouvertes     |
| `src/features/combat-simulator/form.ts`         | `Opponent` : l'armée d'un rapport dans l'adresse du simulateur |
