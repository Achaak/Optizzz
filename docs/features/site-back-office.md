# Back office du site

Une page `/admin` pour voir ce qui se passe sur le site. Proposée le 2026-11-02 avec trois maquettes : Vue d'ensemble, Collecte et sauvegardes, Comptes et Espaces (rangée « D · Back office » du canevas des maquettes du site). Premier lot livré : l'accès et la santé du cron et des sauvegardes.

## Accès

- `/admin` s'ouvre aux Comptes Optizzz dont l'adresse **vérifiée** (lien magique) figure dans `ADMIN_EMAILS` : des adresses séparées par des virgules. Variable vide ou absente : personne.
- Tout autre visiteur, connecté ou non, reçoit la page 404 du site. La page n'a pas de titre propre, pour que cette 404 ne nomme pas le back office ; `noindex`.
- Pas de rôle en base : la liste vit dans l'environnement du VPS (`deploy/.env`, demandée par `scripts/setup-vps.sh`).
- Fichiers : `apps/web/src/lib/admin/admin-emails.ts` (règle, testée), `apps/web/src/server/admin.ts` (`requireAdmin`).

## Ce qui est enregistré

La table `JobRun` (schéma `public`) garde chaque passage des tâches du VPS, 30 jours :

- **`ingest`**, écrit par `apps/web/scripts/ingest.ts` à la fin de chaque passage : par serveur, le résultat (`updated`, `unchanged`, `failed` et son erreur), les entrées de Journal écrites, les relevés quotidiens repris et la durée ; puis si les pages ont été reconstruites (`null` sans `SITE_URL`, en local). Un échec de cet enregistrement ne fait jamais échouer le passage. Le cron supprime les passages de plus de 30 jours.
- **`backup`**, écrit par `deploy/backup.sh` (un `trap` à la sortie, en SQL par `psql`) : le fichier, sa taille, la copie dans le bucket Scaleway (`null` sans bucket), et en cas d'échec l'étape qui a lâché (`pg_dump`, `rclone`, `rclone delete`).

Le format de `report` est décrit et relu par des schémas zod dans `apps/web/src/lib/admin/job-runs.ts`. Un compte rendu illisible est ignoré, sans faire tomber la page.

## La page

- **Titre** : « Tout va bien », ou le nombre de points à voir, listés dans « À regarder » :
  - cron en retard (aucun passage depuis 75 min) ;
  - pages du site non reconstruites ;
  - serveur dont le dernier passage a échoué, ou qu'aucun passage n'a lu en 24 h ;
  - sauvegarde absente, de plus de 26 h, ou échouée (avec l'étape), et sauvegarde gardée sur le VPS mais pas copiée dans le bucket.
- **Par serveur** : état, versions lues des deux exports, nombre de joueurs, entrées de Journal et échecs sur 24 h, mise à jour de la carte, durée du dernier passage. Chaque état a un signe et un mot (● à jour, ▲ échec, ○ aucun passage), jamais la seule couleur (ADR 0003).
- **Passages du cron** des dernières 24 h, avec une note par passage (serveurs relus, Journal, erreurs).
- **Sauvegardes** : les 7 dernières, et la taille de la base.

Seul l'administrateur lit ces données ; rien n'est envoyé ailleurs. Aucune mesure d'audience n'est ajoutée.

## Lots suivants (proposés)

1. Vue d'ensemble : nombre de comptes, d'extensions liées, d'Espaces et de Demandes ; nouveaux comptes sur 30 jours ; webhooks Discord refusés et rappels suspendus (`SpaceDiscord.refused*`, `SpaceReminders.suspended*`) dans « À regarder ».
2. Comptes et Espaces, métadonnées seulement : le contenu des Espaces est chiffré et le reste. Adresses masquées ; les afficher en entier serait une action notée.
3. Relancer le cron depuis la page : il faut une commande côté VPS, à cadrer.
