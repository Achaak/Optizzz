# Revue : <Nom de la feature> (`<feature-id>`)

- Relecteur : sous-agent <A|B|C|D>
- Date : AAAA-MM-JJ
- Version : `package.json` <x.y.z>, commit <hash> (+ modifications non commitées si c'est le cas)
- Pages testées : <Reine.php, Ressources.php…>
- Doc lue : `docs/features/<page>.md` (+ `docs/research/…`)

## Résumé

<Trois lignes au plus : l'état général, ce qui marche bien, le problème principal.>

| Bloquant | Majeur | Mineur | Suggestion |
| -------- | ------ | ------ | ---------- |
| 0        | 0      | 0      | 0          |

## Constats

<!--
Un constat par sous-titre, numéroté <feature-id>-NN, le plus grave d'abord.
Gravité : bloquant | majeur | mineur | suggestion
Catégorie : UI | UX | bug | cohérence | code | doc
Emplacement : page du jeu (ex. Ressources.php, encart « Chasse ») ou fichier:ligne
Capture : docs/reviews/img/<feature-id>-NN.png, obligatoire si le constat est visuel
« Touche aussi » : les autres features probablement concernées (pour la synthèse)
-->

### <feature-id>-01 · <titre court>

- **Gravité** : majeur
- **Catégorie** : bug
- **Emplacement** : `src/features/…/x.ts:42` ; Ressources.php
- **Ce qui se passe** : …
- **Ce qui est attendu** : …
- **Capture** : ![](img/<feature-id>-01.png)
- **Touche aussi** : — / <autres feature-id>

## Questions ouvertes

<!--
Les doutes sur une règle du jeu, une formule, un chiffre affiché ou l'intention d'un comportement.
On ne tranche pas. Référence pour les mécaniques : site de Calystene (alliancead2.free.fr).
-->

### Q1 · <sujet>

- **Observation** : …
- **Hypothèses** : 1) … 2) …
- **Comment trancher** : <page du jeu à lire, outil de Calystene, question au joueur…>

## Préparation au mode « moderne »

<!--
Ce qui faciliterait ou bloquerait un futur thème « qualité moderne/améliorée » :
couleurs et tailles codées en dur (fichier:ligne), styles dispersés, absence de variables CSS
ou de tokens communs, dépendance aux styles du jeu, composants réutilisables ou non.
-->

- **Facilite** : …
- **Bloque** : …

## Hors périmètre / non testé

<Ce qui n'a pas pu être vérifié et pourquoi : action de jeu nécessaire, données absentes du compte, etc.>
