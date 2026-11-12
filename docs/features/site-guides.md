# Guides publics du site

Décidé lors d'une session de cadrage (`grilling`) le 2026-11-04 (chantier 31 du lot de novembre, `plans/lot-2026-11/31-guides-publics.md`). Maquette : artboard « C · Guide » du canevas « Optizzz — maquettes du site ».

## But

Des pages publiques, sans compte, qui expliquent le jeu avec les outils d'Optizzz. Elles servent à accueillir un nouveau membre d'alliance et à être trouvées par les moteurs de recherche.

## Décisions

1. **Ordre** : la **Chaîne de TDC** d'abord, puis le **Flood** (même socle de règles), puis le **Timing à la seconde**, une fois que la feature de l'extension existe pour être montrée (`docs/research/timing-attaques.md`).
2. **Format** : des pages du site en composants serveur (TSX), sans MDX ni PDF. Quelques briques sont partagées entre les guides (mention de statut, figure, sommaire), et un registre `GUIDES` joue le même rôle que `TOOLS`.
3. **Ce qui est vérifié** : chaque règle porte une mention, faite d'un texte et d'une icône, jamais de la seule couleur (ADR 0003) :
   - « Vérifié dans le jeu » (avec la date) ;
   - « D'après les joueurs » ;
   - « Non vérifié ».

   Un encadré « Ce qui n'est pas vérifié » termine chaque guide. Aucun site ni outil tiers n'est cité comme source : seuls l'aide du jeu et le règlement peuvent être nommés.

