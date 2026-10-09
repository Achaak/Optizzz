# Feature : Chaîne de TDC

Décidé lors d'une session de cadrage (`/grill-me`) le 2026-10-08. Règles d'attaque : `../research/combat.md` ; méta des chaînes (chasseur, passeur, grenier) : `/Users/achak/Development/bot-fourmizzz/research/alliance-roles.md`. Le flood d'une cible par un joueur est dans `flood.md`.

## But

Faire passer du TDC entre membres d'une alliance : qui peut prendre à qui, et l'ordre des attaques (l'« ordre de passage ») pour faire monter le TDC des chasseurs jusqu'aux greniers. Lecture seule : l'extension ne lance aucune attaque.

## Règles utilisées (non vérifiées sur une vraie chaîne)

- Une attaque gagnée prend `min(fourmis, floor(20 % du TDC de la cible))` : il faut envoyer autant de fourmis que de cm² à prendre.
- La portée 50 % (inclus) – 300 % (exclu) est vérifiée à **chaque arrivée**, avec 1 % de marge au-dessus des 50 % (comme le Plan de flood) : d'autres attaques ou chasses peuvent bouger les TDC avant.
- Attaques en route à la fois : Vitesse d'attaque + 1, par attaquant, sur tout le plan ; pour moi, moins mes attaques déjà en route notées par le Plan de flood.
- Ces règles viennent de `src/game/attack.ts`, comme pour le Plan de flood et les Cibles.
- Personne ne défend son Terrain de Chasse : la vue le rappelle dans un bandeau.

## Comportement

- **Accès** : entrée « Chaîne » du menu d'alliance, après « Carte » (après « Membres » si la carte est coupée), `alliance.php?Membres#chaine`. La vue remplace le tableau des membres tant que le hash est `#chaine`.
- **Membres** : ceux de mon alliance dans l'export, TDC en direct sur la page Membres. Vacances et bannis exclus d'office ; colonisés gardés (⛓).
- **Rôles** : Grenier, Passeur 1, Passeur 2…, Chasseur, Hors chaîne (exclu). La liste propose toujours au moins Passeur 1 à 5, et un rang au-dessus du plus haut utilisé : on peut monter la chaîne par le haut sans remplir les échelons un à un. Sans rôles enregistrés, ceux proposés d'après le TDC s'affichent ; un membre arrivé depuis l'enregistrement des rôles est « Hors chaîne », et un avertissement le nomme. « Proposer des rôles » les remet :
  - greniers : les membres à 80 % ou plus du plus gros TDC (le plus gros seul si tout le monde y est) ;
  - chaque échelon suivant : ceux que le plus petit de l'échelon du dessus peut attaquer ;
  - le dernier échelon : les chasseurs ; les échelons du milieu, des passeurs numérotés depuis le bas.
- **Partage des rôles** : une ligne « Pseudo: Passeur 2 » par membre, export dans le presse-papiers, import par pseudo (casse et accents ignorés, dans le pseudo comme dans le rôle ; lignes ignorées signalées). Avec les mêmes rôles, les mêmes réglages et la même première arrivée, chacun retrouve le même plan.
- **Qui peut prendre à qui** : tableau attaquant (ligne) × cible (colonne), membres de la chaîne du haut vers le bas ; chaque case donne `floor(20 %)` de la cible, vide hors de portée **avec la marge de 1 %** (même règle que le plan et les rôles proposés : une cible entre 50 % et 50,5 % est « trop juste » partout) ; les cases du plan en couleur.
- **Ordre de passage**, deux modes :
  - **Toute la chaîne** : chaque chasseur a un « TDC à garder » ; ce qui dépasse monte vers le plus petit grenier qu'il peut atteindre à ce moment, plus gros surplus d'abord. Seul un échelon plus haut attaque un plus bas, par le chemin le plus court ; un attaquant sans attaque libre est contourné. Les passeurs finissent comme ils ont commencé ;
  - **Un transfert** : N cm² de X vers Y, au choix (vide = le plus possible), par les membres de la chaîne quels que soient leurs rôles.
- **Calcul d'un transfert** :
  - chaque maillon prend en attaques de 20 % ; quand 20 % sortirait la cible de portée pour l'attaque suivante, la plus grosse prise qui la laisse à la limite, puis une dernière de 20 % ;
  - deux ordres essayés : de bas en haut (le TDC monte maillon par maillon) et de haut en bas (le haut frappe d'abord, les passeurs se rechargent ensuite) ; on garde celui qui fait passer le plus, bas en haut à égalité ;
  - chaque maillon fait passer ce que peut le plus faible, pour que les passeurs ne gardent rien.
- **Chaîne cassée** : « Pas de passage de A vers B (TDC) : il faudrait un passeur entre X et Y cm² » (ou « N passeurs »), d'après le membre atteint le plus haut sous B ; ou « les membres à portée n'ont plus d'attaque libre ». Les autres chasseurs sont planifiés quand même.
- **Horaires** : une arrivée par minute, dans l'ordre du plan (le N° de chaque ligne). Le tableau est trié par départ (qui part en premier en haut), ou par arrivée au choix. Première arrivée par défaut : la plus tôt qui laisse partir chaque attaque dans 5 min au moins, arrondie aux 5 min, **calculée à l'ouverture de la vue** puis figée (elle ne bouge plus pendant qu'on lit) ; modifiable, à l'heure de Paris comme toutes les heures affichées ; « au plus tôt » la recalcule (proposé aussi quand un départ est passé). Départ déjà passé en rouge. Colonne « TDC après (attaquant / cible) ». Trajet avec la Vitesse d'attaque de l'attaquant : la mienne (Laboratoire), sinon celles saisies sur la Carte, sinon le niveau par défaut de la Carte (≈).
- **Diffusion** : « Copier le plan » donne un texte pour un message collectif, une ligne par attaque dans l'ordre du tableau (N° d'arrivée, départ, attaquant, cible, fourmis, arrivée). Si le presse-papiers refuse, le texte s'affiche à copier à la main. Mes attaques sont en gras, avec un lien « Attaquer » vers `ennemie.php?Attaquer=<id>&lieu=1` : le formulaire du jeu, où le Plan de flood peut remplir l'armée ; le joueur valide lui-même.
- **Mémorisé par serveur** : rôles et TDC à garder (`local:tdcChain:<host>:settings`). Les niveaux de Vitesse d'attaque restent ceux de la Carte ; saisis sur la Carte, ils arrivent dans la Chaîne sans recharger la page.
- **Messages** : export injoignable ou alliance absente de l'export (« dans l'heure », l'export est horaire), en clair ; le détail technique va dans la console.
- Interrupteur « Chaîne de TDC » : coupé, ni menu ni vue.

## Plus tard

- TDC cible libre par membre (au lieu du seul « à garder » des chasseurs), répartition fine entre greniers.
- Armée réelle des membres (le plan suppose qu'ils ont assez de fourmis), défense sur le TDC.
- Recalage des règles sur de vrais floods ([#1](https://github.com/Achaak/Optizzz/issues/1)).

## Code

| Fichier                                            | Rôle                                                                          |
| -------------------------------------------------- | ----------------------------------------------------------------------------- |
| `src/features/tdc-chain/roles.ts` (+ test)         | Rôles, proposition d'après le TDC, partage texte, échelons                    |
| `src/features/tdc-chain/chain.ts` (+ test)         | Qui peut prendre à qui, transfert, plan de la chaîne, chaîne cassée           |
| `src/features/tdc-chain/schedule.ts` (+ test)      | Départs et arrivées, première arrivée par défaut                              |
| `src/features/tdc-chain/plan-text.ts` (+ test)     | Texte « Copier le plan »                                                      |
| `src/features/tdc-chain/settings.ts`               | Rôles et TDC à garder mémorisés                                               |
| `src/features/tdc-chain/menu.ts`                   | Entrée de menu (script léger, toutes les pages)                               |
| `src/features/tdc-chain/TdcChain.tsx`, `style.css` | Vue React                                                                     |
| `src/entrypoints/tdc-chain.content/index.tsx`      | Script dédié à `alliance.php` : monte la vue dans un Shadow DOM               |
| `src/utils/alliance-views.ts` (+ test)             | Vues Optizzz de la page Membres (`#carte`, `#chaine`, `#historique`) allumées |
| `src/utils/alliance-menu.ts` (+ test)              | Entrées Optizzz du menu d'alliance, dans l'ordre, partagé                     |

La vue se vérifie dans le jeu (S5, 2026-10-08 : 15 membres, plan de la chaîne, transfert, liens, bascule Carte / Chaîne / Membres).
