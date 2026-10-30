# Refonte du Site Optizzz

Décidée lors d'une session de cadrage (`/grill-me`) le 2026-10-30 : le site était jugé « pas clair et pas très joli ». Les maquettes de trois directions (A « Terrier », B « Tableau de bord », C « Campagne ») ont été comparées sur un canevas ; **C est retenue**, avec le contenu de B.

## Raison d'être

Le site prolonge l'extension. Trois rôles, dans cet ordre sur l'accueil :

1. **Coordonner les alliances** : les Espaces (Demandes, convois, floods, absences, Discord).
2. **Donner les outils sans l'extension** : combat, chasse, flood, trajet, coûts.
3. **Partager des infos** : les serveurs (joueurs, alliances, Journal, carte) et les liens des outils.

## Direction « Campagne »

- **Sombre d'abord**, mais le site suit le système ; un bouton à trois positions (système, clair, sombre) le force, mémorisé dans le navigateur (`localStorage`, posé avant l'affichage pour ne pas clignoter).
- **Polices** : Barlow Condensed (titres, en capitales), IBM Plex Sans (texte), IBM Plex Mono (chiffres, étiquettes).
- **Formes** : angles vifs, bordures fines, panneaux à en-tête séparé par un filet.
- **Couleurs** : ambre (accent, tiré du brun du logo) et bleu, vérifiés en simulant protanopie et deutéranopie (ADR 0003). Jetons dans `apps/web/src/styles/globals.css`, propres au site : seul l'accent rejoint l'extension.

## Navigation

- En-tête : logo, **sélecteur de serveur** (mémorisé), Outils, Espaces, recherche de joueur, thème, compte.
- Sous l'en-tête, la barre de la section : celle du serveur (Vue d'ensemble, Joueurs, Alliances, Carte) ou celle des outils.
- Sur téléphone, un menu regroupe le tout.

## Pages

- **Accueil** : pour un visiteur, ce qu'est Optizzz, l'extension, les serveurs, les outils. Pour un connecté, un tableau de bord : ses Espaces avec des compteurs lisibles sans déchiffrer (Demandes à valider, adhésions, convois et floods en cours, clés à renvoyer), son joueur déclaré, des raccourcis vers les outils.
- **Outils** : une mise en page commune, le formulaire à gauche, le résultat (« Rapport ») collant à droite, « Copier le lien » en action principale ; sur téléphone, le résultat suit le formulaire.
- **Espaces** : la présentation suit le reste ; les parcours de chiffrement (Phrase, clés, invitation) ne changent pas.
- **Téléphone** : prioritaire ; les tableaux masquent leurs colonnes secondaires.

## Graphiques

Courbes et barres avec Recharts (shadcn), sauf la carte (ECharts).

- **Serveur** : joueurs inscrits, TDC total, répartition du TDC par tranche, part du TDC des 10 premières alliances, activité du Journal.
- **Alliance** : TDC de chaque membre, rang au fil des jours.
- **Joueur** : TDC et trois scores, rang au fil des jours.
- **Combat** : pertes par unité en barres en miroir (ambre contre bleu hachuré). **Flood** : TDC de l'attaquant et de la cible au fil des attaques. **Chasse** : pertes selon la taille de la chasse, si le worker le permet sans ralentir. **Coûts** : coût cumulé niveau par niveau. **Trajet** : frise de temps.
- **Comparer** (plus tard, en option) : 2 à 5 joueurs ou alliances sur une même courbe.

Sous 3 jours de relevés, un graphique laisse place à une note et à la valeur du jour. Une série se distingue toujours par autre chose que sa couleur (motif, forme, étiquette).