4. **Illustrations** : elles sont dessinées par le site et calculées avec les vraies fonctions de `@optizzz/game`, sur une alliance **inventée**. Pas de capture d'écran du jeu, pas de vraie donnée de joueur. Elles restent ainsi justes en clair comme en sombre, et à jour quand les règles changent.
5. **Adresses** : la liste à `/guides`, un guide à `/guides/<id>` (`/guides/tdc-chain`). Ces pages sont indexées. Liens :
   - « Guides » dans le menu principal, après « Outils » ;
   - une entrée sur l'accueil ;
   - « Lire le guide » depuis les outils concernés (simulateur de flood, onglet Chaîne d'un Espace) ;
   - depuis le guide, des liens vers ces outils.
6. **Publicité** : une unité en bas d'un guide, après le contenu, et une sur la liste. Jamais au milieu du texte (`site-publicite.md`).
7. **Lecteur visé** : un nouveau membre d'alliance qui connaît les bases (TDC, attaque, Vitesse d'attaque) mais n'a jamais pris part à une chaîne. Texte court, en vouvoyant le lecteur. Les mots du jeu sont définis à leur première apparition. Le calcul interne d'Optizzz n'est pas détaillé.
8. **L'alliance de démonstration** : sept membres aux pseudos inventés, Brindebois et Chaumelune (greniers), Ardoisine et Terrepaille (passeurs), Mandiflore, Pollenard et Ramille (chasseurs), absents de S1 à S5 dans l'export du 2026-11-04. Les noms de fourmis proposés au cadrage (Formica, Lasius…) existaient tous sur un serveur. Les TDC montrent deux greniers, deux passeurs, trois chasseurs et une « chaîne cassée » : Ramille est hors de portée de tous les échelons au-dessus, et Mandiflore ou Pollenard ont le TDC du passeur qui manque. Les rôles sont posés à la main : ceux que propose Optizzz d'après le TDC feraient de Mandiflore et Pollenard des passeurs.
9. **Lien vers l'outil** : sous l'ordre de passage, « Essayer l'attaque n° 1 dans le simulateur de flood » ouvre `/tools/flood#p=…` avec les deux TDC, la Vitesse d'attaque 4 et autant de JSN que de cm² à prendre : le simulateur prend le même total, en deux attaques. C'est un lien `<a>` et non un `Link` de Next : l'outil lit son `#p=` à l'ouverture, avant qu'une navigation côté client ne l'ait posé dans l'adresse.
10. **Pied d'un guide** :
    - « Mis à jour le … » ;
    - le lien vers l'extension ;
    - les autres guides (« Bientôt » tant qu'ils ne sont pas écrits) ;
    - la publicité.

## Guide « Chaîne de TDC »

Plan :

1. À quoi sert une chaîne.
2. Les règles :
   - portée 50 % (inclus) – 300 % (exclu), vérifiée à chaque arrivée ;
   - prise `min(fourmis, 20 % du TDC)` ;
   - attaques simultanées = Vitesse d'attaque + 1.
3. Les rôles.
4. Qui peut prendre à qui (illustration).
5. L'ordre de passage (illustration), et la chaîne cassée.
6. Avec Optizzz : la Chaîne de l'extension, les rôles et le plan de passage d'un Espace, le simulateur de flood.
7. Ce qui n'est pas vérifié.

Un sommaire en tête de page. Sources : `../research/combat.md`, `chaine-tdc.md`, `site-chaine.md`.

## Liste des guides (2026-11-12)

Refaite après le refus d'AdSense (maquette « E · Guides (liste) ») : « Comprendre Fourmizzz », l'explication des trois mentions, puis les guides en deux groupes, **Les bases** (Bien débuter, La chasse, Nourriture et entretien, Le combat, Les temps de trajet) et **En alliance** (Chaîne de TDC, Flood, Timing à la seconde). Chaque carte : numéro, durée et date une fois écrit, résumé, quelques repères ; « Bientôt » tant que le guide n'est pas écrit. Sous les groupes, « Du guide à l'outil » relie chaque guide à son outil (`tool` du registre). Les nouveaux guides s'appuient sur `../research/` (chasse, combat, trajets, ressources), avec les mêmes règles de mentions et de sources.

## Réalisation

- **Le registre** (`apps/web/src/lib/guides/guides.ts`) : les guides dans l'ordre de lecture, par groupe (`GUIDE_GROUPS`), écrits ou « bientôt », leurs repères, leur outil, la date de mise à jour et la durée de lecture.
- **Les briques** (`apps/web/src/components/guides/guide-parts.tsx`) :
  - `CertaintyMark` : la mention, avec trois traits de bordure (plein, tirets, pointillés) et trois icônes (coche, bulle, point d'interrogation) ;
  - `Rule` : une règle et sa mention ;
  - `GuideSection` : une section numérotée ;
  - `GuidePage` : titre, sommaire à côté du texte (au-dessus sur téléphone), pied, publicité.

  Le texte courant prend la classe `guide-text` (`globals.css`).

- **La démonstration** (`apps/web/src/lib/guides/tdc-chain-demo.ts`, testée) : `takeMatrix` et `planChain` de `@optizzz/game`, avec la marge de la Chaîne. Le passeur manquant est donné par `bridge`, entre le chasseur hors d'atteinte et le plus petit passeur.
- **Les pages** : `/guides` (liste) et `/guides/tdc-chain`, sous la barre de section « Guides ». Les liens des stores de l'extension sont partagés avec l'accueil (`src/lib/extension-stores.ts`).
- **Les liens** :
  - « Guides » dans le menu principal ;
  - un bandeau « Guides » sur l'accueil (visiteur et connecté) ;
  - le guide dans la note du simulateur de flood, et « Lire le guide de la chaîne » dans l'onglet Chaîne d'un Espace.

## Sources du guide « Chaîne de TDC »

| Règle                                      | Mention               | D'où                                                                     |
| ------------------------------------------ | --------------------- | ------------------------------------------------------------------------ |
| Portée 50 % (inclus) – 300 % (exclu)       | Vérifié · aide du jeu | Aide « Attaque & Défense », bornes du formulaire d'attaque (`combat.md`) |
| Portée revérifiée à l'arrivée, marge d'1 % | Non vérifié           | Supposé par Optizzz (`chaine-tdc.md`)                                    |
| Prise : 20 %, 1 cm² par fourmi au plus     | Vérifié · aide du jeu | Aide « Les Combats » ; arrondi et fourmis survivantes non tranchés       |
| Attaques à la fois : Vitesse d'attaque + 1 | Vérifié · 8 oct. 2026 | Simulateur de flood du jeu (`combat.md`)                                 |

## Vérification

Vérifié en local le 2026-11-04 (`next dev`, sans base pour les guides) :

- `/guides`, `/guides/tdc-chain` et le bandeau de l'accueil, en clair et en sombre, sur bureau et à 375 px, sans défilement horizontal de la page (les tableaux défilent dans leur cadre) ;
- le lien vers le simulateur, qui prend 49 917 cm² en deux attaques, comme l'attaque n° 1 du plan.

**À relire par le joueur** avant de considérer le premier guide comme fini.
