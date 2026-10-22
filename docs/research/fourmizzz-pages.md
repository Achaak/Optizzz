# Pages du jeu : structure et sélecteurs

Relevés en direct sur S5 le 2026-10-07 (compte connecté, via Claude in Chrome). Les fixtures de test (`apps/extension/src/features/*/__fixtures__/`) reproduisent cette structure avec des pseudos fictifs : le HTML brut n'est pas copié car les liens contiennent des jetons de session.

## Serveur et URL

- Le jeu tourne sur `https://s5.fourmizzz.fr/…` ; `www.fourmizzz.fr` n'est que l'accueil.
- Certains serveurs s'ouvrent en `http://` (s1 relevé en `http://s1.fourmizzz.fr`) : ne pas supposer `https`.
- Les liens d'action portent un jeton `t=` (`construction.php?Construire=9&t=…`) : recharger une page ouverte par un tel lien peut relancer l'action.
- `alliance.php` sans paramètre affiche le chat d'alliance.

## Menu (toutes les pages)

- `nav#menu` > `ul#menu_horizontal` (Fourmilière, Alliance, Communauté, Compte +, Aide) + des colonnes `ul.menu_colonne`.
- Menu d'alliance : `ul#menuAlliance.menu_colonne`, une `li > a.bouton<Nom>` par entrée : `boutonChat` (`alliance.php`), `boutonForum` (`?forum_menu`), `boutonMembres` (`?Membres`), `boutonCandidature` (`?voirCandidature`), `boutonMC` (`?messCollectif`), `boutonDiplomatie` (`?Diplomatie2`), `boutonDescription` (`?Description`), `boutonOptions` (`?Options`).
- Absent quand le joueur n'a pas d'alliance.
- Menu Fourmilière : `ul#menuFourmiliere.menu_colonne`, de `boutonReine` (`Reine.php`) à `boutonMaFourmiliere` (`fourmiliere.php`), le dernier (relevé le 2026-10-09 sur S5).
- Barre du haut : `#menu` (`position: fixed`, `z-index: 20000`, 30 px de haut). Onglets `ul#menu_horizontal li` à `width: 19.9%` (en ajouter un fait passer à la ligne) ; `ul#menu_horizontal` a `margin-right: 45px` pour `a#boutonDeconnexion` (`position: absolute; right: 0; width: 45px`). Optizzz y place ses boutons dans un `div.optizzz-menu-bar` à `right: 45px` et élargit la marge de 45 px par bouton ; sur téléphone (< 41em, où le jeu rétrécit déjà ses onglets), ils se replient derrière un seul bouton « … » qui les déroule avec leur nom (`apps/extension/src/utils/menu-bar.ts`).
- Autres liens utiles : `boutonSimulateurDuree` → `simulateurDuree.php`, carte du jeu `carte2.php` (vue isométrique).

## En-tête du joueur

- `#pseudo` : pseudo du joueur connecté (texte seul).
- `a.titre_ressource` : « S5 Formica » (serveur + pseudo).
- **`div#data`** (caché, présent avec ou sans Compte+) : valeurs brutes, sans séparateur de milliers. `#nb_ouvrieres`, `#nb_materiaux`, `#nb_nourriture` (décimal : « 2883.1475837896 », la nourriture évolue en continu), `#quantite_tdc`, `#tag_alliance`, `#pseudo`. Source à préférer pour les stocks.
- `#boiteInfo #tableau_boite_info` : une `td.tooltip_boite_info` par ressource (ligne 1 ouvrières, 2 nourriture, 3 matériaux, puis `td#boite_info_tdc`), chacune `a.ligne_boite_info > div.jauge, img, div.texte_ligne_boite_info` ; boîte large de 210 px ; texte dans `.texte_ligne_boite_info`, jauges `div.jauge > div.jauge_nourriture` / `.jauge_materiaux` (`style="width:7%"`), titre « Votre entrepôt de nourriture est rempli à 7% ». Les capacités ne sont pas dans l'en-tête (voir `construction.php`). L'infobulle est celle de jQuery UI (`mouseover` / `focusin` sur la cellule et sur `document`) : elle prend le `title` de l'élément survolé et l'affiche en texte sans retours à la ligne.
- `#boiteComptePlus` existe **aussi sans Compte+** (encart publicitaire) : sa présence ne prouve pas le Compte+. Avec Compte+ : `#ligne_ponte` (`#temps_ponte`), `#ligne_construction` (`#temps_construction`), `#ligne_recherche`, `#ligne_chasse` (`#temps_chasse`), `#ligne_attaque`, `#ligne_convoi`. Minuteurs `resteTemps(<secondes>, "id")` ; infobulle jQuery UI listant la file (« Champignonnière | 14h16 »).
- Les anciens sélecteurs `.plein` et `.production_nourriture` n'existent plus.

## alliance.php?Membres

