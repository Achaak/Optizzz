# 11 · Équilibre des ressources et entrepôt estimé (Espace d'alliance)

Priorité 2 · effort M-L · dépend de : rien · bloque : 23 · conflits : `lib/envois/convoy-stats.ts`, `convoy-stats-view.tsx` (avec 21).

## But

Répondre à « qui doit convoyer, qui doit recevoir » sur une période, alliance entière :

- **Part** de chacun : la production de l'alliance sur chaque cycle de 30 minutes, partagée à parts égales entre les membres présents à ce moment.
- **Net** = production + taxes de colonies reçues − taxes versées − convois envoyés + convois reçus.
- **Écart** = net − part ; **verdict** « Convoyer » (positif), « Équilibré » (à ±5 % de la part), « Recevoir » (négatif), avec le **ratio** net / part.
- **Entrepôt estimé** : le dernier stock connu (Envoi Production, moins de 48 h), plus la production depuis, moins les convois partis, plus les convois arrivés. Un maximum : les dépenses ne sont pas connues.

## Ce qui existe déjà

- Solde et Priorité des Demandes (`packages/game/src/site-links/priorite.ts`, `GLOSSARY.md`) : une autre vision, par demandeur, sur 30 jours. Les deux doivent se compléter, pas se contredire.
- `productionPerDay` (état Production : récolte, taxes, colonies), `convoyStats` (convois par membre sur 7 / 30 / 90 jours).
- La Production d'alliance de l'extension (`statistiques-alliance.md`, plafond et réel, taxes dans / hors alliance).

## À cadrer

1. Où : une vue « Équilibre » dans l'onglet « Convois » (proposition), ou un onglet à part ?
2. La part à parts égales est-elle la règle voulue, ou une part au prorata du TDC, ou réglable par l'Admin ?
3. Production : le plafond (TDC × 48) de l'export horaire pour tous, ou la Production réelle de l'Envoi quand on l'a (et le plafond sinon, marqué « ≈ ») ?
4. Taxes entre membres : comptées dans le net de chacun (oui, proposé), hors du total d'alliance.
5. Seuil « Équilibré » : ±5 % fixe ou réglable ?
6. Membres qui n'envoient pas Convois : leur net est partiel — exclus du verdict, ou montrés « ≈ » ?
7. Lien avec la Priorité : montrer l'écart à côté de la Priorité dans l'onglet Demandes, ou pas du tout ?
8. Historique du TDC par membre : l'export horaire est-il disponible côté site pour reconstituer la production cycle par cycle (`PlayerDay` / relevés horaires) ? Sinon, quelle approximation ?

## Proposition par défaut

Vue « Équilibre » dans « Convois », période 7 / 30 jours, tableau triable (membre, TDC, entrepôt estimé, production, colonies, envoyés, reçus, écart, ratio, verdict en mot), note de méthode dépliable. Calcul pur dans `lib/envois/balance.ts` + test, à partir des Envois déjà ouverts et d'un historique de TDC servi par le site (données publiques).

## Maquette

Artboard « C · Espace d'alliance · Convois (équilibre) ».

## Fini quand

Formules testées (cas : membre arrivé en cours de période, colonie interne, membre sans Convois), vue montée, doc dans `site-envois.md` et `GLOSSARY.md` (Part, Écart), vérifié avec une page de démonstration.
