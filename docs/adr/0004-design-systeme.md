# 0004 — Un design système commun à toutes les vues

**Date** : 2026-10-16 · **Statut** : accepté

## Contexte

Les variables de thème de l'[ADR 0002](0002-theme-et-briques-partagees.md) avaient réglé les couleurs, mais chaque feature redessinait encore ses briques. Un relevé des 26 feuilles de style montrait :

- des titres de panneau en 14, 16, 17 et 18 px ou 1.1em, gras ou non, rouges ou noirs, en serif ou non ;
- des notes en 11 px, 12 px, 0.85em ou 0.9em italique, grisées ou non ;
- des avertissements tantôt encadrés, tantôt en texte orange (2,35:1 sur le parchemin, illisible) ;
- trois styles de tableau, deux couleurs d'en-tête et quatre marges intérieures ;
- quatre façons de marquer le choix d'un groupe de boutons, `button.link` recopié six fois, trois sortes de tuiles de chiffres ;
- les champs du popup et du simulateur de combat sans le style du thème ;
- les sous-titres des encarts Optizzz écrasés par ceux de l'habillage du jeu (`#centre h3`).

## Décision

- `apps/extension/src/theme/theme.css` porte, en plus des couleurs, une échelle de texte (11 à 18 px), d'espacements (2 à 16 px) et d'arrondis, puis des composants globaux préfixés `optizzz-` (panneau, titres, note, message, tableau, choix segmenté, pastilles, chiffres clés, dépliable, barre…), décrits dans `docs/design-system.md`.
- Les composants ne sont pas dans une `@layer`, pour ne pas perdre contre les règles du jeu ; la règle d'une feature, chargée après, garde la main à égalité.
- Les encarts posés dans la page et les vues React utilisent les mêmes classes. Une feature n'écrit plus que ce qui lui est propre.
- Le texte grisé passe à `#5a4c2e` (5:1) ; les états ont une couleur de texte foncée (`--optizzz-*-text`, au moins 4,5:1).
- L'habillage du jeu ne touche plus aux titres d'un bloc Optizzz.
- Une planche (`docs/design-system/specimen.html`) montre chaque composant avec le vrai thème.

## Conséquences

- Un nouveau composant s'ajoute à `theme.css`, à `docs/design-system.md` et à la planche, quand le motif revient dans trois features.
- Les tests qui comparent un `className` entier deviennent fragiles : vérifier une classe avec `classList.contains`.
- Un mode « moderne » (ADR 0002) peut maintenant changer aussi les tailles, espacements et arrondis par les jetons.
