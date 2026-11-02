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

## Niveaux adverses

Ajouté le 2026-11-02.

- **Ce qu'on en tire** : les morts adverses de chaque échange dépendent de leur vie, donc de leur Bouclier, et du Dôme à la Fourmilière ou de la Loge à la Loge (`placeHpBonus`). On essaie chaque Bouclier de 0 à 60 (et chaque Dôme ou Loge de 0 à 60) et on garde ceux qui redonnent les morts du rapport, échange par échange, les dégâts infligés (base + bonus) frappant les unités dans l'ordre de la ponte comme dans le moteur ; un point de dégât de plus ou de moins sur chaque échange est toléré (le rapport arrondit). `guessDefenseLevels`, `packages/game/src/army/report-levels.ts`.
- **Ce que ça donne** : sur le Terrain de chasse, le Bouclier seul (« Bouclier 7 », ou « Bouclier 6 à 8 ») ; à la Fourmilière, des couples, 2 niveaux de Dôme valant 1 niveau de Bouclier (« Bouclier 17 et Dôme 0 à Bouclier 0 et Dôme 34 (18 couples) ») ; à la Loge, 3 niveaux de Bouclier pour 2 de Loge. Rien quand tous les défenseurs sont tombés ou qu'aucun n'est tombé (le rapport ne borne la vie que d'un côté), ni quand aucun niveau ne colle (unité inconnue, règle différente).
- **Où** : dans la colonne « Armée adverse », après les Armes ; « Simuler » remplit aussi le Bouclier et le Dôme ou la Loge quand un seul couple colle. Sur le site, l'outil de combat a « Lire un rapport d'attaque » (`site-combat.md`).
- **Échanges** : le lecteur garde maintenant chaque échange « Vous infligez … et tuez … / L'ennemie inflige … et en tue … » (`exchanges`), le premier restant dans `dealt`, `killed`, `taken`, `lost`.
- **Non vérifié** : seuls des rapports à un échange ont été vus (`../research/combat.md`) ; qu'un rapport d'attaque de la Fourmilière ne compte que les morts de la Fourmilière (et pas celles du Terrain traversé avant) est supposé.

## Pas encore fait

- Rapports de défense (attaque subie) : aucun vu ; ne pas deviner leur texte.
- Comparer le rapport au moteur de combat comme pour les chasses : les deux rapports vus sont trop déséquilibrés pour rien vérifier (un seul échange).

## Code

| Fichier                                                        | Rôle                                                                         |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `packages/game/src/pages/combat-reports.ts` (+ test)           | Lecture des attaques, de leurs échanges et du butin, Armes déduites du bonus |
| `packages/game/src/army/report-levels.ts` (+ test)             | Bouclier, Dôme ou Loge qui redonnent les morts d'un rapport                  |
| `apps/extension/src/features/combat-reports/mount.ts` (+ test) | Tableau, butin des autres conversations, bouton « Simuler »                  |
| `apps/extension/src/features/combat-reports/index.ts`          | La feature : repère les conversations « Combats » ouvertes                   |
| `apps/extension/src/features/combat-simulator/form.ts`         | `Opponent` : l'armée d'un rapport dans l'adresse du simulateur               |