- Contenu : `div#centre > div#alliance > center > table.simulateur … table#tabMembresAlliance`.
- **`#alliance` est vide dans le HTML initial** : le jeu le remplit en AJAX après le chargement (xajax, `xajax_membre`) en **remplaçant son contenu**. Conséquences : attendre `#tabMembresAlliance` (MutationObserver) avant de le lire, et ne jamais monter d'UI à l'intérieur de `#alliance` (elle serait écrasée) — la carte est montée juste avant.
- Colonnes de `#tabMembresAlliance` (une ligne d'en-tête `tr.alt` de `th`) :

| Index cellule | Contenu                                               |
| ------------- | ----------------------------------------------------- |
| 1             | Rang dans le classement de l'alliance                 |
| 2             | Rang (grade) dans l'alliance                          |
| 3             | Pseudo : `a[href^="Membre.php?Pseudo="]`              |
| 5             | Terrain (TDC), séparateur de milliers espace          |
| 7             | Technologie                                           |
| 8             | Fourmilière                                           |
| 9             | État : `img` (`1rondvert.gif` = actif cette semaine…) |

- Légende : actif, inactif 3 j, inactif 10 j, en vacances, banni, colonisé.
- Tri côté client par `script/tablesort.js` (fdTableSort : `th.sortable-numeric fd-column-N > a.fdTableSortTrigger`) : il déplace les lignes entières, une cellule ajoutée en fin de ligne suit (relevé le 2026-10-15). La ligne compte 12 cellules, la dernière vide.

## construction.php

- Une ligne par bâtiment : `tr.ligneAmelioration` à 4 `td` :
  1. photo (`div.photo_batiment`) ;
  2. `td.desciption_amelioration` (sic) : `h2` (nom), `span.niveau_amelioration` (« niveau 8 », ou « niveau 8 -> 9 » quand le niveau 9 est en chantier ou en file), description `div#descriptionCompleteN`. Bâtiment verrouillé : petit tableau « Requis: » avec `a.verificationOK` / `a.verificationNonOK`.
  3. `td.cout_amelioration > table` : `tr[title="Temps de Construction"] td.temps` (« 1H 25m 54s », H majuscule), `tr[title="Materiaux"] td.materiaux` (« 12 348 », `.rouge` si le stock manque). **Compte+ seulement** : `tr[title="Temps pour récolter les matériaux manquants"]` (horloge, « 1h 18m », h minuscule), calculé par paquets de récolte.
  4. action : `div.icone_construction > a[href*="Construire=<id>"]` (payable), `div.bouton_gris > img[title="Matériaux insuffisants"]`, ou `td` vide (prérequis manquant, ou file pleine).
- **Les bâtiments ne coûtent que des matériaux.**
- Quand un niveau est en chantier ou en file, la ligne affiche déjà le coût et la durée **du niveau d'après**.
- Descriptions utiles : Champignonnière « Production actuelle: 5 022 nourriture par jour. Production au niveau 9: 8 538 nourriture par jour. » ; entrepôts « Capacité actuelle: 38 900 » / « Capacité au niveau 6: 77 300 ».
- Ids vus : Champignonnière = 3, Entrepôt de Nourriture = 9.

### Chantiers en cours (constructions et recherches)

Directement dans `div#centre`, avant `div.Bas` et le tableau, une ligne par élément, sans conteneur ni id. Même balisage pour l'élément en cours et ceux en file d'attente (Compte+) ; seul l'ordre les distingue :

```html
<strong
  >- Champignonnière 9 se termine dans : <span id="batiment_1791375374">1 heure 24 minutes 59 secondes</span>
  <script>
    reste(5121, "batiment_1791375374");
  </script>
  - <a href="construction.php?annuler=…&t=…">Annuler</a></strong
>
<br /><small><em>Terminé à 14h16</em></small
><br /><br />
```

- Laboratoire : `- Architecture 1 terminé dans: <span id="recherche_…">…` (texte différent), `reste(189, "recherche_…")`, puis `Terminé à 13h06`. Ligne du tableau : « niveau 0-> 1 » (sans espace avant la flèche).
- Le nombre dans `reste(<s>, …)` = secondes jusqu'à la fin ; il est **cumulé le long de la file** (le 2ᵉ élément finit après le 1ᵉʳ).
- Le niveau affiché est le niveau cible.
- Un élément mis en file est **payé tout de suite**.
- File pleine (2 constructions vues, nombre de places non confirmé) : toutes les cellules d'action sont vides. Avec une place libre, les boutons restent.
- Files des constructions et des recherches indépendantes.
- « Annuler » : lien `?annuler=<id>&t=…` sans `onclick` ; d'après le joueur, le jeu demande une confirmation (sans doute une page serveur, non relevée).

## laboratoire.php

- Une recherche = `tr.ligneAmelioration > td.desciption_amelioration` (sic) contenant `h2` (nom) + `span.niveau_amelioration` (« niveau N »).
- Coût : `td.cout_amelioration table` avec `div.icone_X` + `div.X`, X dans l'ordre `temps`, `ouvriere`, `nourriture`, `materiaux` ; valeurs avec espace final (« 3 000 »). **Une recherche coûte ouvrières + nourriture + matériaux.**
- Action : `div.icone_recherche > a[href*="Rechercher=<id>"]` (ids : Architecture = 10, Communication avec les animaux = 4), `div.bouton_gris > img[title="Ressources insuffisants"]` (sic), ou `td` vide. Pas de ligne « temps pour récolter », même avec Compte+.
- Recherches : Technique de ponte, Bouclier Thoracique, Armes, Architecture, Communication avec les animaux, Vitesse de chasse, **Vitesse d'attaque**, Génétique, Acide, Poison.
- Bâtiments (`construction.php`, même structure) : Champignonnière, Entrepôt de Nourriture, Entrepôt de Matériaux, Couveuse, Solarium, Laboratoire, Salle d'analyse, Salle de combat, Caserne, Dôme, Loge Impériale, Etable à pucerons, Etable à cochenilles (relevé sur s5).
- Un `fetch('/laboratoire.php')` depuis une page du jeu renvoie la page complète (session par cookie).

## Étables et Communication avec les animaux

Relevé le 2026-10-19 sur S5 (`construction.php`, `laboratoire.php`) et recoupé avec Toolzzz (`toolzzz.fr/couts.php`, qui donne des coûts cumulés : le coût d'un niveau est la différence entre deux niveaux qui se suivent).

- **Communication avec les animaux** : « Effet: Permet la création des étables à pucerons et à cochenilles. » Elle ne débloque rien d'autre : aucune unité de `Reine.php`, aucune autre ligne « Requis » des deux pages ne la cite. Niveau N : (80 ouvrières, 200 nourriture, 500 matériaux) × 2^(N−1) (niveau 8 : 10 240 / 25 600 / 64 000), et demande Laboratoire N.
- **Étable à pucerons** (matériaux seulement) : 1 500 × 2^(N−1) (niveau 6 : 48 000). Le niveau N demande **Communication N + 2** (Étable 6 : « Requis:Communication avec les animaux niveau 8 »). Toolzzz ajoute un Entrepôt de matériaux d'environ N, que la page ne montre pas sur S5 (déjà atteint).
- **Étable à cochenilles** : 10 000 × 2^(N−1). Le niveau N demande **Communication N + 9** (niveau 1 : Communication 10).
- Tutoriel des constructions : l'Étable à pucerons « augmente la capacité de transport des fourmis de 1% lors des pillages et de 5% lors du commerce à chaque niveau » ; elle ajoute aussi 1 % à la taxe des colonies (`ressources-et-entretien.md`).
- La ligne « Requis » montre ce que demande le **niveau suivant** seulement.

## Temps des chantiers

- **Architecture** (construction) et **Salle d'analyse** (recherche) : chaque niveau multiplie le temps par 0,9 (« réduit de 10 % par niveau » s'entend du temps courant), déduit le 2026-10-16 sur S5 des temps du niveau 0 qui retombent alors sur des valeurs rondes. Architecture 7 (0,9⁷ = 0,478) : Étable à cochenilles 72 s (150), Caserne 96 s (200), Dôme 3m 11s (400), Loge Impériale 3m 59s (500). Salle d'analyse 3 (0,9³ = 0,729) : Génétique 2m 11s (180), Acide 2H 1m 30s (10 000 exactement), Poison 10H 7m 30s (50 000 exactement). Les lectures `1 / (1 + 0,1 n)` et `1 − 0,1 n` ne donnent pas de valeurs rondes.
- Les temps affichés incluent déjà le bonus du joueur.
- D'un niveau au suivant, le temps (hors bonus) est multiplié par **1,6 pour un bâtiment** et **1,7 pour une recherche** : durées par niveau de Toolzzz (`toolzzz.fr/couts.php`, différences des « Durée totale »), recoupées sur S5 le 2026-10-16 (Architecture 8 : 8 207 s × 0,9³ = 1H 39m 43s affiché ; Bouclier Thoracique 5 : 1 003 s × 0,729 = 12m 11s ; Salle d'analyse 4 : 1 229 s × 0,9⁷ = 9m 48s). Les coûts doublent d'un niveau au suivant, sauf la **Champignonnière** : × 1,85, arrondi à chaque niveau (90, 167, 308, 570… matériaux ; « Coût total » de Toolzzz, relevé le 2026-10-17 sur les 50 niveaux, rapport constant).
- **Paliers de durée** (Toolzzz, relevé le 2026-10-17, pas encore vérifié dans le jeu) : le × 1,6 / × 1,7 ne vaut que tant qu'un niveau dure moins de **30 jours** (2 592 000 s hors bonus) ; au niveau suivant, le facteur tombe à **× 1,3** (vrai pour les 23 bâtiments et recherches). Plus haut, il tombe encore à **× 1,2** puis **× 1,12**, à des niveaux qui ne suivent pas une durée seuil commune (Architecture : × 1,3 au niveau 20, × 1,2 au 29, × 1,12 au 35 ; Champignonnière : 24, 32, 38 ; Acide : 13 et 29, sans × 1,12). Optizzz compte encore × 1,6 / × 1,7 partout : les durées sont surestimées au-delà de ces niveaux.

