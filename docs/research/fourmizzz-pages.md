# Pages du jeu : structure et sélecteurs

Relevés en direct sur S5 le 2026-10-07 (compte connecté, via Claude in Chrome). Les fixtures de test (`src/features/*/__fixtures__/`) reproduisent cette structure avec des pseudos fictifs : le HTML brut n'est pas copié car les liens contiennent des jetons de session.

Notes plus larges (connexion, convois, pontes…) : `bot-fourmizzz/research/fourmizzz-pages.md`.

## Serveur et URL

- Le jeu tourne sur `https://s5.fourmizzz.fr/…` ; `www.fourmizzz.fr` n'est que l'accueil.
- `alliance.php` sans paramètre affiche le chat d'alliance.

## Menu (toutes les pages)

- `nav#menu` > `ul#menu_horizontal` (Fourmilière, Alliance, Communauté, Compte +, Aide) + des colonnes `ul.menu_colonne`.
- Menu d'alliance : `ul#menuAlliance.menu_colonne`, une `li > a.bouton<Nom>` par entrée : `boutonChat` (`alliance.php`), `boutonForum` (`?forum_menu`), `boutonMembres` (`?Membres`), `boutonCandidature` (`?voirCandidature`), `boutonMC` (`?messCollectif`), `boutonDiplomatie` (`?Diplomatie2`), `boutonDescription` (`?Description`), `boutonOptions` (`?Options`).
- Absent quand le joueur n'a pas d'alliance.
- Autres liens utiles : `boutonSimulateurDuree` → `simulateurDuree.php`, carte du jeu `carte2.php` (vue isométrique).

## En-tête du joueur

- `#pseudo` : pseudo du joueur connecté (texte seul).
- `a.titre_ressource` : « S5 Achak » (serveur + pseudo).

## alliance.php?Membres

- Contenu : `div#centre > div#alliance > center > table.simulateur … table#tabMembresAlliance`. Présent dans le HTML initial.
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

## laboratoire.php

- Une recherche = `tr.ligneAmelioration > td.desciption_amelioration` (sic) contenant `h2` (nom) + `span.niveau_amelioration` (« niveau N »).
- Recherches : Technique de ponte, Bouclier Thoracique, Armes, Architecture, Communication avec les animaux, Vitesse de chasse, **Vitesse d'attaque**, Génétique, Acide, Poison.
- Un `fetch('/laboratoire.php')` depuis une page du jeu renvoie la page complète (session par cookie).

## simulateurDuree.php

Formulaire (`departX/Y`, `departPseudo`, `arriveX/Y`, `arrivePseudo`, `vitesseAttaque`, variante par `Distance`) ; le calcul est fait **côté serveur** à la soumission, la formule n'est pas dans le JS de la page.
