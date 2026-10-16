# Feature : Production sur les profils

Décidée le 2026-10-16.

## But

Sur le profil d'un joueur (`Membre.php`), estimer ce qu'il produit par jour à partir de son seul TDC, pour juger une cible, une colonie ou un membre.

## Comportement

- **Où** : une ligne « Production max : » ajoutée juste sous « Etat : » dans l'encart « Informations », alignée comme les lignes du jeu (libellé à droite, chiffre en gras). Le détail de la taxe suit en petit et en gris, et passe à la ligne sur téléphone.
- **Calcul** : TDC × 48 (une ouvrière au travail par cm², une ressource toutes les 30 min ; `../research/ressources-et-entretien.md`). C'est un plafond : on suppose assez d'ouvrières pour tout le TDC. Nourriture et matériaux ensemble, sans la champignonnière (inconnue chez un autre joueur). TDC en direct, lu dans le tableau des scores du profil.
- **Fourmilière libre** : « **≈ 57 902 352** par jour ».
- **Fourmilière soumise** : la taxe de colonie (20 % + 1 % par niveau de l'Étable à pucerons du maître, arrondie à l'inférieur comme le jeu) est déduite, et la production avant taxe rappelée dans le détail.
  - Taux connu : mon propre profil (taux de `Ressources.php`, mémorisé par les Prévisions) ou une de mes colonies (mon Étable à pucerons, `game-levels`) → « **≈ 38 794 576** par jour (taxe de 33 % déduite, 57 902 352 avant) ».
  - Sinon le niveau d'étable du maître n'est pas lisible : la taxe minimale de 20 % donne un plafond → « **≤ 46 321 882** par jour (taxe d'au moins 20 % déduite, 57 902 352 avant) ».
- L'infobulle de la ligne rappelle le calcul. La feature se coupe dans « Fonctionnalités ».

## Limites

- Ne tient pas compte des ouvrières réelles du joueur (inconnues), ni de ce qu'un maître touche de ses propres colonies.

## Code

| Fichier                                    | Rôle                                            |
| ------------------------------------------ | ----------------------------------------------- |
| `src/game/production.ts`                   | Production d'un TDC, taux de taxe de colonie    |
| `src/game/pages/scores.ts`                 | `readProfileState` : libre ou soumise, et à qui |
| `src/features/profile-production/mount.ts` | Texte et ligne sous « Etat »                    |
| `src/features/profile-production/index.ts` | Choix du taux de taxe (connu ou minimal)        |
