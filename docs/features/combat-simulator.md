# Feature : Simulateur de combat

Décidé lors d'une session de cadrage (`/grill-me`) le 2026-10-07. Règles, sources et inconnues : `../research/combat.md`.

## But

Savoir avant d'attaquer (ou en se préparant à défendre) qui gagne, ce que chacun perd, quelle riposte on prend, et ce que l'attaque rapporte.

## Comportement

- **Page de l'extension** `combat-simulator.html` (React), ouverte dans un nouvel onglet : bouton « ⚔ Simuler un combat avec cette armée » sur `Armee.php`, onglet « Outils » de la fenêtre Paramètres et de la popup. Un content script ne peut pas ouvrir une page d'extension : il le demande au script d'arrière-plan (`tabs.create`, sans permission).
- Bandeau permanent : règles non vérifiées sur un vrai combat entre joueurs.
- **Saisie** : attaquant (armée, Armes, Bouclier, TDC, étable à pucerons) ; défenseur (armée par lieu, Armes, Bouclier, Dôme, Loge, TDC, nourriture, matériaux) ; lieu visé. Un rapport collé (« Troupes en défense : … ») ou une liste « 300 Jeunes Soldates, 2 Tanks » remplit une armée ; les noms inconnus sont signalés.
- **Pré-remplissage** : l'armée par lieu et le TDC sont mémorisés à chaque passage sur `Armee.php` (avec les niveaux de Dôme et Loge), les autres niveaux viennent de `game-levels`. « J'attaque » met toute l'armée côté attaquant ; « Je défends », chaque lieu côté défenseur. Sans serveur dans l'adresse (popup), le dernier serveur dont l'armée a été lue.
- **Résultat**, recalculé à chaque saisie : verdict et gains, puis par lieu combattu : victoire ou défaite, riposte, pertes par unité des deux côtés, attaque actuelle et attaque nécessaire pour une riposte à 50 / 30 / 10 %. Avertissement si le TDC adverse est hors de la portée 50 %–300 %.
- Interrupteur « Simulateur de combat » : coupé, rien sur `Armee.php` (ni bouton, ni lecture) ; la page reste ouvrable depuis « Outils ».

## Hors v1

- Promotions en combat entre joueurs, vrai planificateur d'attaque (armée minimale pour une riposte donnée), recalage sur de vrais rapports ([#1](https://github.com/Achaak/Optizzz/issues/1)).

## Code

| Fichier                                                      | Rôle                                                   |
| ------------------------------------------------------------ | ------------------------------------------------------ |
| `src/game/army/rounds.ts`                                    | Échange tour par tour, partagé avec la chasse          |
| `src/game/army/battle.ts` (+ test)                           | Combat entre joueurs, lieux, attaque nécessaire, gains |
| `src/game/army/units.ts` (+ test)                            | Défense des unités, lecture des effectifs écrits       |
| `src/features/combat-simulator/garrison.ts` (+ test)         | Armée par lieu sur `Armee.php`, mémoire par serveur    |
| `src/features/combat-simulator/form.ts` (+ test)             | Pré-remplissage, rapport collé, entrée du moteur       |
| `src/features/combat-simulator/CombatSimulator.tsx` (+ test) | La page (test de montage seulement)                    |
| `src/features/combat-simulator/index.ts`, `open.ts`          | Bouton sur `Armee.php`, ouverture de la page           |
| `src/entrypoints/combat-simulator/`, `background.ts`         | Page de l'extension, script d'arrière-plan             |
| `src/features/settings/tools-section.ts`                     | Onglet « Outils »                                      |