## Ressources.php

- Ouvrières : `input#RecolteNourriture`, `input#RecolteMateriaux` (`type="tel"`, valeurs avec espaces « 4 004 »), bouton `#ChangeRessource` (`ChangeRessource=Valider`, `POST /Ressources.php`). Compte+ : radios `input[name=choixOuvriere]` (`nourriture` / `materiaux` / `rien`) = où vont les nouvelles ouvrières ; sans Compte+ elles restent sans travail.
- Le `<form>` des ouvrières est mal imbriqué dans `table#boite_ouvriere` : `#ChangeRessource.form` le retrouve, mais `closest("form")` ne trouve rien. Ne rien placer par rapport au formulaire.
- `#ouvrieresAuTravail` (« 4 004 »), `#pourcentageTdcUtil`. Récoltent : min(TDC, ouvrières).
- Prochain retour des ouvrières : `#retour_ouvrieres` + `reste(977, "retour_ouvrieres")` (secondes).
- Résumé **par jour**, dans le `p` contenant « Chaque jour ». Entre un `<strong>` et son icône, il peut y avoir un nœud texte vide : lire le texte qui suit jusqu'au `<strong>` suivant. Avec Compte+, la page n'a pas de `var champi` :

```html
Chaque jour, vous récoltez <strong id="nbNourriture">0 </strong> et <strong id="nbMateriaux">192 192 </strong> sur votre
terrain <br />et <strong>5 022</strong> avec votre champignonnière. <br /><br />Pendant ce temps, votre armée consomme
<strong>1 704</strong>.
<!-- joueur colonisé seulement : -->
<br />et <a href="Membre.php?Pseudo=…">…</a> vous pille <strong id="nbNourritureMaitre">871 438 </strong> et
<strong id="nbMateriauxMaitre">525 060 </strong>.
```

- Script de la page : `var pourcentagePillage = 43;` (colonisé), `var champi = 1721321.5369…;` (valeur exacte), `var terrain`, `var nbOuvrieres`.
- Chiffres **avant taxe** ; la consommation de l'armée **inclut les troupes en déplacement**. Voir `ressources-et-entretien.md`.
- Chasses en cours, après `span.titre` « Chasse en cours » : `- Vos chasseuses vont conquérir 122 cm² dans <span id="chasse_139778">…</span><script>reste(1090, "chasse_139778");</script>`. Compte+ seulement : `<small><em>Troupes en chasses : 1 975 Jeunes Soldates Naines, 124 Soldates Naines.<br>Arrivée à 12h39</em></small>`. Un bloc par chasse, dans `#boite_tdc` ; revu le 2026-10-09 sur S5 (« 3 405 Jeunes Soldates Naines, 364 Soldates Naines, 15 Naines d’Elites. »). Sans Compte+, les troupes en chasse ne sont écrites nulle part (`Armee.php` ne les montre pas non plus).

## fourmiliere.php (Ma Fourmilière)

- Relevé le 2026-10-09 sur S5 : `div#centre > center > div` (`position: relative`, 760 × 750 px) : l'image de la fourmilière, une `table.boite_amelioration#messageN` par bâtiment (description au survol) et une `map`. Aucun niveau lisible. Optizzz masque ce `center` pour afficher « Mon état » (`#etat`).

## Reine.php

- Fiche de chaque unité : `h2` du nom, et devant lui vie / dégâts en attaque / dégâts en défense (« 8 3 2 » pour la JSN). Valeurs reprises dans `combat.md`.

Relevé le 2026-10-07 sur s5 (sans Compte+).

