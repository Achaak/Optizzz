# Feature : Partage d'alliance

Décidé lors d'une session de cadrage (`/grill-me`) le 2026-10-09, codé le même jour.

## But

Partager entre membres d'une alliance ses niveaux de bâtiments et de recherches, ses chantiers, ses ouvrières, son TDC et son armée, et tenir les autres au courant de son avancement. Les données ne doivent **jamais être lisibles hors de l'alliance**.

## Règles du jeu et confidentialité

- Le script ne joue pas à la place du joueur (`/Users/achak/Development/bot-fourmizzz/research/fourmizzz-game-brief.md`, fils du forum sur les bots et les scripts annexes) : tout partage et toute relecture partent d'un clic du joueur ; rien n'est publié tout seul.
- Rien ne sort de Fourmizzz par l'extension : ni serveur Optizzz, ni webhook, ni permission nouvelle. Le joueur copie son état et le colle lui-même dans un salon Discord privé de son alliance ; c'est Discord (les rôles réglés par l'alliance) qui décide qui le lit.
- Forum d'alliance écarté pour cette version : selon sa configuration, une section est lue par l'alliance seule ou par deux alliances en pacte, et rien ne dit encore si la page l'indique.
- Un membre lit ce que lisent les membres : contre un espion, seulement moins de données par défaut (armée en nombre), l'heure de chaque relevé, et pas d'export de toute l'alliance.
- La ligne de données n'est pas chiffrée (base64 se relit en une seconde) ; on ne la présente pas comme protégée.

## Comportement

### Mon état

- **Accès** : entrée « Mon état » du menu Fourmilière (`ul#menuFourmiliere`), après « Ma Fourmilière » : `fourmiliere.php#etat`. La vue remplace le contenu de la page tant que le hash est `#etat`, comme les vues d'alliance.
- **Ce que je partage**, cases à cocher retenues par serveur : Bâtiments (les 13), Recherches (les 10), Chantiers en cours, Ouvrières, TDC, Armée. Armée : Rien, Nombre (par défaut) ou Par unité ; jamais par lieu.
- **Armée absente** : `Armee.php` ne montre que l'armée présente. On ajoute ce qu'on connaît : les troupes en chasse par unité (`Ressources.php`, Compte+ seulement), les fourmis des attaques lancées par le Plan de flood (en nombre). Ce qui reste inconnu (chasse sans Compte+, attaque lancée hors du plan) marque l'armée « incomplète », avec l'heure de retour quand on la sait.
- **Lecture** : à l'ouverture de la vue et sur « Actualiser », Optizzz relit Construction, Laboratoire, Armée et Ressources (`fetchGamePage`, 4 requêtes déclenchées par le joueur, jamais en arrière-plan) ; le texte se recalcule à chaque case cochée, sans relire. Une page qui ne répond pas est nommée (« Pages illisibles : Laboratoire ») et ce qu'elle montre est laissé de côté. Le tag d'alliance vient de `#tag_alliance` (en-tête de toutes les pages).
- **« Copier mon état »** : copie le texte affiché et le retient pour les changements du partage suivant (il apparaît aussi dans ma ligne de « Partage »). Presse-papiers refusé : le texte s'affiche à copier à la main.
- **Texte copié**, sous 2 000 caractères (limite d'un message Discord) :
  - résumé lisible sans l'extension : pseudo, heure du relevé, TDC, ouvrières, armée, changements depuis mon dernier partage (« Armes 11 → 12 »), chantiers avec leur fin (« Armes 12 : fin aujourd'hui 18 h 20 ») ;
  - une ligne de données versionnée `[optizzz:v1:…]` avec le serveur, le tag d'alliance, le pseudo, l'heure du relevé et les données cochées : JSON compact (niveaux et unités en tableaux dans l'ordre de `src/game/levels.ts` et `UNITS`, heures en minutes) en base64 standard sans `=`, sans `_`, `*` ni `~` que Discord lirait comme du markdown et perdrait à la copie ;
  - au-delà de 2 000 caractères, les lignes Bâtiments et Recherches du résumé sont remplacées par un renvoi à la vue : elles restent dans la ligne de données.
- Chacun ne copie que **son propre état**.

### Partage (alliance)

- **Accès** : entrée « Partage » du menu d'alliance, après « Historique » : `alliance.php?Membres#partage`.
- **Import** (« Coller les états partagés ») : on colle tout le salon Discord, en une ou plusieurs fois ; seules les lignes `[optizzz:…]` comptent.
  - Pour chaque membre, le relevé le plus récent (par son heure) est gardé, avec le précédent pour les changements ; un relevé plus vieux que celui connu est ignoré sans bruit.
  - Ignorés et signalés : autre serveur, autre alliance, pseudo absent de la page Membres.
  - Compte rendu : « 12 membres mis à jour, 1 inchangé, 2 lignes ignorées (pseudo hors alliance : X ; autre serveur : Y) ».
  - Limite acceptée : le pseudo vient du texte, pas de l'auteur du message Discord.
  - Un membre est identifié par son pseudo (celui de la page Membres, casse ignorée) ; la Carte et la Chaîne font le lien avec l'identifiant de l'export.
  - Un texte sans aucune ligne `[optizzz:…]` est lu à l'ancien format de la Carte (« Pseudo: niveau ») : chaque niveau devient une Vitesse d'attaque saisie à la main ; à retirer après une version.
- **Tableau** : une ligne par membre, « aucun partage » pour ceux sans relevé. Groupes de colonnes : Résumé (par défaut : TDC, ouvrières, armée, Armes, Bouclier, Vitesse d'attaque, Dôme, Loge, chantier en cours, âge du relevé), Bâtiments, Recherches, Armée, Chantiers. Tri par colonne. Changements surlignés 24 h (↑). Relevé grisé au-delà de 3 jours. Chantier dont la fin est passée : compté comme terminé.
- **Valeurs manuelles** : case « Corriger à la main », puis toute valeur d'un membre se saisit ; en italique, avec ↺ pour revenir à la valeur partagée. La plus récente l'emporte entre la saisie et le relevé partagé (`valueOf`) : un import plus récent la remplace. La Carte et la Chaîne lisent cette même source pour la Vitesse d'attaque.
- **Effacement** : les données d'un membre absent de la page Membres ; tout, quand le joueur quitte ou change d'alliance.

### Carte

- La Vitesse d'attaque vient des états partagés. Un niveau saisi dans le tableau de la Carte est daté et l'emporte seulement s'il est plus récent que le relevé partagé ; une saisie d'avant cette version compte comme plus ancienne. Pour moi, le niveau du Laboratoire reste prioritaire. Le partage « Pseudo: niveau » de la Carte disparaît ; son format se colle dans « Partage » pendant une version.

### Interrupteur

- « Partage d'alliance » dans « Fonctionnalités » : coupé, ni menus ni vues ; la Carte revient à sa saisie seule.

## Plus tard

Chacun avec son propre cadrage ; le format v1 porte déjà leurs données :

- Chaîne de TDC : armée réelle des passeurs.
- Simulateur : un allié en défense (Bouclier, Dôme, Loge, armée).
- Renforts.
- Historique des relevés en courbes.
- Forum d'alliance comme canal, si la page dit qui lit une section.

## Code

| Fichier                                                                         | Rôle                                                                                  |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `src/game/levels.ts`                                                            | Liste des bâtiments et recherches (ordre du format v1 : ajouter, jamais réordonner)   |
| `src/game/pages/levels.ts` (+ test)                                             | Tous les niveaux de Construction et du Laboratoire                                    |
| `src/game/pages/alliance.ts` (+ test)                                           | Tag d'alliance de l'en-tête (`readAllianceTag`)                                       |
| `src/data/shared-states.ts` (+ test)                                            | États mémorisés, import, valeurs manuelles (`valueOf`), effacements, mon dernier état |
| `src/features/alliance-sharing/my-state.ts` (+ test)                            | Mon état d'après les pages lues, armée absente                                        |
| `src/features/alliance-sharing/share-text.ts` (+ test)                          | Texte copié (résumé + ligne de données) et lecture d'un salon collé                   |
| `src/features/alliance-sharing/member-rows.ts` (+ test)                         | Lignes du tableau : changements 24 h, relevé ancien, chantiers terminés               |
| `src/features/alliance-sharing/menu.ts`                                         | Entrées « Mon état » et « Partage » (script léger, toutes les pages)                  |
| `src/features/alliance-sharing/MyState.tsx`, `AllianceSharing.tsx`, `style.css` | Vues React                                                                            |
| `src/features/alliance-sharing/settings.ts`                                     | Ce que je partage, mémorisé par serveur                                               |
| `src/entrypoints/alliance-sharing.content/index.tsx`                            | Script dédié à `fourmiliere.php` et `alliance.php` : monte les vues                   |
| `src/features/alliance-map/shared-levels.ts`                                    | Vitesse d'attaque partagée pour la Carte et la Chaîne                                 |

Vérifié dans le jeu (S5, 2026-10-09) : « Mon état » (niveaux, ouvrières, TDC, armée avec une chasse en cours, tag UPTEP), « Partage » (22 membres, import d'un état hors alliance écarté avec sa raison), menus, Carte inchangée.
