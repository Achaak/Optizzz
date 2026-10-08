# Feuille de route

Décidée lors d'une session de cadrage (`/grill-me`) le 2026-10-07. Chaque feature a son propre `/grill-me` court juste avant d'être codée ; cette page ne garde que l'ordre et les décisions qui touchent plusieurs features.

## Ordre

1. **Activer / désactiver les fonctionnalités** : voir `feature-toggles.md`.
2. **Heures de fin** : l'heure de fin à côté des décomptes du jeu et un encart « Prochaines fins » ; voir `end-times.md`.
3. **Rapports de chasse** (`messagerie.php`) : tableau des combats, pertes prévues par le moteur ; voir `hunt-reports.md`. Attaque et défense : [#1](https://github.com/Achaak/Optizzz/issues/1).
4. **Simulateur de combat** (attaque / défense, Dôme et Loge) ; voir `combat-simulator.md`.
5. **Planificateur de ponte** : fin, date à laquelle on pourra payer, entretien, « max » ; voir `laying-planner.md`.
6. **Calculateur de convoi** : trajet, arrivée, ouvrières prises, destinataires suggérés ; voir `convoy.md`.
7. **Cibles à portée** (`ennemie.php`) : joueurs entre 50 % et 300 % de son TDC, triés par distance, avec trajet, état, pactes et guerres ; voir `cibles.md`.
8. **Renforts** : qui peut arriver avant une attaque entrante.
9. **Chaîne de TDC** : qui peut prendre à qui, ordre de passage.
10. **Historique de progression** : TDC et scores en courbes.
11. **Alertes** : badge de l'icône, puis notifications.

## Décisions transverses

- **Modèle d'armée partagé** : `src/game/army/` (unités, proies, combat), sorti du lanceur de chasse ; combat, ponte, rapports et chasse s'en servent.
- **Placement** : chaque outil s'insère sur la page du jeu où il sert (ADR 0001). Un accès depuis la roue seulement pour un outil sans page naturelle (simulateur de combat, peut-être).
- **Historique** : export public nocturne pour le passé (jamais purgé, tous les joueurs), plus un point « maintenant » lu en direct.
- **Actions de jeu** : liens pré-remplis vers les formulaires d'attaque ou de convoi du jeu, que le joueur valide lui-même. Jamais d'automatisation.
- **Alertes** :
  - étape 1, badge : background script + permission `alarms`, calculé depuis les données mémorisées (dont les fins mémorisées par « Heures de fin »), sans jamais interroger le jeu. Délai avant le premier problème (rouge < 2 h, orange < 12 h, rien sinon), « ? » gris si les données ont plus de 24 h, pire des serveurs avec le détail par serveur au survol ;
  - étape 2, notifications : permission `notifications` **optionnelle**, demandée à l'activation. Types activables un par un, tous coupés par défaut : famine, entrepôt plein, chantier terminé, chasse rentrée. Le serveur est nommé (« S5 : … »). Pas d'attaque entrante ;
  - mettre à jour `PRIVACY.md` et `docs/store/fiche.md` avant de publier.
