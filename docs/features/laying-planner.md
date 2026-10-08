# Feature : Planificateur de ponte

Décidé lors d'une session de cadrage (`/grill-me`) le 2026-10-07. Voir aussi `roadmap.md`.

## But

Savoir, en tapant un nombre sur la Reine, quand la ponte finira, quand on pourra la payer et ce qu'elle coûtera chaque jour, et pondre le maximum payable sans calcul.

## Comportement

- **Où** : sur `Reine.php`, sous le coût de chaque unité pondable (cellule `td.cout_amelioration`, hors du formulaire du jeu). Recalculé après chaque frappe, une fois que le jeu a mis à jour son coût (`maj_cout_ponte`), quand la destination change, et dès que le jeu réécrit son coût (`cout_nombre`, `cout_nourriture`, `cout_temps`, suivis par un `MutationObserver`) : le curseur jQuery UI du jeu et les champs « Changer la Durée » / « Changer le Coût » ne passent pas par le champ texte.
- **Pour le nombre choisi** (lu dans `nombre_de_ponte`, que le jeu tient à jour quel que soit le moyen : « 2k » vaut 2 000 ; champ vide et 1 = rien de choisi encore) :
  - « fin demain 2 h 10 · payable maintenant » / « payable dans 3 h 10 (aujourd'hui 21 h 15) » / « dépasse l'entrepôt de nourriture » / « jamais payable au rythme actuel ». Durée et nourriture : celles affichées par le jeu (bonus compris). La ponte est payée à la commande, puis attend la fin de la file en cours.
  - Unités : « entretien 38 / jour · bilan +1 200 / jour » (5 % du coût par jour sur le TDC, 10 % dans la Fourmilière, 15 % dans la Loge) ; seul le bilan passe en rouge s'il devient négatif.
  - Ouvrières : « 120 sans travail (TDC 4 496) » au-delà d'une ouvrière par cm², ouvrières déjà dans la file de ponte comprises.
- **« max »** : met dans le champ du jeu le plus grand nombre payable maintenant, ou dans 1 / 3 / 6 / 12 h, et laisse le jeu recalculer. Pour les ouvrières, jamais plus qu'une par cm² de TDC, file de ponte comprise (les autres ne récolteraient rien). Ne lance jamais la ponte.
- **Données** : stock (en-tête), revenus de `Ressources.php` (cache des Prévisions de ressources, relu s'il a plus de 15 min), capacités d'entrepôt mémorisées, file de ponte de la page. Les plans sont calculés à l'heure de lecture de la page : laissée ouverte, seul ce qui est relatif à maintenant avance (« payable dans … »). Revenus illisibles : une ligne « Prévisions de ponte indisponibles » sous la première unité.

## Code

| Fichier                                          | Rôle                                             |
| ------------------------------------------------ | ------------------------------------------------ |
| `src/features/laying-planner/laying.ts` (+ test) | Lignes de ponte, commande, plan, maximum payable |
| `src/features/laying-planner/mount.ts` (+ test)  | Affichage sous le coût, bouton « max »           |
| `src/features/laying-planner/index.ts`           | La feature                                       |
