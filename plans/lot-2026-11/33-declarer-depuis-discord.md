# 33 · Déclarer floods, convois et chasses depuis Discord

Priorité 4 · effort L · **commence par une ADR** · conflits : à voir après l'ADR.

## But

Permettre à un membre sans extension de déclarer un flood, un convoi ou une chasse par une commande Discord, qui arrive dans l'Espace.

## Le problème

Les Envois sont **chiffrés de bout en bout** avec la Clé d'alliance (ADR 0005) : le site ne lit rien. Un bot Discord qui reçoit une commande en clair et l'écrit dans l'Espace casserait cette promesse (le bot, donc le site, verrait le contenu). Le webhook actuel (`site-discord.md`) ne fait que poster des rappels sans contenu.

## À faire (sans code)

1. Écrire une ADR (`docs/adr/`) qui pèse les options : ne pas le faire ; un lien Discord vers un formulaire de l'Espace (chiffré dans le navigateur, comme « Déclarer un convoi ») ; un bot qui voit le contenu (et ce que ça change à `PRIVACY.md`, à la fiche des stores, à la promesse du site).
2. La faire relire par le joueur avant toute suite.

## Proposition par défaut

Un lien « Déclarer sur Optizzz » posté par le webhook, qui ouvre le formulaire de l'Espace : rien en clair ne passe par Discord.

## Fini quand

L'ADR est écrite et décidée par le joueur ; un plan de code seulement après.
