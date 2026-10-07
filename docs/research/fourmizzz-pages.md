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
- Autres liens utiles : `boutonSimulateurDuree` → `simulateurDuree.php`, carte du jeu `carte2.php` (vue isométrique).

## En-tête du joueur

- `#pseudo` : pseudo du joueur connecté (texte seul).
- `a.titre_ressource` : « S5 Achak » (serveur + pseudo).
- **`div#data`** (caché, présent avec ou sans Compte+) : valeurs brutes, sans séparateur de milliers. `#nb_ouvrieres`, `#nb_materiaux`, `#nb_nourriture` (décimal : « 2883.1475837896 », la nourriture évolue en continu), `#quantite_tdc`, `#tag_alliance`, `#pseudo`. Source à préférer pour les stocks.
- `#boiteInfo #tableau_boite_info` : une `td.tooltip_boite_info` par ressource (ligne 1 ouvrières, 2 nourriture, 3 matériaux, puis `td#boite_info_tdc`), chacune `a.ligne_boite_info > div.jauge, img, div.texte_ligne_boite_info` ; boîte large de 210 px ; texte dans `.texte_ligne_boite_info`, jauges `div.jauge > div.jauge_nourriture` / `.jauge_materiaux` (`style="width:7%"`), titre « Votre entrepôt de nourriture est rempli à 7% ». Les capacités ne sont pas dans l'en-tête (voir `construction.php`).
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
- Un `fetch('/laboratoire.php')` depuis une page du jeu renvoie la page complète (session par cookie).

## Ressources.php

- Ouvrières : `input#RecolteNourriture`, `input#RecolteMateriaux` (`type="tel"`, valeurs avec espaces « 4 004 »), bouton `#ChangeRessource` (`ChangeRessource=Valider`, `POST /Ressources.php`). Compte+ : radios `input[name=choixOuvriere]` (`nourriture` / `materiaux` / `rien`) = où vont les nouvelles ouvrières ; sans Compte+ elles restent sans travail.
- `#ouvrieresAuTravail` (« 4 004 »), `#pourcentageTdcUtil`. Récoltent : min(TDC, ouvrières).
- Prochain retour des ouvrières : `#retour_ouvrieres` + `reste(977, "retour_ouvrieres")` (secondes).
- Résumé **par jour**, dans le `p` contenant « Chaque jour » :

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
- Chasses en cours, après `span.titre` « Chasse en cours » : `- Vos chasseuses vont conquérir 122 cm² dans <span id="chasse_139778">…</span><script>reste(1090, "chasse_139778");</script>`. Compte+ seulement : `<small><em>Troupes en chasses : 1 975 Jeunes Soldates Naines, 124 Soldates Naines.<br>Arrivée à 12h39</em></small>`.

## colonies.php et profil

- Colonisé : `div.simulateur` avec `<h2>Vous êtes colonisés par …</h2>`, la force d'occupation, un lien « Déclencher une rebellion ».
- `Membre.php` : ligne « Etat : » → « Fourmilière libre » ou « Fourmilière soumise par … ».

## Armee.php

- La ligne « Consommation Journalière » vue sur certains comptes est ajoutée par Toolzzz, pas par le jeu ; elle ne compte que la garnison.
- Attaques en cours (Toolzzz, non relevé) : `span[id^="attaque_"]` + `reste()`.

## simulateurDuree.php

Formulaire (`departX/Y`, `departPseudo`, `arriveX/Y`, `arrivePseudo`, `vitesseAttaque`, variante par `Distance`) ; le calcul est fait **côté serveur** à la soumission, la formule n'est pas dans le JS de la page.
