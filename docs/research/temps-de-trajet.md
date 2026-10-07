# Temps de trajet

```
temps (s) = ceil( 0,9^VA × 637200 × (1 − e^(−d / 350)) )
d = √((x₁ − x₂)² + (y₁ − y₂)²)
```

- **VA** : niveau de la recherche Vitesse d'attaque de **celui qui envoie** (−10 % par niveau, attaques et convois).
- 637 200 s ≈ 7 j 9 h : le plafond quand la distance devient très grande.
- Exemple : d = 10, VA 0 → 17 949 s (4 h 59 min 09 s) ; VA 3 → 13 085 s.

## Sources

- Formule : Toolzzz, `public/js/class/Joueur.js` (`getTempsParcours`). Ce n'est pas une source officielle.
- Forum : la distance est pythagoricienne et la Vitesse d'attaque réduit le temps, mais la constante n'y est pas donnée (`bot-fourmizzz/research/fourmizzz-forum-strats.md` §11.4).
- Le niveau de recherche −10 %/niveau : `bot-fourmizzz/research/fourmizzz-game-brief.md`.

## Mesures

| Date       | Trajet                                               | VA  | Formule         | Jeu                                                                                                               |
| ---------- | ---------------------------------------------------- | --- | --------------- | ----------------------------------------------------------------------------------------------------------------- |
| 2026-10-07 | convoi Achak (95;48) → Osirus_jack (94;51), d = 3,16 | 0   | 1 h 35 min 32 s | message de départ à 20 h 15, arrivée à 21 h 54 min 35 s : ≈ 1 h 39 (le joueur pensait l'avoir lancé vers 20 h 19) |

L'écart possible (≈ 4 %) n'est pas tranché : l'heure du message n'a que la minute, et le simulateur de durée du jeu demande le Compte+. Le calculateur de convoi affiche donc « ≈ » pour un convoi à venir, et le temps du jeu pour un convoi en cours.

## À vérifier

Comparer avec le simulateur du jeu (`simulateurDuree.php`, calcul côté serveur) pour deux ou trois couples distance / niveau, puis ajouter ces valeurs comme cas de test dans `src/game/travel.test.ts`.

## Ce qu'on peut savoir des niveaux

- Le sien : page Laboratoire (`span.niveau_amelioration` sous le `h2` « Vitesse d'attaque »).
- Ceux des autres : non publics, absents de l'API. D'où la saisie par joueur et le partage par copier-coller dans la carte d'alliance.
