# Pages du jeu : structure et sélecteurs

Relevés en direct sur S5 le 2026-10-07 (compte connecté, via Claude in Chrome). Les fixtures de test (`src/features/*/__fixtures__/`) reproduisent cette structure avec des pseudos fictifs : le HTML brut n'est pas copié car les liens contiennent des jetons de session.

Notes plus larges (connexion, convois, pontes…) : `bot-fourmizzz/research/fourmizzz-pages.md`.

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
- Barre du haut : `#menu` (`position: fixed`, `z-index: 20000`, 30 px de haut). Onglets `ul#menu_horizontal li` à `width: 19.9%` (en ajouter un fait passer à la ligne) ; `ul#menu_horizontal` a `margin-right: 45px` pour `a#boutonDeconnexion` (`position: absolute; right: 0; width: 45px`). Optizzz y place sa roue à `right: 45px` et porte la marge à 90 px.
- Autres liens utiles : `boutonSimulateurDuree` → `simulateurDuree.php`, carte du jeu `carte2.php` (vue isométrique).

## En-tête du joueur

- `#pseudo` : pseudo du joueur connecté (texte seul).
- `a.titre_ressource` : « S5 Achak » (serveur + pseudo).
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
- Ponte (relevé le 2026-10-07) : un `form[action="Reine.php"]` par unité pondable, dans `td.cout_amelioration` ; le champ est dans un tableau imbriqué (`form > table > td.cout_ponte > div > input`). Suffixe des identifiants : vide pour l'ouvrière, `N` pour `uniteN`. Champs : `input#input_cout_nombreN` (`type="tel"`, accepte « 2k », « 0.1M »), cachés `typeUnite` (`ouvriere` / `uniteN`), `nombre_de_ponteN` (le nombre lu par le jeu), `destinationN` (1 Terrain, 2 Dôme, 3 Loge ; `span#texte_destinationN` la fait tourner au clic). À chaque frappe, `maj_cout_ponte(N)` (`onkeyup`) met à jour `#cout_nombreN`, `#cout_tempsN` (« 1J 3h », bonus compris) et `#cout_nourritureN` ; champ vide = coût d'une unité. **Relevé le 2026-10-08** : le nombre se règle d'abord avec un curseur jQuery UI (`div#sliderN`) ; `input#input_cout_nombreN` est masqué (`display: none`) et n'apparaît qu'au clic sur le nombre (`span#bouton_cout_nombreN`, « Changer la Quantité »), de même que `input#input_cout_tempsN` (« Changer la Durée ») et `input#input_cout_nourritureN` (« Changer le Coût »). Le curseur et ces champs ne changent que `nombre_de_ponteN` et les `span#cout_*N`, jamais `input_cout_nombreN` : `nombre_de_ponteN` vaut 1 tant que rien n'est choisi. Une unité verrouillée n'a pas de formulaire, seulement son coût et « Requis ».
- Calcul du jeu (relevé le 2026-10-09 sur S5) : durée d'une unité = `temps_ponte_base × vitesse` secondes, où `temps_ponte_base` vaut 60 pour l'ouvrière et `tcaste[N-1]` pour `uniteN` (`tcaste` = 300, 450, 570, 740, 1000, 1410, 1440, 1520, 1450, 1860, 2740, 2740, 2150, 1560 ; `ncaste` = nourriture, 5 pour l'ouvrière), et `vitesse` est écrite en dur dans le script en ligne de la page (`temps_ponte_base*0.10941898913151` : bonus du joueur compris). Le temps affiché est arrondi (« 33s » pour 32,8 s ; « 6.57s » avec des décimales). Le curseur va jusqu'au plus petit de « toute la nourriture » et « 7 jours de ponte » (`trouver_max_ponte`). Taper dans `input_cout_nombreN` puis `keyup` (`maj_cout_ponte` → `maj_ponte` → `maj_slider`) remet aussi le curseur en place.
- Cellule voisine `td.desciption_amelioration` (environ 655 px de large) : nom, description, « Requis » ; c'est là qu'Optizzz monte le planificateur.

## Colonne de gauche (toutes les pages)

- `div#menuBoite` (position fixe, 250 × 500 px) contient `#boiteComptePlus.boite_compte_plus` (absolu, `top: 200px`), `#data` et `#boiteInfo.boite_info` (absolu, `top: 20px`), placés à `left: 65px`.
- Une boîte : `.titre_colonne_cliquable` (25 px, fond `sprite_menu.png`, texte `rgb(211, 217, 184)` 16 px centré) puis `.contenu_boite_compte_plus` / `.contenu_boite_info` en absolu à `top: 25px`, 220 px de large.
- Sans Compte+, `#boiteComptePlus` n'a qu'un texte publicitaire ; avec, des lignes `#ligne_*`.

## Décomptes

- Le jeu met à jour un `<span id>` par un script `reste(<secondes>, "<id>")` placé à côté (ou regroupé plus loin). Vus : `retour_ouvrieres`, `chasse_<n>` (Ressources), `ponte_<n>`, `temps_restant_premiere_ponte` (Reine), `batiment_<n>`, `recherche_<n>` (Construction, Laboratoire). La boîte Compte+ utilise `resteTemps(…)`.
- Le jeu donne parfois l'heure lui-même après la ligne : « Arrivée à 12h39 » (chasse, Compte+), « Terminé à 13h06 » (recherche).
- Le 2026-10-07, aucune attaque ni aucun convoi en cours : `Armee.php` et `commerce.php` sans `reste()`.

## colonies.php et profil

- Colonisé : `div.simulateur` avec `<h2>Vous êtes colonisés par …</h2>`, la force d'occupation, un lien « Déclencher une rebellion ».
- `Membre.php` : ligne « Etat : » → « Fourmilière libre » ou « Fourmilière soumise par … ».
- `Membre.php` (relevé le 2026-10-08 sur S5) : `div#centre > center > h2` = pseudo du joueur affiché, puis `div.boite_membre` « Informations » contenant `table.tableau_score` : une ligne par score, `<td>Terrain|Fourmilière|Technologie|Combat</td><td>valeur</td><td>classement</td>`. Fourmilière et Technologie = `buildingScore` et `technologyScore` de l'export, plus frais que lui ; Combat = sans doute `trophyScore`. Deuxième `div.boite_membre` : « Action ».

## Armee.php

- La ligne « Consommation Journalière » vue sur certains comptes est ajoutée par Toolzzz, pas par le jeu ; elle ne compte que la garnison.
- Attaques en cours (relevé le 2026-10-08 sur S2) : après la garnison, `<h3>Attaque(s) en cours</h3>` puis une ligne par attaque, sans conteneur : `- Vous allez attaquer <span class="gras"><a href="Membre.php?Pseudo=X">X</a>(<a …>TAG</a>)</span> dans <span class="gras" id="attaque_<n>">9 minutes 7 secondes</span><script>reste(559, "attaque_<n>");</script><br>`. Pas de lien « Annuler » sur cette page ; une attaque annulée disparaît de la liste.
- « Troupes en Garnison » : `.simulateur` avec en-tête Unités | Terrain de Chasse | Dôme (niveau) | Loge (niveau), chaque lieu sur 3 colonnes (`colspan=3`) ; une ligne par unité (nom + abréviation), une case vide quand l'effectif est nul. Lignes Vie / Dégâts en Attaque / en Défense avec les bonus Bouclier, Arme, Lieu. Relevé le 2026-10-07 (s5).
- Effectif présent : les 3 colonnes du lieu deviennent `td` (boutons de déplacement) | `td > span[id="(<nombre>,'unite<N>',<lieu>)"]` | `td` ; nombre sans espace dans l'`id`, `uniteN` comme sur `AcquerirTerrain.php`, lieu 1 = TDC, 2 = Fourmilière (colonne « Dôme »), 3 = Loge. Les niveaux sont dans l'en-tête : « Dôme (3) », « Loge (1) ». Abréviations de la page : T / TE pour les Tueuses (clés Tu / TuE dans Optizzz, affichées T / TE comme le jeu : `unitLabel`). Relevé le 2026-10-07 (s5).
- Les troupes en chasse n'y figurent pas. Un second `table.simulateur` sert à « Déplacer son armée ».

## AcquerirTerrain.php (lancer une chasse)

Relevé le 2026-10-07 sur s5, en GET seulement.

- Sans armée à envoyer (toute l'armée en chasse, ou aucune), la page n'a pas de `#tabChoixArmee` : « Vous n'avez pas d'armée a envoyer. » (sic).
- Un `GET` sans paramètre renvoie le formulaire complet : `form[action="AcquerirTerrain.php"]` avec `input#AcquerirTerrain` (`name="AcquerirTerrain"`, `type="tel"`, surface en cm²), le choix de l'armée et le jeton.
- `table#tabChoixArmee` : en-tête Unités | Terrain | Fourmilière | Loge | Armée, puis une ligne par unité (nom complet). La dernière case n'a un `input[name="uniteN"]` que pour les unités possédées, **pré-rempli avec le total des trois lieux** (« 2 112 » = 2 042 + 70) : le dôme et la loge partent en chasse aussi.
- Numéros `uniteN` : 1 JSN, 2 SN, 3 NE, 4 JS, 5 S, 6 C, 7 A, 8 AE, 9 SE, 10 Tk, 11 Tu, 12 TuE, 13 TkE, 14 CE (Calystene et Zéro perte ; seuls 1 et 2 vus sur le compte relevé).
- Champs cachés : `input#t[name="t"]` (jeton, dans le `tbody` du tableau), `input[name="pseudoCible"]` (vide). Bouton `input[type=submit][name="ChoixArmee"]`, valeur « Lancer la Chasse ! ». Un `textarea#textAreaArmee` sert à importer une armée en texte.
- Lancer = `POST AcquerirTerrain.php` avec `AcquerirTerrain`, `uniteN`, `t`, `ChoixArmee` (Calystene et Toolzzz). Réponse : « La chasse est lancée. ». Le jeton se relit par un nouveau `GET` avant chaque chasse.
- Le formulaire de `Ressources.php` (`#AgrandirTerrain`, `form[action="AcquerirTerrain.php"]`) a une étape « Etes vous sûr de vouloir lancer une chasse si longue ? » (`input[name="validation_chasse_longue"]`, radios oui / non) ; le POST direct de l'armée ne passe pas par elle.

## messagerie.php (rapports de chasse)

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
- Types de conversation vus (`data-type`) : `Chasses`, `Alliance`, `Conversations`. Aucun rapport d'attaque ni de défense sur le compte relevé (sous protection).

## commerce.php (convois)

Relevé le 2026-10-07 sur s5 (convoi de 1 nourriture vers Osirus_jack, envoyé à 20h15).

- Formulaire `form[action="commerce.php"]` : `input#pseudo_convoi`, `input#input_nbNourriture` / `#input_nbMateriaux` / `#input_nbOuvriere` (`type="tel"`, abréviations k, m, g), chacun doublé d'un champ caché (`#nbNourriture`, `#nbMateriaux`, `#nbOuvriere`) où le script du jeu écrit le nombre lu ; `#ratio_nourriture` ; bouton `input[name="convoi"]` « Lancer le convoi ». Cliquer sur un titre (« Nourriture donnée »…) remplit le maximum : premier clic avec les ouvrières disponibles, second avec toutes.
- Aide `#explication_convois` : une ouvrière par lot de 10 ressources, +5 % par niveau d'étable à pucerons ; Vitesse d'attaque −10 % de trajet par niveau ; le surplus est perdu si les entrepôts du destinataire débordent.
- Convois en cours : `h3` « Convois en cours: », puis une ligne par convoi : `<strong>- Vous allez livrer 1<img pomme> et 0<img bois> à <a href="Membre.php?Pseudo=X">X</a> dans 1H 22m 22s</strong><br>`. Le temps restant est écrit au chargement, **sans décompte `reste()`**.
- Les ouvrières ne font pas de trajet retour (observation du joueur).
- Un message `data-type="Commerce"` arrive **au départ** : « 20h15 Convoi livré à Osirus_jack : 1 ».

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
- Formulaire d'attaque (relevé le 2026-10-08 sur S2) : `form#formulaireChoixArmee` (POST `ennemie.php?Attaquer=<id>`), `select#lieu`, puis `table#tabChoixArmee` : en-tête Unités | Terrain | Fourmilière | Loge | Armée, une ligne par unité. Les 3 colonnes de lieu donnent mes effectifs (vides si nuls). Une unité possédée a `input#uniteN` (`type="tel"`, `onkeyup="lireEtReecrireChamps('uniteN')"`) **pré-rempli avec tout l'effectif, Loge comprise** (« 406 705 »), et son nom porte `onclick="remplirChamps('uniteN', total)"`. Cachés `t` (jeton) et `pseudoCible`, bouton `submit[name=ChoixArmee]`. La page n'affiche pas le TDC de la cible.
- `Membre.php` : le TDC en direct dans `<tr><td>Terrain</td><td>700 180</td><td>786</td></tr>` (valeur, classement), état « Etat : Fourmilière libre », position « x=21 et y=745 ».
- `Membre.php` d'un joueur protégé : « Ce joueur bénéficie de la protection débutant et ne peut être attaqué pendant ses 7 premiers jours ». Actions : convoi (`commerce.php?ID=<id>`), message.
