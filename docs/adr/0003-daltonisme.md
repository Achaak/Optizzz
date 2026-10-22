# 0003 — Couleurs lisibles par les daltoniens

**Date** : 2026-10-16 · **Statut** : accepté

## Contexte

Environ 8 % des hommes ont une vision des couleurs altérée, presque toujours rouge-vert (protanopie, deutéranopie). Simulées pour eux, les couleurs d'Optizzz se confondaient :

- rôles de la Chaîne sur la Carte : grenier rouge et chasseur vert, Passeur 1 bleu et Passeur 2 violet (écart 1 sur 100, identiques) ;
- carte du serveur : la famille verte des pactes et la famille rouge des guerres (écart 1,8) ;
- carte de l'alliance : le joueur choisi en rouge et ses voisins en orange ;
- rapports de chasse : l'écart à la prévision signalé par le seul fond rouge de la ligne.

## Décision

- **Une information ne tient jamais à la seule couleur.** Elle a aussi un texte (libellé, « ⚠ », légende, survol) ou une forme. Les rôles de la Chaîne ont une forme par type, fixe : grenier carré, passeur losange, chasseur rond, hors chaîne triangle (`apps/extension/src/features/tdc-chain/role-styles.ts`), sur la Carte, dans sa légende, dans la Chaîne et dans la colonne « Rôle » de la page Membres.
- **Jamais rouge contre vert** pour opposer deux choses : on oppose bleu et rouge/orange (pactes bleus, guerres rouges et orangées).
- **Palette des graphiques** (`CHART_COLORS.series`, `apps/extension/src/theme/index.ts`) : rouge, bleu, or, brun, ciel, orange, violet, vert, vérifiée sur le parchemin clair (`#f3ead0`) en simulant protanopie et deutéranopie : deux voisines restent distinctes (écart OKLab ≥ 16, cible 8), les trois premières aussi toutes ensemble. Les couleurs par défaut des rôles en tirent des paires distinctes : grenier rouge, Passeurs 1 à 3 bleu, or, orange.
- Une nouvelle couleur ou un nouvel ensemble de couleurs se vérifie avec un simulateur de daltonisme (écart OKLab ≥ 8 entre les couleurs vues ensemble), pas à l'œil.

## Conséquences

- Les couleurs de rôles déjà choisies par un joueur gardent leur numéro dans la palette, donc changent de teinte une fois.
- Au-delà de trois couleurs vues ensemble sur un nuage de points (carte), aucune palette ne reste distincte pour tous : la forme, le nom écrit et le survol prennent le relais.
- Le rouge et l'orange de l'urgence (`apps/extension/src/utils/urgency.ts`) restent proches pour un daltonien : ils accompagnent toujours un compte à rebours écrit.
