# Feature : Planificateur de ponte

Décidé lors d'une session de cadrage (`/grill-me`) le 2026-10-07, refait le 2026-10-09 avec le joueur : l'ancien bloc (phrases sous le coût, bouton « max » + liste « maintenant / dans 1 h… ») était coincé dans la colonne de droite, peu lisible, et ne disait pas ce que « max » allait faire. Voir aussi `roadmap.md`.

## But

Choisir une ponte en un clic, voir avant de cliquer ce qu'elle donnera, et savoir quand elle sera payée, quand elle finira et ce qu'elle coûtera chaque jour.

## Comportement

- **Où** : sur `Reine.php`, dans la cellule de description de chaque unité pondable (`td.desciption_amelioration`, large), hors du formulaire du jeu. Le curseur et le formulaire du jeu restent à droite, intacts.
- **Raccourcis** : des boutons qui portent, en gras, le nombre qu'ils mettront, rangés par intention ; ce qui les plafonne est écrit à côté (« entrepôt plein », « 7 j max ») ; sans rien à pondre, un texte remplace le bouton (« TDC plein, 3 937 sans travail », « rien de payable maintenant », « bilan déjà négatif ») :
  - « Tout payer » : maintenant, puis dans chaque délai réglé (3 h et 12 h par défaut), récoltes et entretien compris, plafonné par l'entrepôt de nourriture ; un délai qui donne le même nombre que le précédent (entrepôt plein) n'est pas montré ;
  - « Durée de ponte » : une ponte de chaque durée réglée (1 h et 8 h par défaut), et « jusqu'à demain 8 h 00 » : une ponte qui finit à l'heure de retour réglée, après la file en cours (nombre arrondi au plus proche : elle finit à 8 h 00, pas 7 h 59) ;
  - unités : « Entretien › bilan à zéro », le plus d'unités dont l'entretien (5 / 10 / 15 % du coût par jour sur le TDC, dans la Fourmilière, dans la Loge) laisse un bilan de nourriture positif ou nul ;
  - ouvrières : « Terrain › jusqu'au TDC », une ouvrière par cm², file de ponte comprise (TDC déjà plein : le texte dit combien sont sans travail). Les autres raccourcis ne sont **pas** plafonnés au TDC : on pond souvent plus d'ouvrières que de cm².
  - Jamais plus de 7 jours de ponte, comme le curseur du jeu.
- **Aperçu** : survoler (ou atteindre au clavier) un raccourci montre son résultat dans le résumé, bordures en pointillés ; cliquer met le nombre dans le champ du jeu et déclenche son `keyup` (le jeu recalcule son coût et replace son curseur). La ponte n'est jamais lancée. Le raccourci qui correspond au nombre choisi est marqué.
- **Résumé** de la ponte choisie (par le curseur, les champs du jeu ou un raccourci), en cases étiquetées : Quantité, Coût (nourriture), Payable (maintenant en vert, « dans 3 h 10 » en orange avec l'heure, « jamais » en rouge), Fin de ponte, puis Bilan après (avec l'entretien ; rouge si négatif) pour une unité, ou Sans travail (avec le TDC) pour les ouvrières. Rien de choisi : une phrase explique les raccourcis, à la place des cases, pour que le survol ne fasse pas bouger la page.
- **Régler** (lien en haut à droite du bloc) : délais de « Tout payer » et durées de ponte (heures entières, 4 au plus chacun), heure de « jusqu'à ». Mémorisés par serveur, communs à toutes les unités ; un changement redessine tous les blocs.
- **Suivi du jeu** : recalcul après chaque frappe, au changement de destination, et dès que le jeu réécrit son coût (`cout_nombre`, `cout_nourriture`, `cout_temps`, suivis par un `MutationObserver`) : curseur, « Changer la Durée », « Changer le Coût ».
- **Calculs** : nourriture d'une unité = coût affiché ÷ nombre affiché ; durée d'une unité = temps de base du jeu (`tcaste`) × vitesse du joueur lue dans le script de la page (le temps affiché est arrondi), sinon temps affiché ÷ nombre. La ponte est payée à la commande, puis attend la fin de la file en cours. Stock (en-tête), revenus de `Ressources.php` (cache des Prévisions de ressources, relu s'il a plus de 15 min), capacités d'entrepôt mémorisées, file de ponte de la page. Les plans sont calculés à l'heure de lecture de la page ; laissée ouverte, seul ce qui est relatif à maintenant avance. Revenus illisibles : une ligne « Prévisions de ponte indisponibles » sous la première unité.

## Code

| Fichier                                            | Rôle                                                                   |
| -------------------------------------------------- | ---------------------------------------------------------------------- |
| `src/features/laying-planner/laying.ts` (+ test)   | Lignes de ponte, commande, coût d'une unité, plan, raccourcis, maximum |
| `src/features/laying-planner/settings.ts` (+ test) | Réglages des raccourcis, mémorisés par serveur                         |
| `src/features/laying-planner/mount.ts` (+ test)    | Bloc dans la description : raccourcis, aperçu, résumé, réglages        |
| `src/features/laying-planner/index.ts`             | La feature                                                             |
