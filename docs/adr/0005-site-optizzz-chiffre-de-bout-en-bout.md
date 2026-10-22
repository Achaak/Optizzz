# 0005 — Site Optizzz facultatif, données d'alliance chiffrées de bout en bout

**Date** : 2026-10-22 · **Statut** : accepté

## Contexte

Jusqu'ici, rien ne sortait de Fourmizzz par l'extension (`docs/features/partage-alliance.md`, 2026-10-09) : les alliances partageaient leurs états par copier-coller dans Discord. On ajoute un Site Optizzz pour synchroniser convois, floods, chasses et états, et en tirer des statistiques. Celui qui héberge le site joue aussi : un accès à la base de données donnerait l'armée et les niveaux des alliances adverses.

## Décision

- **Facultatif** : sans Compte Optizzz, l'extension marche comme avant et n'envoie rien de la personne. L'Envoi se fait catégorie par catégorie (armée, chasses, convois…), coupé par défaut, choisi par la personne.
- **Lire le site, oui ; s'y identifier, non** (révisé le 2026-10-22) : sans compte, l'extension peut lire sur le site ce qu'il publie pour tous (données des serveurs tirées de l'export public), comme n'importe quel visiteur : ni identifiant, ni compte, ni donnée du joueur dans la requête. Seuls un Compte Optizzz et un Envoi autorisé font partir des données du joueur.
- **Chiffré de bout en bout** : les données d'une alliance sont chiffrées par une Clé d'alliance que seuls ses membres détiennent. Le Site Optizzz stocke et relaie du chiffré ; tout calcul (statistiques, qui doit donner à qui) se fait dans le navigateur, après déchiffrement.
- Restent lisibles par le site : le Serveur, le tag d'alliance, les pseudos et les heures. La composition des alliances est déjà publique dans l'export.
- **Le site déchiffre dans le navigateur.** Le chiffrement protège de qui lit la base de données, pas de qui modifie le code déployé : un site modifié pourrait faire fuiter la Clé d'alliance. Pour que ça laisse une trace publique, le code est public et le site n'est déployé que par GitHub Actions depuis `main`. On l'écrit tel quel dans `PRIVACY.md`.
- **Entrer dans un Espace d'alliance** : un membre crée l'espace et en devient admin ; plusieurs espaces peuvent porter le même tag. On demande à rejoindre, un admin approuve après que son extension a trouvé le pseudo sur la page Membres du jeu, et la clé est chiffrée pour la clé publique du nouveau venu. Jamais de clé dans un lien d'invitation. Le Site Optizzz ne peut vérifier personne : les profils du jeu exigent une session (`docs/research/reglement.md`).
- **Clés personnelles** : chacun a une paire de clés ; la clé privée est chiffrée par une Phrase de chiffrement que le site ne voit pas, et stockée sur le site pour suivre la personne d'appareil en appareil. Le lien magique ne prouve que l'e-mail. Phrase oubliée : nouvelle paire, et un admin réapprouve.
- **Départ d'un membre** : un joueur peut quitter l'alliance un temps et revenir. L'extension d'un Admin ou d'un Délégué qui voit la page Membres l'alerte d'un membre de l'espace absent de l'alliance ; rien n'est retiré tout seul. Exclure coupe l'accès au chiffré et fait générer une nouvelle Clé d'alliance par le client de l'admin, chiffrée pour les membres restants ; les données plus anciennes restent sous l'ancienne clé.
- **Règlement du jeu** (`docs/research/reglement.md`) : un Envoi ne contient que ce que la personne a affiché ou ce qu'une action de sa part a lu ; l'extension ne lit jamais le jeu sur minuterie pour alimenter le site ; le Site Optizzz ne se connecte jamais au jeu, ne garde aucun mot de passe Fourmizzz et ne lit que l'export public.
- **Discord** : l'URL d'un webhook est un secret de l'alliance, chiffrée. Le détail part du client du membre qui agit ; le Site Optizzz ne poste que des rappels sans contenu (« nouveau plan de flood, à voir sur Optizzz »).

## Options écartées

- **Chiffrement au repos avec une clé du site** : protège d'une fuite de sauvegarde, pas de l'hébergeur.
- **Cacher aussi les métadonnées** : coût élevé pour une information déjà publique.

## Conséquences

- Le site ne peut ni trier, ni agréger, ni alerter sur le contenu : tout traitement est côté client.
- Un départ de l'alliance impose de changer la Clé d'alliance ; ce que l'ex-membre a déjà lu reste lu.
- Une Clé d'alliance perdue par tous les membres rend leurs données illisibles, sans recours.
- Le Partage par copier-coller (`docs/features/partage-alliance.md`) reste pour qui n'a pas de compte.
- Nouvelle permission d'hôte : mettre à jour `PRIVACY.md`, `docs/store/fiche.md` et `data_collection_permissions`. Une lecture du site, même sans compte, transmet l'adresse IP du joueur à `optizzz.fr` : `PRIVACY.md` le dit.
