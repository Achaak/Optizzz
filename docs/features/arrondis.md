# Feature : Nombres arrondis

Cadrée le 2026-10-19 (périmètre, écriture, seuil, défaut choisis par le joueur), recensement fait le même jour sur deux comptes, l'un sur S2 (environ 2 millions de JSN), l'autre sur S5.

## But

Lire d'un coup d'œil les grands nombres du jeu et d'Optizzz : « 1,23M » plutôt que « 1 234 567 ».

## Règles

- **Écriture** : trois chiffres significatifs, virgule française, suffixe collé en majuscule : `12,3K`, `123K`, `1,23M`, `4,51G`. Zéros inutiles ôtés (`10K`, `1,5M`). Un arrondi qui atteint 1 000 passe à l'unité suivante (999 999 → `1M`). `formatCompact` (`src/utils/number-format.ts`).
- **Seuil** : dès 10 000. En dessous, le nombre est écrit en entier (« 9 999 » n'est pas plus long que « 10K »).
- **Éteinte par défaut** (`offByDefault` sur la feature) ; deux sous-options, allumées avec elle : **pages du jeu** et **tableaux et encarts d'Optizzz**.
- **Restent exacts** : les champs, les textes à copier (Discord, plan de la chaîne, bilan des convois), les quantités que le joueur envoie ou pond (attaques du plan de flood et de la chaîne de TDC, surface par chasse, quantités de ponte), les infobulles qui donnent déjà la valeur exacte, les libellés mémorisés (« Chasse 1 250 cm² » des Heures de fin).

## Pages du jeu (sous-option « game »)

Le nombre du jeu reste dans la page, masqué visuellement, et le texte court est dessiné par CSS (`::after { content: attr(data-compact) }`) : `textContent` et `innerText` ne changent pas. Les lecteurs d'Optizzz (`src/game/pages/`), les scripts du jeu (`$('#cout_…').text()` sur la Reine) et le tri des tableaux (`tablesort.js`) lisent toujours le nombre exact, et copier le texte copie le nombre exact. La valeur exacte s'affiche au survol ; là où le jeu a déjà une infobulle (en-tête : « entrepôt rempli à 7% »), elle passe devant son texte.

Seuls les nombres écrits comme le jeu les affiche, avec séparateurs de milliers (« 1 234 567 »), sont pris : les nombres bruts des scripts (`#nb_nourriture` « 208302916.16 », `#armee_initial`, `tps_restant`) n'en ont pas.

La feature passe **en dernier** dans le registre, après les autres features qui lisent la page ; un `MutationObserver` reprend ce que le jeu ajoute plus tard (membres de l'alliance chargés en AJAX).

### Recensement (2026-10-19)

| Page                                   | Grands nombres                                                                                                                                      | Traité                             |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| Toutes (en-tête)                       | `.texte_ligne_boite_info` : ouvrières, nourriture, matériaux, TDC                                                                                   | oui                                |
| `Reine.php`                            | pontes en cours (`table.tableau_leger`), `#unites_restantes_premiere_ponte` ; coûts `#cout_*N` relus par le script du jeu                           | oui, sauf `#cout_*`                |
| `construction.php`, `laboratoire.php`  | coûts (`td.nourriture`, `td.materiaux`, `div.ouvriere`…), « Production actuelle », « Capacité actuelle »                                            | oui                                |
| `Ressources.php`                       | récoltes (`p > strong`), ouvrières au travail, TDC, chasses en cours ; champs `#RecolteNourriture`…                                                 | oui, sauf les champs               |
| `Armee.php`                            | effectifs (`span.cliquable`), vie / attaque / défense (`#detailVie*`…), totaux, troupes en attaque                                                  | oui                                |
| `commerce.php`                         | convois en cours ; champs du formulaire                                                                                                             | oui, sauf les champs               |
| `ennemie.php`                          | TDC des cibles (`#tabEnnemie`), effectifs du formulaire d'attaque (`#tabChoixArmee`) ; champs `#terrain_min`…                                       | oui, sauf les champs               |
| `AcquerirTerrain.php`, `colonies.php`  | effectifs, ressources rapportées                                                                                                                    | oui                                |
| `classement.php`                       | scores (`table.tab_triable`, `tr#ancre`)                                                                                                            | oui                                |
| `classementAlliance.php`, `Membre.php` | scores (`table.simulateur`, `table.tableau_score`), membres ; descriptions écrites par les joueurs (`div.contenuJoueur`)                            | oui, sauf les descriptions         |
| `alliance.php?Membres`                 | TDC, technologie, fourmilière (`#tabMembresAlliance`, rempli en AJAX)                                                                               | oui                                |
| `alliance.php` (chat, forum)           | texte des joueurs                                                                                                                                   | non                                |
| `messagerie.php`                       | rapports de chasse et de combat, butins, convois livrés et reçus (en-têtes, détail chargé en AJAX) ; messages des joueurs (Conversations, Alliance) | oui, sauf les messages des joueurs |
| Simulateurs du jeu (`simulateur*.php`) | champs pilotés par leurs scripts                                                                                                                    | non                                |

**Messagerie** (ajoutée le 2026-10-19) : seules les conversations écrites par le jeu sont abrégées, `tr.en_tete_message` de `data-type` Chasses, Combats ou Commerce (participant « Fourmizzz », relevé sur S2 et S5), avec les lignes de détail qui les suivent jusqu'à l'en-tête suivant. Leur texte est dans un `div.contenuJoueur`, ignoré partout ailleurs (descriptions des joueurs). Un `MutationObserver` sur `#centre` reprend le détail ouvert par le joueur et les dossiers rechargés. Les rapports de chasse et d'attaque d'Optizzz lisent toujours les mêmes valeurs ; le lecteur des titres de convoi (`readConvoyMessages`) lit le texte jusqu'à l'icône précédente, le nombre étant enveloppé.

## Tableaux et encarts d'Optizzz (sous-option « extension »)

`formatAmount` (`src/utils/number-format.ts`) écrit une quantité à lire : courte quand la sous-option est allumée, entière sinon. `formatNumber` reste l'écriture exacte (champs, textes à copier, quantités à envoyer). L'interrupteur est lu une fois par chaque content script et chaque page de l'extension avant de dessiner (`applyCompactNumbers` / `loadCompactNumbers`, `src/features/compact-numbers/index.ts`) ; le content script commun le pose dans la première feature du registre.

Recensement du 2026-10-19 : 240 appels à `formatNumber` / `formatDecimal` dans 57 fichiers. `formatDecimal` (distances, ratios, pourcentages) reste tel quel : ces nombres restent petits. Les axes des graphiques de progression sont courts, leur infobulle exacte.

**Valeur exacte au survol** : `<Amount value={…} />` (`src/utils/Amount.tsx`) dans les vues React (chaîne de TDC, cartes, suivis, statistiques, historique, partage, lanceur de chasse, simulateur, modèles de ponte), `showExactAmount` pour les cellules construites en DOM (Cibles, plan de flood, rapports de chasse, convois livrés et reçus). Un nombre pris dans une phrase n'a pas d'infobulle.

## Code

| Fichier                                                 | Rôle                                                                                   |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `src/utils/number-format.ts` (+ test)                   | `formatCompact`, `formatAmount`, `setCompactNumbers`, `isCompacted`, `showExactAmount` |
| `src/utils/Amount.tsx` (+ test)                         | Une quantité dans une vue React, exacte au survol si abrégée                           |
| `src/features/compact-numbers/game-numbers.ts` (+ test) | Zones des pages du jeu, rapports de la messagerie, remplacement visuel des nombres     |
| `src/features/compact-numbers/index.ts`                 | Les deux features (interrupteur en premier, pages du jeu en dernier)                   |
