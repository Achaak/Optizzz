# 20 · Chasses par membre (Espace d'alliance)

Priorité 3 · effort M · dépend de : rien · conflits : `member-space.tsx` si nouvel onglet ; avec 10 sur les chasses (`lib/envois/states.ts`).

## But

Sur une période : nombre de chasses rentrées, terrain chassé, moyenne par chasse, dernière rentrée, chasses en cours et cm² attendus, par membre et pour l'alliance.

## Ce qui existe déjà

- L'état « Chasses » de l'Envoi : **seulement les chasses encore dehors** (retour, gain), le dernier relevé et le précédent. Le passé n'est pas gardé.
- Stats des floods et des convois (modèle à suivre : tuiles, par membre, période dans l'adresse, copie Discord).

## À cadrer

1. Le site ne garde pas les chasses rentrées : faut-il une nouvelle catégorie d'Envoi en liste (`hunts-done` : une ligne par chasse rentrée, 90 jours), envoyée avec la case « Chasses » déjà cochée ? (proposition : oui ; le dire dans `PRIVACY.md`, `docs/store/fiche.md`).
2. D'où vient une chasse rentrée côté extension : les rapports de chasse de la messagerie (`hunt-reports`) ou la disparition d'une chasse de l'état ?
3. Où : vue « Statistiques | Liste » d'un nouvel onglet « Chasses », ou un bloc de l'onglet « État » ?
4. Périodes : 24 h / 7 jours / 30 jours ?

## Proposition par défaut

Catégorie de liste `hunts-done` (gain, retour, unités en Nombre), envoyée avec « Chasses » ; onglet « Chasses » avec « Statistiques | Liste » sur le modèle des Floods.

## Maquette

Artboard « C · Espace d'alliance · Chasses (stats) ».

## Fini quand

Nouvelle catégorie de bout en bout (extension, site, lecture), tests (service du site, élément, stats), doc `site-envois.md`, `PRIVACY.md`, `docs/store/fiche.md` à jour, vérifié avec une page de démonstration. L'extension et le site sortent ensemble.
