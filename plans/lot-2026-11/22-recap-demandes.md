# 22 · Récapitulatif et historiques des Demandes

Priorité 3 · effort S · dépend de : rien · conflits : `demandes-panel.tsx` (seul fichier partagé avec d'autres travaux sur les Demandes).

## But

- **Récapitulatif par joueur** : Demandes faites, validées, terminées, annulées, refusées, date de la dernière. Pour repérer qui demande beaucoup ou peu.
- **Historiques** : les Demandes terminées filtrables (statut, demandeur, période), et les convois rattachés (envoyés pour une Demande, déclarés compris) en liste.

## Ce qui existe déjà

- « Terminées (90 derniers jours) » repliée dans l'onglet Demandes (`FinishedPanel`), les Demandes servies avec leurs dates, statuts, `decidedByPseudo`.
- Les convois rattachés et déclarés ouverts dans `openDemandes` (`AttachedConvoy`).
- Conservation : 90 jours après la fin.

## À cadrer

1. Où : une vue « Récapitulatif » / « Historique » dans l'onglet Demandes (choix en tête comme « Statistiques | Liste »), ou des blocs repliés ?
2. Colonnes du récapitulatif ; tri ; un taux de refus ?
3. L'historique des convois rattachés : par Demande (dépliable) ou une liste à plat ?

## Proposition par défaut

Choix « Demandes | Récapitulatif | Historique » dans l'onglet, vue dans l'adresse ; fonctions pures dans `lib/demandes/recap.ts` + test.

## Maquette

Artboard « C · Espace d'alliance · Demandes (récapitulatif) ».

## Fini quand

Fonctions testées, vues montées, doc `site-demandes.md`, vérifié avec une page de démonstration.
