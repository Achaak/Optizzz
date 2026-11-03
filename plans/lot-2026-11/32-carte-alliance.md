# 32 · Carte de l'alliance : taille selon le TDC, étiquettes, mesure

Priorité 4 · effort S · dépend de : rien · conflits : `apps/extension/src/features/alliance-map/` seulement.

## But

Trois réglages de la Carte de l'alliance (extension) : la taille de chaque bulle selon le TDC du membre, les étiquettes au choix (pseudo + rôle, pseudo, aucune), et un clic sur deux membres pour mesurer la distance et le trajet entre eux.

## Ce qui existe déjà (vérifier avant tout)

- `docs/features/alliance-map.md` : rôles de la chaîne (couleur, taille, forme), survol avec distance et trajet **depuis le joueur sélectionné**, clic = sélection, zoom, tableau trié par distance.
- `packages/map/` : la carte x/y partagée avec le site.

## À cadrer

1. La mesure entre deux membres : le survol depuis la sélection suffit-il déjà ? Sinon, un « second clic » qui trace un trait et écrit distance et trajets dans les deux sens ?
2. Taille selon le TDC : remplace la taille par rôle, ou s'y ajoute (case à cocher) ?
3. Étiquettes : lisibles quand les membres se chevauchent ?

## Proposition par défaut

Case « Taille selon le TDC » (aire proportionnelle, bornée), choix des étiquettes en trois positions, mémorisés par serveur ; la mesure seulement si le cadrage montre que le survol ne suffit pas.

## Maquette

Pas de canevas (extension) : décrire dans la doc, captures à l'appui.

## Fini quand

Réglages testés (option ECharts en fonction pure), doc `alliance-map.md`, essayé dans le jeu sur s5 en lecture seule.
