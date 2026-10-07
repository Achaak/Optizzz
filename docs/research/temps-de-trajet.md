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

## À vérifier

Comparer avec le simulateur du jeu (`simulateurDuree.php`, calcul côté serveur) pour deux ou trois couples distance / niveau, puis ajouter ces valeurs comme cas de test dans `travel.test.ts`.

## Ce qu'on peut savoir des niveaux

- Le sien : page Laboratoire (`span.niveau_amelioration` sous le `h2` « Vitesse d'attaque »).
- Ceux des autres : non publics, absents de l'API. D'où la saisie par joueur et le partage par copier-coller dans la carte d'alliance.
