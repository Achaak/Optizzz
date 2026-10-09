# Feature : Simulateur de combat

Décidé lors d'une session de cadrage (`/grill-me`) le 2026-10-07. Règles, sources et inconnues : `../research/combat.md`.

## But

Savoir avant d'attaquer (ou en se préparant à défendre) qui gagne, ce que chacun perd, quelle riposte on prend, et ce que l'attaque rapporte.

## Comportement

- **Page de l'extension** `combat-simulator.html` (React). Dans le jeu, elle s'ouvre **par-dessus la page, dans une fenêtre** : bouton aux épées croisées dans la barre du haut, à gauche de la roue, sur toutes les pages, et onglet « Outils » de la roue (décidé le 2026-10-09 : accessible partout plutôt qu'un bouton par page). La fenêtre encadre la page dans une `iframe` : le content script chargé partout n'embarque pas React. La page est donc listée dans `web_accessible_resources` (le jeu peut savoir que l'extension est installée). Échap ferme la fenêtre, y compris depuis l'intérieur (message `postMessage` au parent). Un lien « Ouvrir dans un nouvel onglet » et la popup l'ouvrent dans un onglet : un content script ne peut pas ouvrir une page d'extension, il le demande au script d'arrière-plan (`tabs.create`, sans permission).
- Bandeau permanent : règles non vérifiées sur un vrai combat entre joueurs.
- **Saisie** : attaquant (armée, Armes, Bouclier, TDC, étable à pucerons) ; défenseur (armée par lieu, Armes, Bouclier, Dôme, Loge, TDC, nourriture, matériaux) ; lieu visé. Un rapport collé (« Troupes en défense : … ») ou une liste « 300 Jeunes Soldates, 2 Tanks » remplit une armée ; les noms inconnus sont signalés.
- **Pré-remplissage** : l'armée par lieu, le TDC et le stock (nourriture, matériaux) sont mémorisés à chaque passage sur `Armee.php` (avec les niveaux de Dôme et Loge), les autres niveaux viennent de `game-levels`. « J'attaque » met toute l'armée côté attaquant ; « Je défends », chaque lieu, le stock et le TDC côté défenseur. Sans serveur dans l'adresse (popup), le dernier serveur dont l'armée a été lue.
  - Une garnison lue vide (toute l'armée en chasse) est mémorisée telle quelle, mais la dernière armée vue avec des unités est gardée : le simulateur la reprend en le disant (« armée lue le …, la garnison était vide le … : armée en chasse ? »).
  - Armes et Bouclier jamais lus : un avertissement « passez par le Laboratoire » (comptés à 0).
  - Changer de côté (« Je défends / J'attaque avec mon armée ») ne remplace que mon côté : l'armée adverse collée reste ; mon ancien côté n'est vidé que si je ne l'ai pas modifié.
- **Résultat**, recalculé à chaque saisie : verdict et gains, puis par lieu combattu : victoire ou défaite, riposte, pertes par unité des deux côtés, attaque actuelle et attaque nécessaire pour une riposte à 50 / 30 / 10 % (« plus de X » : le moteur exige strictement plus de 1,5 / 2 / 3 fois la vie). Avertissement si le TDC adverse est hors de la portée 50 % (inclus) – 300 % (exclu), la règle de `src/game/attack.ts`. En petite largeur, chaque côté défile horizontalement.
- Interrupteur « Simulateur de combat » : coupé, pas de bouton dans la barre ; le simulateur reste ouvrable depuis « Outils ». L'armée est lue sur `Armee.php` par `collect` dans tous les cas.

## Hors v1

- Promotions en combat entre joueurs, vrai planificateur d'attaque (armée minimale pour une riposte donnée), recalage sur de vrais rapports ([#1](https://github.com/Achaak/Optizzz/issues/1)).

## Code

| Fichier                                                      | Rôle                                                   |
| ------------------------------------------------------------ | ------------------------------------------------------ |
| `src/game/army/rounds.ts`                                    | Échange tour par tour, partagé avec la chasse          |
| `src/game/army/battle.ts` (+ test)                           | Combat entre joueurs, lieux, attaque nécessaire, gains |
| `src/game/army/units.ts` (+ test)                            | Défense des unités, lecture des effectifs écrits       |
| `src/game/attack.ts` (+ test)                                | Portée, prise de 20 %, créneaux d'attaque              |
| `src/data/garrison.ts` (+ test)                              | Armée par lieu sur `Armee.php`, mémoire par serveur    |
| `src/features/combat-simulator/form.ts` (+ test)             | Pré-remplissage, rapport collé, entrée du moteur       |
| `src/features/combat-simulator/CombatSimulator.tsx` (+ test) | La page (test de montage seulement)                    |
| `src/features/combat-simulator/index.ts`, `open.ts`          | Bouton de la barre du haut, adresse de la page         |
| `src/features/combat-simulator/dialog.ts` (+ test)           | Fenêtre par-dessus le jeu (iframe)                     |
| `src/utils/menu-bar.ts` (+ test)                             | Boutons d'Optizzz dans la barre du haut                |
| `src/entrypoints/combat-simulator/`, `background.ts`         | Page de l'extension, script d'arrière-plan             |
| `src/features/settings/tools-section.ts`                     | Onglet « Outils »                                      |
