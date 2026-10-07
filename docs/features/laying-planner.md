# Feature : Planificateur de ponte

Décidé lors d'une session de cadrage (`/grill-me`) le 2026-10-07. Voir aussi `roadmap.md`.

## But

Savoir, en tapant un nombre sur la Reine, quand la ponte finira, quand on pourra la payer et ce qu'elle coûtera chaque jour, et pondre le maximum payable sans calcul.

## Comportement

- **Où** : sur `Reine.php`, sous le coût de chaque unité pondable (cellule `td.cout_amelioration`, hors du formulaire du jeu). Recalculé après chaque frappe, une fois que le jeu a mis à jour son coût (`maj_cout_ponte`), et quand la destination change.
- **Pour le nombre tapé** (lu dans `nombre_de_ponte`, donc « 2k » vaut 2 000) :
  - « fin demain 2 h 10 · payable maintenant » / « payable dans 3 h 10 (aujourd'hui 21 h 15) » / « dépasse l'entrepôt de nourriture » / « jamais payable au rythme actuel ». Durée et nourriture : celles affichées par le jeu (bonus compris). La ponte est payée à la commande, puis attend la fin de la file en cours.
  - Unités : « entretien +38 / jour · bilan +1 200 / jour » (5 % du coût par jour sur le TDC, 10 % dans la Fourmilière, 15 % dans la Loge), en rouge si le bilan devient négatif.
  - Ouvrières : « 120 sans travail (TDC 4 496) » au-delà d'une ouvrière par cm².
- **« max »** : met dans le champ du jeu le plus grand nombre payable maintenant, ou dans 1 / 3 / 6 / 12 h, et laisse le jeu recalculer. Ne lance jamais la ponte.
- **Données** : stock (en-tête), revenus de `Ressources.php` (cache des Prévisions de ressources, relu s'il a plus de 15 min), capacités d'entrepôt mémorisées, file de ponte de la page.

## Code

| Fichier                                          | Rôle                                             |
| ------------------------------------------------ | ------------------------------------------------ |
| `src/features/laying-planner/laying.ts` (+ test) | Lignes de ponte, commande, plan, maximum payable |
| `src/features/laying-planner/mount.ts` (+ test)  | Affichage sous le coût, bouton « max »           |
| `src/features/laying-planner/index.ts`           | La feature                                       |
