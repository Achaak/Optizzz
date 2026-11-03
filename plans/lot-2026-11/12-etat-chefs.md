# 12 · Tableau des membres pour les chefs (onglet « État »)

Priorité 2 · effort M · dépend de : rien · conflits : `state-panel.tsx`, `lib/envois/states.ts`.

## But

Une vue d'ensemble des membres pour les Admins et Délégués : une ligne par membre, des colonnes au choix (TDC, ouvrières, Armes, Bouclier, Vitesse d'attaque, Dôme, Loge, armée totale, convois et floods en cours ↑ envoyés / ↓ reçus…), **la date du relevé dans chaque case**, et ce que chacun envoie (extension liée, catégories cochées, dernier Envoi).

## Ce qui existe déjà

- L'onglet « État » (`components/spaces/state-panel.tsx`, `lib/envois/states.ts`) : états fusionnés partie par partie, groupes Résumé, Production, Armée, Chasses, Bâtiments…
- `sends` (ce que chaque membre envoie) dans la lecture des Envois ; « 8 membres sur 10 envoient leurs floods » dans les stats de floods.
- Absences dans la colonne de côté de l'espace.

## À cadrer

1. Une vue « Tableau » dans « État » (proposition) ou un remplacement de l'actuelle ?
2. Réservé aux Admins et Délégués, ou visible de tous (tout le monde voit déjà tout, `site-envois.md` « Qui voit quoi ») ?
3. Liste des colonnes possibles, colonnes par défaut, mémorisées où (navigateur, `localStorage`) ?
4. Âge d'un relevé : date sous la valeur, ou valeur grisée au-delà de N heures ? Quel N ?
5. « Dernière activité » : le dernier Envoi reçu suffit-il (on n'a rien d'autre) ?
6. Mobile : colonnes secondaires masquées, défilement dans la boîte.

## Proposition par défaut

Vue « Tableau » dans « État », pour tous, colonnes choisies dans un menu (mémorisées dans le navigateur), date courte sous chaque valeur (« 02/11 »), grisée au-delà de 48 h ; dernière colonne « Envoie » (catégories en mots) et « Dernier Envoi ».

## Maquette

Artboard « C · Espace d'alliance · État (tableau) ».

## Fini quand

Colonnes et âge testés en fonctions pures, vue montée, doc dans `site-envois.md` (section « État »), vérifié avec une page de démonstration.
