# Publicité sur le site

Décidé le 2026-10-30, après la refonte (`site-refonte.md`) : Google AdSense, **sans pistage**. Ni bandeau de consentement ni CMP : le site ne demande jamais de consentement, il dit d'emblée à Google qu'il n'y en a pas.

## Comment

- Avant le script d'AdSense, `src/lib/ads.ts` (`ADS_CONSENT_SCRIPT`) pose le mode de consentement de Google, tout refusé (`ad_storage`, `ad_user_data`, `ad_personalization`, `analytics_storage`), et demande des annonces non personnalisées (`requestNonPersonalizedAds`). Google sert alors des annonces limitées ou non personnalisées.
- Selon l'aide d'AdSense (relevé le 2026-10-30), un trafic de l'EEE sans CMP certifiée n'a pas droit aux annonces personnalisées, mais peut recevoir des annonces non personnalisées ou limitées. Les annonces limitées ne lisent ni cookie ni identifiant ; les « annonces limitées programmatiques » gardent un cookie et un stockage local réservés à la détection de la fraude, qu'on peut couper dans AdSense (Sécurité de la marque › Commandes de blocage › Diffusion des annonces). Ce que Google fait vraiment d'un `ad_storage` refusé sur `adsbygoogle` n'est pas écrit noir sur blanc : à vérifier dans le navigateur (cookies de `googlesyndication.com` et `doubleclick.net`) une fois le compte actif.
- Revenus attendus : bien plus bas que des annonces personnalisées.

## Où

Seulement sur les pages faites d'un texte rédigé : une unité « display » responsive, marquée « Publicité », sa hauteur réservée.

- guides (`site-guides.md`), en bas d'un guide, après son pied, jamais au milieu du texte ;
- outils, sous leur « Comment ça marche », jamais à côté du formulaire ;
- vue d'ensemble d'un serveur, entre les graphiques et les classements.

Jamais sur l'accueil ni sur la liste des guides (des pages de navigation), ni sur les listes des joueurs et des alliances ou le Journal (des données sans texte), ni dans les Espaces d'alliance, le compte, la connexion ni les pages légales, ni sur les pages `noindex` (fiche d'un joueur, fiche d'une alliance, Comparer), ni dans un outil sans « Comment ça marche », ni sur « À propos ».

Refus d'AdSense du 2026-11-09 : « Annonces Google diffusées sur des pages ou écrans sans contenu d'éditeur » et « Contenu à faible valeur informative ». D'où les règles ci-dessus : une page que l'on dit soi-même sans intérêt pour un moteur (`noindex`), un outil dont le serveur ne rend qu'un formulaire et un résultat vide, une liste ou un journal vides ne portent pas d'annonce. Un outil retrouve la sienne avec son texte rendu par le serveur (`ToolPage`, prop `help`, `site-outils.md`), l'annonce sous ce texte. Le 2026-11-12, après relecture des règles d'AdSense (« pages en cours de construction », « pages de navigation »), les guides à venir ne sont plus montrés nulle part (`WRITTEN_GUIDES`), les annonces quittent l'accueil, la liste des guides, les listes et le Journal, et le site publie un `sitemap.xml`. Le second motif se règle par le contenu : les guides, « À propos » (`site-a-propos.md`) et l'aide des outils.

## Réglages

- `NEXT_PUBLIC_ADSENSE_CLIENT` (« ca-pub-… ») et `NEXT_PUBLIC_ADSENSE_SLOT` (l'unité) en variables GitHub, passées au build de l'image du site (`.github/workflows/deploy.yml`). Le compte seul pose de quoi faire valider le site (script, balise `google-adsense-account`, `ads.txt`) ; les emplacements attendent aussi l'unité. Sans compte : aucun script de Google (dev).
- `/ads.txt` est servi à partir du client (`src/app/ads.txt/route.ts`), 404 sans compte.
- Dans AdSense : site `optizzz.fr` à faire valider, une unité « Display » responsive, cookies propriétaires désactivés.

## Fichiers

| Fichier                               | Rôle                                                 |
| ------------------------------------- | ---------------------------------------------------- |
| `apps/web/src/lib/ads.ts` (+ test)    | Consentement refusé, ligne d'ads.txt                 |
| `apps/web/src/lib/ads-config.ts`      | Le compte AdSense, lu dans l'environnement           |
| `apps/web/src/components/ad-slot.tsx` | Un emplacement, rien sans compte                     |
| `apps/web/src/app/layout.tsx`         | Consentement, balise de validation, script d'AdSense |
| `apps/web/src/app/privacy/page.tsx`   | Ce que le visiteur doit savoir                       |
