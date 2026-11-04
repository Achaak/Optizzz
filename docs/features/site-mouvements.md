# Mouvements du jour (Espace d'alliance)

Une page que tout le monde ouvre chaque jour : toutes les arrivées de l'alliance, heure par heure (heure de Paris), pour la journée choisie. Floods, convois et chasses qui rentrent, regroupés quand ils se répètent. Tout est calculé dans le navigateur à partir des Envois déjà ouverts dans la page de l'espace (`docs/features/site-envois.md`) : aucune donnée nouvelle ne part.

## Décisions (cadrage du 2026-11-03)

1. **Onglet à part « Mouvements »**, après « État ». Un lien `?onglet=mouvements` l'ouvre. Pas de compteur sur l'onglet.
2. **Jours** : de J-6 (ce que le site garde des floods) au dernier jour où quelque chose arrive. Le jour courant est affiché par défaut, avec ‹ veille / lendemain › et un choix des jours disponibles. Le jour est dans l'adresse (`&jour=2026-11-02`). Les jours sont ceux de Paris, de minuit à minuit. L'historique long des convois reste dans l'onglet « Convois ».
3. **Chasses** : toutes celles lues dans le dernier état de chaque membre et dans celui d'avant, passées comprises, sans doublon (même membre, même heure de retour). Une note le dit : « Chasses connues par le dernier état de chaque membre : certaines déjà rentrées peuvent manquer. » Depuis le chantier 20, le journal des chasses (`site-envois.md`, « Chasses par membre ») s'y ajoute, rentrées comprises ; la note ne nomme plus que les membres dont les chasses ne viennent que des états.
4. **Filtres** : un membre (expéditeur ou cible ; « Moi » en tête de la liste) et des types (Floods · Convois · Chasses, tous cochés par défaut). Les deux sont dans l'adresse (`&membre=Zeph&types=floods,convois`), et les valeurs par défaut n'y figurent pas.
5. **Regroupement** : même type, même expéditeur, même cible, dans la même heure de Paris → une ligne « ×N » avec le total. Pour les chasses, ce sont celles d'un même membre dans la même heure. Un clic déplie le groupe (bouton `aria-expanded`) et montre chaque mouvement avec son heure à la minute et sa quantité. Une ligne seule affiche son heure (« 13 h 36 »), un groupe sa plage (« 13 h 02 – 13 h 51 »).
6. **Heures passées repliées** le jour courant, derrière « Afficher les heures précédentes · 13 heures, 110 mouvements ». L'heure en cours est toujours visible, marquée « maintenant » par un trait et un mot. Un autre jour s'affiche en entier. Seules les heures qui ont au moins un mouvement apparaissent. L'état déplié n'est pas mémorisé.
7. **Disposition** : une liste verticale par heure, partout. Sur ordinateur, l'heure est dans une colonne étroite à gauche ; à 375 px, elle devient un intertitre. Chaque ligne donne le type en mot et en forme (◆ Flood, ■ Convoi, ● Chasse ; jamais la seule couleur, ADR 0003), expéditeur → cible, la quantité et l'heure.
8. **Tuiles en tête**, pour le jour choisi et selon les filtres : Floods (nombre, prise prévue par le Plan de flood quand elle est connue), Convois (nombre, nourriture, matériaux), Chasses (nombre, TdC rapporté). Les tuiles comptent les mouvements, pas les groupes. Une tuile disparaît quand son type est décoché.
9. **Convois arrivés non confirmés** : un jour passé montre les convois « livrés » et les convois « en route » dont l'arrivée est passée sans livraison correspondante. L'appariement se fait un à un : même expéditeur, même destinataire, même nourriture, mêmes matériaux, à ±5 minutes. Ces convois sont marqués « arrivé, non confirmé » en toutes lettres.

## Fichiers

- `apps/web/src/lib/envois/movements.ts` (+ test) : fonctions pures (mouvements d'un jour de Paris, appariement des convois, regroupement par heure, filtres, tuiles).
- `apps/web/src/lib/envois/movement-view.ts` (+ test) : le choix lu et écrit dans l'adresse.
- `apps/web/src/components/spaces/movements-panel.tsx` : la vue.
- `apps/web/src/components/spaces/member-space.tsx` : l'onglet.
