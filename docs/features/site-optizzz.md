# Site Optizzz

Décidé lors d'une session de cadrage (`/grill-with-docs`) le 2026-10-22. Le vocabulaire est dans `GLOSSARY.md` ; les choix d'architecture dans les ADR 0005 (facultatif, chiffré de bout en bout), 0006 (monorepo, T3, hébergement) et 0007 (libsodium, Better Auth, liaison de l'extension). Chaque étape a son propre cadrage court avant d'être codée.

## But

Un site, `optizzz.fr`, lié à l'extension :

- des **outils publics sans compte** : simulateurs de chasse, d'attaque et de flood, coûts et temps de développement, temps de trajet entre joueurs, données des serveurs (joueurs, alliances, carte…) ;
- un **Espace d'alliance** où les membres mettent en commun floods, convois, chasses et états, et s'entraident par des Demandes, pour que tout le monde se développe de façon égale.

## Envois

Rien n'est envoyé sans Compte Optizzz. Chaque catégorie est coupée par défaut et se choisit une à une :

- **Production** : TDC, ouvrières, colonisateur et taxe, colonies et ce qu'elles rapportent ;
- **Convois** : envoyés, reçus, en route ;
- **Floods** : attaques envoyées en route ;
- **Attaques reçues** : floods en route vers soi ;
- **Chasses** : en cours, retour ;
- **Armée** : Rien, Nombre ou Par unité ;
- **Niveaux et chantiers**.

Faire une Demande exige d'envoyer Production et Convois. Un Envoi ne contient que ce que la personne a affiché ou ce qu'une action de sa part a lu (`docs/research/reglement.md`).

## Ce que l'extension relève

Toutes les 5 minutes et à l'ouverture d'une page du jeu, l'extension relève le site (jamais le jeu) : les floods sur l'alliance, les floods envoyés, les convois en cours dans les deux sens, les Demandes validées, et pour les Admins et Délégués les Demandes à valider.

## Demandes

- Le joueur choisit une construction ou une recherche et le niveau visé ; le coût vient de la table des coûts quand on la connaît, sinon il le saisit. Plusieurs Demandes par joueur, triées par lui.
- Statuts : à valider → validée (ou refusée) → couverte, quand convois reçus et en route atteignent le coût → close, quand l'extension du demandeur voit le niveau atteint ou le chantier lancé. Le demandeur peut annuler.
- Un Admin ou un Délégué valide.
- « Envoyer un convoi » depuis une Demande ouvre la page Convoi du jeu pré-remplie (destinataire, reste à envoyer, convois en route déduits) ; le joueur clique lui-même. Ce convoi est rattaché à la Demande ; un convoi lancé ailleurs ne compte que dans le Solde.
- La Priorité classe les Demandes pour les validateurs et les donneurs ; elle ne décide de rien.

## Membres

- Un membre absent de la page Membres du jeu déclenche une alerte chez les Admins et Délégués ; ils décident d'exclure ou non (on peut quitter l'alliance un temps).
- Le « Partage » par copier-coller reste, pour qui n'a pas de compte : la vue fusionne les deux sources, le relevé le plus récent l'emporte.

## Discord

L'URL du webhook est un secret de l'alliance, chiffrée. Le détail part du client du membre qui agit ; le site n'envoie que des rappels sans contenu.

## Conservation

- Convois : 90 jours. Demandes closes : 90 jours.
- Floods, attaques reçues, chasses : jusqu'à l'arrivée, plus 7 jours.
- États et niveaux : le dernier et le précédent.
- Exports publics des serveurs : toujours (lus chaque heure par un cron).
- Supprimer son compte efface tout ce qu'on a envoyé.

## Ordre

1. Migration en monorepo (`git mv` vers `apps/extension`, `packages/game`, `release.yml`, CLAUDE.md), sans changement de fonction.
2. Site public sans compte : cron des exports, données des serveurs, carte, simulateurs, trajets.
3. Comptes, Espaces d'alliance, chiffrement.
4. Envois et leurs vues : floods, convois, attaques reçues.
5. Demandes et Priorité.
6. Webhooks Discord.