- « Pontes en cours » : `h4` « Pontes en cours: » puis `table.tableau_leger`. En-tête Unités | Garnison | Temps requis | Temps total restant, puis une ligne par ponte, dans l'ordre de la file.
- Unités : texte de la première case (« 100 ouvrières », « 65 Jeunes Soldates Naines ») ; pour la première ponte, `span#unites_restantes_premiere_ponte`, décompté par `reste_unite(<s>, "unites_restantes_premiere_ponte", "<nom>", "<nombre>")`.
- Temps total restant : `span#ponte_<n>` + `reste(<s>, "ponte_<n>")`, **cumulé le long de la file**. La première ligne a aussi `span#temps_restant_premiere_ponte` (même valeur) dans « Temps requis » ; les suivantes y ont un texte fixe.
- Les scripts `reste()` sont regroupés après le tableau.
- Ponte (relevé le 2026-10-07) : un `form[action="Reine.php"]` par unité pondable, dans `td.cout_amelioration` ; le champ est dans un tableau imbriqué (`form > table > td.cout_ponte > div > input`). Suffixe des identifiants : vide pour l'ouvrière, `N` pour `uniteN`. Champs : `input#input_cout_nombreN` (`type="tel"`, accepte « 2k », « 0.1M »), cachés `typeUnite` (`ouvriere` / `uniteN`), `nombre_de_ponteN` (le nombre lu par le jeu), `destinationN` (1 Terrain, 2 Dôme, 3 Loge ; `span#texte_destinationN` la fait tourner au clic). À chaque frappe, `maj_cout_ponte(N)` (`onkeyup`) met à jour `#cout_nombreN`, `#cout_tempsN` (« 1J 3h », bonus compris) et `#cout_nourritureN` ; champ vide = coût d'une unité. **Relevé le 2026-10-08** : le nombre se règle d'abord avec un curseur jQuery UI (`div#sliderN`) ; `input#input_cout_nombreN` est masqué (`display: none`) et n'apparaît qu'au clic sur le nombre (`span#bouton_cout_nombreN`, « Changer la Quantité »), de même que `input#input_cout_tempsN` (« Changer la Durée ») et `input#input_cout_nourritureN` (« Changer le Coût »). Le curseur et ces champs ne changent que `nombre_de_ponteN` et les `span#cout_*N`, jamais `input_cout_nombreN` : `nombre_de_ponteN` vaut 1 tant que rien n'est choisi. Une unité verrouillée a **aussi** un `form` avec `typeUnite` (relevé le 2026-10-16 sur S5), mais sans `input#input_cout_nombreN` ni bouton « Pondre » : seulement son coût, et « Requis » dont l'exigence manquante est en `span.verificationNonOK` (remplie : `verificationOK`).
- Calcul du jeu (relevé le 2026-10-09 sur S5) : durée d'une unité = `temps_ponte_base × vitesse` secondes, où `temps_ponte_base` vaut 60 pour l'ouvrière et `tcaste[N-1]` pour `uniteN` (`tcaste` = 300, 450, 570, 740, 1000, 1410, 1440, 1520, 1450, 1860, 2740, 2740, 2150, 1560 ; `ncaste` = nourriture, 5 pour l'ouvrière), et `vitesse` est écrite en dur dans le script en ligne de la page (`temps_ponte_base*0.10941898913151` : bonus du joueur compris). Ce bonus vaut 0,9 puissance (Couveuse + Solarium + Technique de ponte) : chacune « accélère la vitesse de ponte de 10 % à chaque niveau » (relevé le 2026-10-17 sur S5 : 11 + 9 + 9 = 29 niveaux, 0,9²⁹ = 0.047101286972462, la valeur du script). Le temps affiché est arrondi (« 33s » pour 32,8 s ; « 6.57s » avec des décimales). Le curseur va jusqu'au plus petit de « toute la nourriture » et « 7 jours de ponte » (`trouver_max_ponte`). Taper dans `input_cout_nombreN` puis `keyup` (`maj_cout_ponte` → `maj_ponte` → `maj_slider`) remet aussi le curseur en place.
- Jeton (relevé le 2026-10-18 sur S5) : chaque `form[action="Reine.php"]` envoie aussi un champ caché `t` (4 caractères), le même pour les 13 formulaires de la page. Limite de la file de ponte : rien ne l'affiche, pas encore relevée. Relevé le 2026-10-18 sur S2 (Modèles de ponte) : le POST `unePonte=oui`, `typeUnite`, `t`, `input_cout_nombreN`, `nombre_de_ponte`, `destination` met la ponte en file et renvoie la page Reine avec une ligne de plus ; une ponte de la même unité et de la même garnison que la dernière ligne n'est **pas** fusionnée avec elle (trois lignes, dont deux de plus de 6 jours).
- Cellule voisine `td.desciption_amelioration` (environ 655 px de large) : nom, description, « Requis » ; c'est là qu'Optizzz monte le planificateur.

## Colonne de gauche (toutes les pages)

- `div#menuBoite` (position fixe, 250 × 500 px) contient `#boiteComptePlus.boite_compte_plus` (absolu, `top: 200px`), `#data` et `#boiteInfo.boite_info` (absolu, `top: 20px`), placés à `left: 65px`.
- Une boîte : `.titre_colonne_cliquable` (25 px, fond `sprite_menu.png`, texte `rgb(211, 217, 184)` 16 px centré) puis `.contenu_boite_compte_plus` / `.contenu_boite_info` en absolu à `top: 25px`, 220 px de large.
- Sans Compte+, `#boiteComptePlus` n'a qu'un texte publicitaire ; avec, des lignes `#ligne_*`.

## Décomptes

- Le jeu met à jour un `<span id>` par un script `reste(<secondes>, "<id>")` placé à côté (ou regroupé plus loin). Vus : `retour_ouvrieres`, `chasse_<n>` (Ressources), `ponte_<n>`, `temps_restant_premiere_ponte` (Reine), `batiment_<n>`, `recherche_<n>` (Construction, Laboratoire). La boîte Compte+ utilise `resteTemps(…)`.
- Le jeu donne parfois l'heure lui-même après la ligne : « Arrivée à 12h39 » (chasse, Compte+), « Terminé à 13h06 » (recherche).
- Le 2026-10-07, aucune attaque ni aucun convoi en cours : `Armee.php` et `commerce.php` sans `reste()`.

## classementAlliance.php (classement et page d'une alliance)

Relevé le 2026-10-16 sur S5.

- **Sans paramètre** : redirige vers `classement.php?type_classement=alliance_total` (relevé le 2026-10-22 sur S5), voir plus bas.
- Optizzz lit le tag de chaque ligne du classement (lien `classementAlliance.php?alliance=TAG`) pour y ajouter la colonne « Graphique » (`statistiques-alliance.md`), pas ses scores.
- **`?alliance=TAG`** (tag sans la casse : `xyz` = `XYZ`) : la page publique d'une alliance. Dans `#centre` : `h2` = nom de l'alliance, `div.contenuJoueur` (description), puis des `center` :
  - `<h2>Classement</h2>` suivi de `table.simulateur.tab_triable` : en-tête `th` vide | Score | Classement, puis une ligne par score, `<td>Terrain|Fourmilière|Technologie|Combat|Membres</td><td>2 545 127</td><td>1</td>`. Valeurs en direct (elles bougent d'une minute à l'autre), rangs du jeu ;
  - `<h2>Les membres de l’Alliance</h2>` et `table#tabMembresAlliance` (RANG | grade | PSEUDO | TERRAIN | TECHNOLOGIE | FOURMILIERE) ;
  - `<h2>Diplomatie</h2>` : pactes avec leur type, guerres.
- **Tag inconnu** : la page répond quand même, avec un `h2` vide et des scores à 0 (rangs en dernier). Le `h2` vide signale l'absence de l'alliance.

## classement.php (classements des joueurs et des alliances)

Relevé le 2026-10-22 sur S5. Fixture réduite : `packages/game/src/pages/__fixtures__/alliances-ranking.html`.

- **Une seule page pour les deux classements** : sans paramètre, celui des joueurs (`h2` « Classements des Joueurs », Rang | Pseudo | Terrain | Fourmilière | Technologie | Trophées, et **un lien `classementAlliance.php?alliance=TAG` par ligne**, l'alliance du joueur) ; `?type_classement=alliance_total` (ou `alliance_moyenne`) celui des alliances. Seul le menu `select#type_classement` les distingue : absent chez les joueurs, `alliance_total` / `alliance_moyenne` chez les alliances.
- Dans `#centre` : `<h2>Classements des Alliances</h2>`, puis un cadre `table.simulateur` dont l'unique cellule contient :
  - un formulaire de recherche (POST vers `classementAlliance.php`, `input#pseudoJoueur`) ;
  - `div#formulaire_classement` : `select#type_classement` (Total des Points, Moyenne par Joueur), `select#league` (Toutes, -30, -20, -10 joueurs, 1 joueur), `select#critere` (`terrain`, `construction` = Fourmilière, `technologie`, `elo` = Trophées, `membre`) ;
  - `div#page` (masqué, numéro de page), `span.zone_liste_page` (une `div.bouton_page` par page ; S5 n'en a qu'une, 75 alliances) ;
  - `div#zone_message` : « Votre alliance est 18<sup>e</sup> en Terrain » (cliquable, fait défiler jusqu'à `#ancre`) ;
  - `div#zone_classement` > `table.tab_triable` : en-tête `tr.alt` de `th` (Rang | Alliance | Terrain | Fourmilière | Technologie | Trophées | Membres ; les `th` de score ont `class="bouton_classement cliquable2"` et pour `id` la valeur du critère, celui choisi souligné), puis une ligne par alliance, `<td>1</td><td><a href="classementAlliance.php?alliance=V">V</a></td><td>6 195 861</td>…`. Lignes alternées `alt` ; un pacte ajoute `pacte_<n>` ; mon alliance `class="alt monAlliance" id="ancre"` en gras ;
  - le même `span.zone_liste_page` sous le tableau.
- **Tout passe par AJAX, l'URL ne change pas** : changer un menu, cliquer un `th.bouton_classement` ou une `div.bouton_page` appelle `classement.php?changer_classement=ok&type_classement=…&league=…&critere=…&page=…`, qui répond en JSON (`formulaire_classement`, `liste_page`, `message_classement`, `tableau_classement`) ; le script de la page remplace le contenu de `#formulaire_classement`, `.zone_liste_page`, `#zone_message` et `#zone_classement`. Ce qu'on ajoute au tableau disparaît donc à chaque changement.
- Les valeurs sont celles du classement, moins fraîches que la page d'une alliance (V : 2 167 103 de Terrain ici quand sa page affichait 2 541 586, le 2026-10-16).

## colonies.php et profil

- Colonisé : `div.simulateur` avec `<h2>Vous êtes colonisés par …</h2>`, la force d'occupation, un lien « Déclencher une rebellion ».
- Relevé le 2026-10-19 sur S2 (colonisé et maître d'une colonie) : le bloc du maître est `#centre > center > div.simulateur` : `<h2>Vous êtes colonisés par X</h2>`, « Des fourmis obéissant à `<a href="Membre.php?Pseudo=X">` occupent votre fourmilière… », « La force d'occupation est composée de<br>Aucune troupe<br> », `<strong><a href="ennemie.php?rebellion">Déclencher une rebellion</a></strong>`.
- Mes colonies : une `div.caseColonie` par colonie, directement dans `#centre`, après le `center` : `<h4>Nom de la colonie: <strong><a href="Membre.php?Pseudo=C">C</a></strong></h4>`, puis `<p> Troupes présentes:<br>10 Jeunes Soldates Naines<br><br> <a href="colonies.php?retour=<id>&t=<jeton>">Rappeler l'armée</a> - <a href="colonies.php?liberation=<id>&t=<jeton>"> Libérer la colonie</a></p>`, puis `<p>Cette colonie vous appartient depuis 24m 42s <br> Elle vous a rapporté <span class="sur_une_ligne">0</span> nourriture et <span class="sur_une_ligne">0</span> matériaux</p>`. Plusieurs unités : sans doute une par ligne (non vu). Les troupes qui occupent une colonie ne sont pas dans la garnison d'`Armee.php`. Lu par `readColonies` (`packages/game/src/pages/colonies.ts`).
- `Membre.php` : ligne « Etat : » → « Fourmilière libre » ou « Fourmilière soumise par <a href="Membre.php?Pseudo=X">X</a> » (relevé le 2026-10-16 sur S5). Suivent « Nombre de Colonie : », « Localisation : », « Distance : », « Temps de trajet : », dans le même tableau (sans classe) de la première `div.boite_membre`.
- `Membre.php` (relevé le 2026-10-08 sur S5) : `div#centre > center > h2` = pseudo du joueur affiché, puis `div.boite_membre` « Informations » contenant `table.tableau_score` : une ligne par score, `<td>Terrain|Fourmilière|Technologie|Combat</td><td>valeur</td><td>classement</td>`. Fourmilière et Technologie = `buildingScore` et `technologyScore` de l'export, plus frais que lui ; Combat = sans doute `trophyScore`. Deuxième `div.boite_membre` : « Action ».

## Armee.php

- La ligne « Consommation Journalière » est bien dans le HTML du jeu (relevé le 2026-10-16 sur S5, page lue en `fetch`, sans extension) ; elle ne compte que la garnison.
- Attaques en cours (relevé le 2026-10-08 sur S2) : après la garnison, `<h3>Attaque(s) en cours</h3>` puis une ligne par attaque, sans conteneur : `- Vous allez attaquer <span class="gras"><a href="Membre.php?Pseudo=X">X</a>(<a …>TAG</a>)</span> dans <span class="gras" id="attaque_<n>">9 minutes 7 secondes</span><script>reste(559, "attaque_<n>");</script><br>`. Une attaque annulée disparaît de la liste. Relevé le 2026-10-17 sur S5 : un temps après l'envoi, la ligne porte ` - <a href="/Armee.php?annuler=<id>">Annuler</a>` juste après le `<script>reste(…)</script>`, avant le `<br><small>` (absent sur les attaques plus anciennes). Relevé le 2026-10-16 sur S5 (Compte+) : le lieu suit la cible, `</span> (Terrain de chasse) dans <span id="attaque_<n>">` (« Fourmilière » aussi), et chaque ligne est suivie de `<br><small><em>Troupes en attaques : 1 488 Jeunes Soldates Naines, 485 Soldates Naines, 29 Naines d’Elites.<br>Arrivée à 19h54</em></small><br><br>` (« Naines d’Elites » avec un s). Le tout dans `#centre > center`, après la garnison, jusqu'à la fin du `center`. Retour des troupes d'une colonie (relevé le 2026-10-19 sur S2, après « Rappeler l'armée » sur `colonies.php`) : sous le même titre, `- Des renforts arrivent dans <span id="attaque_<n>">42m 36s </span><br><script>reste(2556, "attaque_<n>");</script>` : ni cible ni classe `gras`, le `<br>` avant le script ; avec Compte+, suivi de `<small><em> Troupes en renforts :  10 Jeunes Soldates Naines.<br>Arrivée à 12h57</em></small><br/><br />`. Les troupes ne sont plus dans la colonie ni encore dans la garnison.
- « Troupes en Garnison » : `.simulateur` avec en-tête Unités | Terrain de Chasse | Dôme (niveau) | Loge (niveau), chaque lieu sur 3 colonnes (`colspan=3`) ; une ligne par unité (nom + abréviation), une case vide quand l'effectif est nul. Lignes Vie / Dégâts en Attaque / en Défense avec les bonus Bouclier, Arme, Lieu. Relevé le 2026-10-07 (s5).
- Effectif présent : les 3 colonnes du lieu deviennent `td` (boutons de déplacement) | `td > span[id="(<nombre>,'unite<N>',<lieu>)"]` | `td` (relevé le 2026-10-07 ; **le 2026-10-16 sur S5**, plus d'`id` : `span.cliquable[onClick="remplirFormulaire(<nombre>,'unite<N>',<lieu>,<destination>);"]`, qui remplit le formulaire de déplacement ; `readGarrison` lit les deux) ; nombre sans espace dans l'`id`, `uniteN` comme sur `AcquerirTerrain.php`, lieu 1 = TDC, 2 = Fourmilière (colonne « Dôme »), 3 = Loge. Les niveaux sont dans l'en-tête : « Dôme (3) », « Loge (1) ». Abréviations de la page : T / TE pour les Tueuses (clés Tu / TuE dans Optizzz, affichées T / TE comme le jeu : `unitLabel`). Relevé le 2026-10-07 (s5).
- Les troupes en chasse n'y figurent pas. Un second `table.simulateur` sert à « Déplacer son armée ».
- Déplacer (relevé le 2026-10-16 sur S5, sans rien envoyer) : `form[action="Armee.php"][method=post]` avec `input#t[name=t]` (jeton caché), `input#nbTroupes`, `select#ChoixUnite` (`uniteN`, unités présentes seulement), radios `LieuOrigine` et `LieuDestination` (1 Terrain de Chasse, 2 Fourmilière, 3 Loge Impériale : de n'importe quel lieu vers n'importe quel autre), `input[type=submit][name=Transferer]` « Envoyer ». **HTML mal formé** : le `<form>` s'ouvre dans la première cellule du `table.simulateur` et le navigateur le ferme à son `</td>` ; les radios et le bouton sont dans les lignes suivantes, hors de l'élément `form` (rattachés à lui seulement par `form.elements`). Lire tout le tableau, pas `form.querySelector`. Les flèches à côté de chaque effectif sont des liens `GET` aux mêmes paramètres : `Armee.php?Transferer&nbTroupes=<tout l'effectif>&ChoixUnite=uniteN&LieuOrigine=…&LieuDestination=…&t=<jeton>`, vers le lieu voisin seulement (Terrain ↔ Fourmilière ↔ Loge). Optizzz poste le formulaire (feature « Anti-sondes »). Relevé le 2026-10-21 (retour de joueur) : le POST déplace bien les troupes, mais trois POST de suite sans pause, chacun avec le jeton de la page renvoyée par le précédent, n'en font que deux, à chaque essai ; cause non établie (limite de rythme ou jeton).
- Une chasse ou une attaque qui n'envoie qu'une partie d'une unité : on ne sait pas de quel lieu partent les fourmis (le formulaire ne demande qu'un total).

## AcquerirTerrain.php (lancer une chasse)

Relevé le 2026-10-07 sur s5, en GET seulement.

- Sans armée à envoyer (toute l'armée en chasse, ou aucune), la page n'a pas de `#tabChoixArmee` : « Vous n'avez pas d'armée a envoyer. » (sic).
- Un `GET` sans paramètre renvoie le formulaire complet : `form[action="AcquerirTerrain.php"]` avec `input#AcquerirTerrain` (`name="AcquerirTerrain"`, `type="tel"`, surface en cm²), le choix de l'armée et le jeton.
- `table#tabChoixArmee` : en-tête Unités | Terrain | Fourmilière | Loge | Armée, puis une ligne par unité (nom complet). La dernière case n'a un `input[name="uniteN"]` que pour les unités possédées, **pré-rempli avec le total des trois lieux** (« 2 112 » = 2 042 + 70) : le dôme et la loge partent en chasse aussi.
- Numéros `uniteN` : 1 JSN, 2 SN, 3 NE, 4 JS, 5 S, 6 C, 7 A, 8 AE, 9 SE, 10 Tk, 11 Tu, 12 TuE, 13 TkE, 14 CE (Calystene et Zéro perte ; seuls 1 et 2 vus sur le compte relevé).
- Champs cachés : `input#t[name="t"]` (jeton, dans le `tbody` du tableau), `input[name="pseudoCible"]` (vide). Bouton `input[type=submit][name="ChoixArmee"]`, valeur « Lancer la Chasse ! ». Un `textarea#textAreaArmee` sert à importer une armée en texte.
- Lancer = `POST AcquerirTerrain.php` avec `AcquerirTerrain`, `uniteN`, `t`, `ChoixArmee` (Calystene et Toolzzz). Réponse : « La chasse est lancée. ». Le jeton se relit par un nouveau `GET` avant chaque chasse.
- Le formulaire de `Ressources.php` (`#AgrandirTerrain`, `form[action="AcquerirTerrain.php"]`) a une étape « Etes vous sûr de vouloir lancer une chasse si longue ? » (`input[name="validation_chasse_longue"]`, radios oui / non) ; le POST direct de l'armée ne passe pas par elle.

## messagerie.php (rapports de chasse et de combat)

- Les rapports sont regroupés en conversations `tr.en_tete_message[data-type="Chasses"]` (`id="conversation_<n>"`), titre `a.intitule_message` « Vos chasseuses ont conquis 610 cm² en 5 expéditions » ; le clic charge le détail en AJAX dans les lignes suivantes.
- Un combat :

```
07/10/26 à 11h08
Troupes en attaque : 1 921 Jeunes Soldates Naines, 119 Soldates Naines.
Troupes en défense : 43 Petites araignées.
Vous infligez 6 358 (+ 2 544) dégâts et tuez 43 ennemies.
L’ennemie inflige 56 (+ 0) dégâts à vos fourmis et en tue 4.
Les unités survivantes ont appris de cette bataille :
- 5 Jeunes Soldates Naines sont devenues des Soldates Naines
Vos chasseuses ont conquis 118 cm², les carcasses des prédateurs vous rapportent 794
```

- Le TDC au combat et les niveaux ne sont pas dans le rapport. Mécaniques et validation : `chasse.md`.
- Détail ouvert (relevé le 2026-10-07) : juste après l'en-tête, un `tr` vide puis `tr.contenu_conversation > td[colspan=5] > table`. Une ligne `tr#message_<n>` par combat, du plus ancien au plus récent : `td.expe` (« 07/10/26 à 11h08 ») et `td.message > div.contenuJoueur` (texte ci-dessus, nombres en `<strong>`, la nourriture suivie d'une `img` pomme). Puis `tr#reactions_<n>`.
- Seuls les **10 derniers** combats sont chargés ; une ligne `tr.message_affiche` en tête porte le lien « Voir les messages précédents », qui ajoute les précédents dans le même tableau.
- Types de conversation vus (`data-type`) : `Chasses`, `Alliance`, `Conversations`, `Commerce`, `Combats`.
- Qui écrit (relevé le 2026-10-19 sur S5 et S2, liste seule) : `Commerce` (52) et `Combats` (16 + 3) ont toujours « Fourmizzz » dans `td.td_participants` ; `Alliance` vient des joueurs ; `Conversations` mêle joueurs et un message de « Fourmizzz ». Les rapports (Chasses, Combats, Commerce) ne contiennent donc que du texte du jeu, bien que rangé dans un `div.contenuJoueur` comme un message de joueur. Les captures du dépôt ont `td.td_participants` vide.

### Conversations « Combats »

Relevé le 2026-10-19 sur S2 et S5 (pseudos remplacés ; fixture `packages/game/src/pages/__fixtures__/combat-conversations.html`). Même en-tête et même détail AJAX que les chasses (`tr.contenu_conversation`, une ligne `tr#message_<n>` par message, `td.expe` et `.contenuJoueur`), une conversation par événement et par adversaire. Titres vus :

- « Attaque réussie contre X : votre armée a franchi le Terrain de Chasse » ;
- « Attaque échouée contre X : votre armée est morte contre son colonisateur Y » ;
- « Butin chez X : 6 044 cm² » ou « Butin chez X : 10 cm², 15 et 15 » (cm², nourriture, matériaux) ;
- « Colonie conquise chez X ».

Rapport d'attaque (un message) :

```
<strong>Vous attaquez le Terrain de Chasse de <a>X</a></strong><br>
Troupes en attaque : 5 531 Jeunes Soldates Naines, 485 Soldates Naines, 29 Naines d’Elites. <br>
Troupes en défense : 10 Jeunes Soldates Naines. <br><br>
Vous infligez <strong>19 221 (+ 9 611)</strong> dégâts et tuez <strong>10</strong> ennemies.<br>
L’ennemie inflige <strong>2 (+ 2)</strong> dégâts à vos fourmis et en tue <strong>0</strong>.<br><br>
Écrasante victoire ! A peine le temps de se dégourdir les pattes qu’ils étaient tous morts ...<br>
<strong>Vous avez gagné cette bataille !</strong>
```

- Lieu : « le Terrain de Chasse », « la fourmilière » (vus) ; la Loge pas encore vue. Le pseudo est un lien `Membre.php` dans le `strong` ; pas d'espace entre le `</strong>` et « Troupes » dans le texte.
- Fourmilière tenue par un colonisateur : « Vous attaquez la fourmilière de X, mais une armée d'occupation est déjà présente. » ; « Troupes en défense » est alors l'armée d'occupation. Défaite : « Vous avez infiltré l’ennemi. Les informations sont bien rentrées ... mais pas vos soldates ! » puis « <strong>Vos troupes ont échoué</strong> ».
- Dégâts « base (+ bonus) » des deux côtés : le bonus est +10 % par niveau d'Armes, **arrondi** (19 221 → + 9 611 : Armes 5 ; 1 589 060 → + 4 926 086 : Armes 31). Les Armes adverses se lisent donc dans le rapport dès 10 dégâts de base.
- Un seul échange « Vous infligez … / L’ennemie inflige … » dans les deux rapports vus (combats déséquilibrés). Pas de promotions, ni de TDC ou de ressources : ils arrivent dans « Butin chez X », à la même minute.
- Butin, un message par prise : « Vos fourmis ont <strong>conquis 6 044 cm²</strong> lors de leur dernière bataille. Ces terres appartenaient à <a>X</a>. » ; « Vos fourmis ont pillé <strong>15 <img alt="nourriture"> et 15 <img alt="matériaux"></strong> lors de leur dernières batailles, ces ressources appartenaient à <a>X</a>. ». Une conversation « Butin » regroupe plusieurs prises sur le même joueur (4 messages sur deux jours vus sur S5).
- Une attaque sur un lieu vide ne donne pas de rapport de combat : seulement « Butin » (15 conversations « Butin » pour un seul rapport d'attaque sur S5).
- Colonie : « Félicitations ! … Vous venez de prendre le contrôle d'une nouvelle colonie … son propriétaire <a>X</a> essayera sans doute de se révolter. ».
- **Pas encore vu** : un rapport de défense (attaque subie), une attaque de la Loge, un combat en plusieurs échanges.

## messagerie.php (convois livrés et reçus)

Relevé le 2026-10-19 sur S5 (lecture seule, boîte de réception).

- La boîte de réception (`GET messagerie.php`, sans ancre) liste toutes les conversations dans `div#liste_conversations > table#table_liste_conversations`, **sans pages** : le jeu efface les messages au bout d'environ une semaine (le plus ancien vu avait 7 jours et quelques heures). Les dossiers (`#Commerce`, `#Combat`…, ancre de l'URL) sont rechargés en AJAX par `POST traitement=afficher&dossier_special=<nom>` ; le dossier Commerce montre les mêmes conversations que la boîte de réception.
- En-tête d'une conversation de convoi : `tr.en_tete_message[data-type="Commerce"]#conversation_<id>`, participant « Fourmizzz », `td.td_objet > span.message_affiche` (la date), puis `a.intitule_message` : « Convoi livré à X : 381 000 <img alt="matériaux"> », « Convoi reçu de X : 2 <img alt="nourriture"> et 1 <img alt="matériaux"> ». Une `img.icone_messagerie` suit chaque nombre ; son `alt` (« nourriture », « matériaux ») dit la ressource, une ressource à zéro n'est pas écrite. Une conversation non lue a son titre en gras et un `span.nbr_mess_non_lus_conv`.
- Dates (heure de Paris) : « 05h48 » (aujourd'hui), « hier 21h03 », « samedi 05h53 » (de 2 à 6 jours), « 13 octobre 23h50 » (plus ancien, sans année).
- Une conversation peut **regrouper plusieurs livraisons** au même joueur (deux livraisons à 22 min d'écart, une autre conversation entre elles) : l'en-tête donne leur somme et l'heure de la dernière. Ouvrir la conversation (`POST traitement=afficher&conversation=<id>`, ce que fait un clic, qui la marque comme lue) donne une ligne `tr#message_<n>` par livraison : `td.expe` « 19/10/26 à 05h26 » et le texte « Votre livraison de … est arrivée chez X. Vos ouvrières sont de retour. ».

## commerce.php (convois)

Relevé le 2026-10-07 sur s5 (convoi de 1 nourriture vers Messor, envoyé à 20h15).

- Formulaire `form[action="commerce.php"]` : `input#pseudo_convoi`, `input#input_nbNourriture` / `#input_nbMateriaux` / `#input_nbOuvriere` (`type="tel"`, abréviations k, m, g), chacun doublé d'un champ caché (`#nbNourriture`, `#nbMateriaux`, `#nbOuvriere`) où le script du jeu écrit le nombre lu ; `#ratio_nourriture` ; bouton `input[name="convoi"]` « Lancer le convoi ». Cliquer sur un titre (« Nourriture donnée »…) remplit le maximum : premier clic avec les ouvrières disponibles, second avec toutes.
- Aide `#explication_convois` : une ouvrière par lot de 10 ressources, +5 % par niveau d'étable à pucerons ; Vitesse d'attaque −10 % de trajet par niveau ; le surplus est perdu si les entrepôts du destinataire débordent.
- Convois en cours : `h3` « Convois en cours: », puis une ligne par convoi : `<strong>- Vous allez livrer 1<img pomme> et 0<img bois> à <a href="Membre.php?Pseudo=X">X</a> dans 1H 22m 22s</strong><br>`. Le temps restant est écrit au chargement, **sans décompte `reste()`**. Avec Compte+ (relevé le 2026-10-13 sur S5), chaque ligne est suivie de ` - <small><em>Retour le 13 oct. à 21h59</em></small>` : l'heure de retour des ouvrières, égale à l'arrivée (pas de trajet retour). Tant que le convoi peut être annulé (relevé le 2026-10-17 sur S5), ` - <a href="commerce.php?annuler=<id>&t=<jeton>">Annuler</a>` suit ce `<small>`, avant le `<br>` ; les convois plus anciens n'en ont pas.
- Convois reçus (relevé le 2026-10-18 sur S5, Compte+) : après les convois envoyés, une ligne vide (`<br /><br />`), puis une ligne par convoi reçu, dans un `span.gras` (pas un `strong`) : `<span class="gras">- Vous allez recevoir 2<img nourritures> et 1 <img materiaux> de <a href="Membre.php?Pseudo=X">X</a> dans 8H 6m 59s</span> - <small><em>Retour le 19 oct. à 02h15</em></small><br/>`. Le « Retour le » y est l'heure d'arrivée chez moi. Toujours sous le même `h3` « Convois en cours: » (non vérifié quand on ne reçoit que des convois). Les ouvrières d'un convoi reçu ne sont pas les miennes.
- Les ouvrières ne font pas de trajet retour (observation du joueur) : le jeu les retire du compteur des ouvrières (`#nb_ouvrieres`, en-tête) au départ et les rend à l'arrivée du convoi.
- Un message `data-type="Commerce"` « Convoi livré à X : 1 » (relevé le 2026-10-07, convoi d'une nourriture) ; son détail (relevé le 2026-10-19) dit « Votre livraison de 0 [nourriture] et 300 000 [matériaux] est arrivée chez X. Vos ouvrières sont de retour. » : il est daté de l'**arrivée**. Liste des conversations : voir « messagerie.php (convois livrés et reçus) ».

## simulateurDuree.php

- Réservé au Compte+ (« Le simulateur est réservé aux joueurs possédant un compte + »).

Formulaire (`departX/Y`, `departPseudo`, `arriveX/Y`, `arrivePseudo`, `vitesseAttaque`, variante par `Distance`) ; le calcul est fait **côté serveur** à la soumission, la formule n'est pas dans le JS de la page.

## ennemie.php (Ennemies)

Relevé le 2026-10-07 sur S5 (serveur neuf, sans puis avec Compte+) et le 2026-10-08 sur S2 (Compte+), en lecture seule (GET).

- Formulaire `form#formulairePageEnnemie` (**POST** `ennemie.php`), dans `#centre > center > table.simulateur` : Etat (`select#etat` : tous, libre, soumise + `#pseudoMaitre`, vacance, bannie, debutante), `#terrain_max` / `#terrain_min` (`type="tel"`, « 15 164 ») avec les cases `#fourmiliere_attaquable` (cochée par défaut) et `#fourmiliere_attaquante`, `#distance_max` (0 = sans limite), `select#tri` (tri_terrain_max, tri_terrain_min, tri_distance, tri_alliance, tri_pseudo), cachés `page` et `inverser_tri`. Avec Compte+, fieldsets repliés en plus : Ma Fourmilière (calculer depuis un autre pseudo / terrain / alliance), Alliances (mon alliance, alliées, en guerre, une alliance précise), Interactions (attaques / convois, vers moi / vers la cible, depuis 24 h / 1 semaine / 1 mois).
- Portée préremplie : Terrain Min = ⌈TDC / 2⌉, Terrain Max = 3 × TDC − 1 (5 055 → 2 528 et 15 164 ; 234 202 → 117 101 et 702 605). **50 % inclus, 300 % exclu.** « Pouvant m'attaquer » : 33 % à 200 %.
- Tableau `table#tabEnnemie`, une ligne d'en-tête de `th` puis 7 `td` par joueur :

| Index | Contenu                                                                                                                         |
| ----- | ------------------------------------------------------------------------------------------------------------------------------- |
| 0     | Alliance : `a[href="classementAlliance.php?alliance=TAG"]`, vide sans alliance                                                  |
| 1     | Pseudo : `a[href="Membre.php?Pseudo=…"]`                                                                                        |
| 2     | `img[title="Fourmilières pouvant m'attaquer"]` (`icone_degat_defense.gif`) ou vide                                              |
| 3     | Terrain (TDC **en direct**), « 13 511 »                                                                                         |
| 4     | Lien d'attaque `a[href="ennemie.php?Attaquer=<id>&lieu=1"] > img[title="Attaquer cette Fourmilière"]`, ou vide                  |
| 5     | Distance = distance euclidienne **arrondie au supérieur** (37,74 → 38 ; vérifié sur 7 joueurs avec les coordonnées de l'export) |
| 6     | Etat : « Fourmilière Libre », « Soumis à <pseudo> », « En vacances », « Bannie », « Nouveau » (protection débutant des 7 jours) |

- `tr.neutre` ou `tr.monAlliance`. D'après le tutoriel, mon alliance est en vert, ses ennemis en rouge, ses alliés en bleu (classes des deux derniers pas encore vues).
- Le lien d'attaque est là **aussi pour mon alliance et les bannis**, mais pas pour les joueurs en vacances ni sous protection débutant.
- **200 lignes au plus.** S2 (Compte+) : bouton « Page Suivante » (`changerPage(1)`) sous le tableau ; S5 sans Compte+ : pas de bouton (722 joueurs à portée, 200 affichés).
- Bandeau quand on est soi-même protégé : « Vous profitez de la protection débutant des 7 premiers jours. Si vous attaquez, vous ne serez plus protégés... ».
- `ennemie.php?Attaquer=<id>&lieu=1` (GET) affiche le formulaire « Vous allez attaquer X ! » : `select[name=lieu]` (1 Terrain de Chasse, 2 Fourmilière, 3 Loge Impériale), import d'armée (`textAreaArmee`), un champ par unité, jeton caché `t`, `pseudoCible` ; l'attaque ne part qu'au POST (`ChoixArmee`). `<id>` = `id` de l'export des joueurs.
- Attaques en cours sur le formulaire d'attaque (relevé le 2026-10-16 sur S5, Compte+) : sous le formulaire, après `table.simulateur`, le même bloc que sur `Armee.php` (`<h3>Attaque(s) en cours</h3>`, lignes, `reste(…)`, note `<small>`), dans `#centre > center` jusqu'à sa fin.
- Formulaire d'attaque (relevé le 2026-10-08 sur S2) : `form#formulaireChoixArmee` (POST `ennemie.php?Attaquer=<id>`), `select#lieu`, puis `table#tabChoixArmee` : en-tête Unités | Terrain | Fourmilière | Loge | Armée, une ligne par unité. Les 3 colonnes de lieu donnent mes effectifs (vides si nuls). Une unité possédée a `input#uniteN` (`type="tel"`, `onkeyup="lireEtReecrireChamps('uniteN')"`) **pré-rempli avec tout l'effectif, Loge comprise** (« 406 705 »), et son nom porte `onclick="remplirChamps('uniteN', total)"`. Cachés `t` (jeton) et `pseudoCible`, bouton `submit[name=ChoixArmee]`. La page n'affiche pas le TDC de la cible.
- `Membre.php` : le TDC en direct dans `<tr><td>Terrain</td><td>700 180</td><td>786</td></tr>` (valeur, classement), état « Etat : Fourmilière libre », position « x=21 et y=745 ».
- `Membre.php` d'un joueur protégé : « Ce joueur bénéficie de la protection débutant et ne peut être attaqué pendant ses 7 premiers jours ». Actions : convoi (`commerce.php?ID=<id>`), message.
