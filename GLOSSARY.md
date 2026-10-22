# Optizzz

Aide au jeu Fourmizzz : une extension navigateur, et un site où les alliances se coordonnent.

## Jeu

**Serveur** :
Un monde du jeu Fourmizzz (S1, S2, S5…), avec ses propres joueurs et alliances.
_À éviter_ : monde, univers ; jamais pour désigner le Site Optizzz.

**Joueur** :
Un pseudo sur un Serveur. Une même personne peut avoir un Joueur par Serveur.
_À éviter_ : compte, utilisateur.

**Changement** :
Ce qui a bougé pour un joueur ou une alliance entre deux exports publics : alliance quittée, colonisation, vacances, guerre déclarée… Jamais une simple variation de TDC ou de score.
_À éviter_ : événement, modification, mise à jour.

**Journal** :
La liste datée des Changements d'un joueur, d'une alliance ou d'un serveur.
_À éviter_ : historique (ce sont les courbes des scores), log.

## Site

**Site Optizzz** :
Le site web d'Optizzz et son API, où les alliances mettent en commun leurs données.
_À éviter_ : serveur, backend, la BDD.

**Compte Optizzz** :
L'inscription d'une personne au Site Optizzz. Sans compte, l'extension marche seule et n'envoie rien.
_À éviter_ : compte (sans précision), profil.

**Envoi** :
Le fait que l'extension transmette au Site Optizzz une catégorie de données choisie par la personne (armée, chasses, convois, floods…). Coupé par défaut, catégorie par catégorie.
_À éviter_ : synchro, télémétrie, collecte.

**Espace d'alliance** :
L'endroit du Site Optizzz où les membres d'une alliance mettent leurs données en commun. Plusieurs espaces peuvent porter le même tag ; seul celui qu'on a rejoint compte.
_À éviter_ : groupe, équipe, alliance (pour l'espace lui-même).

**Admin** :
Membre d'un Espace d'alliance qui accepte et exclut les membres, nomme les Délégués et valide les Demandes. Le créateur de l'espace l'est d'abord. Sans lien avec les grades du jeu.
_À éviter_ : chef (c'est un grade du jeu), modérateur.

**Délégué** :
Membre d'un Espace d'alliance nommé par un Admin pour valider les Demandes.
_À éviter_ : validateur, officier.

**Phrase de chiffrement** :
Le secret qu'une personne choisit pour protéger sa clé personnelle, distinct du lien magique de connexion.
_À éviter_ : mot de passe.

## Entraide

**Demande** :
Un joueur demande des ressources pour une construction ou une recherche précise ; une fois validée, les autres membres peuvent y répondre par des convois. Un joueur peut en avoir plusieurs, qu'il trie lui-même.
_À éviter_ : requête, ticket, besoin.

**Production** :
Ce qu'un joueur récolte par jour, moins la taxe qu'il verse à son colonisateur, plus celles que lui versent ses colonies.
_À éviter_ : revenu, rendement.

**Solde** :
Convois reçus moins convois envoyés par un joueur sur les 30 derniers jours, nourriture et matériaux additionnés.
_À éviter_ : dette, balance.

**Priorité** :
Le Solde d'un joueur divisé par sa Production : combien de jours de sa propre production il a déjà reçus. Le plus bas passe en premier ; c'est un classement affiché, jamais une décision automatique.
_À éviter_ : score, rang.

**Clé d'alliance** :
Le secret partagé par les membres d'une alliance, qui chiffre ses données. Le Site Optizzz ne la connaît pas.
_À éviter_ : mot de passe d'alliance.
