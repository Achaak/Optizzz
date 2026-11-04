# Publicité sur le site

Décidé le 2026-10-30, après la refonte (`site-refonte.md`) : Google AdSense, **sans pistage**. Ni bandeau de consentement ni CMP : le site ne demande jamais de consentement, il dit d'emblée à Google qu'il n'y en a pas.

## Comment

- Avant le script d'AdSense, `src/lib/ads.ts` (`ADS_CONSENT_SCRIPT`) pose le mode de consentement de Google, tout refusé (`ad_storage`, `ad_user_data`, `ad_personalization`, `analytics_storage`), et demande des annonces non personnalisées (`requestNonPersonalizedAds`). Google sert alors des annonces limitées ou non personnalisées.
- Selon l'aide d'AdSense (relevé le 2026-10-30), un trafic de l'EEE sans CMP certifiée n'a pas droit aux annonces personnalisées, mais peut recevoir des annonces non personnalisées ou limitées. Les annonces limitées ne lisent ni cookie ni identifiant ; les « annonces limitées programmatiques » gardent un cookie et un stockage local réservés à la détection de la fraude, qu'on peut couper dans AdSense (Sécurité de la marque › Commandes de blocage › Diffusion des annonces). Ce que Google fait vraiment d'un `ad_storage` refusé sur `adsbygoogle` n'est pas écrit noir sur blanc : à vérifier dans le navigateur (cookies de `googlesyndication.com` et `doubleclick.net`) une fois le compte actif.
- Revenus attendus : bien plus bas que des annonces personnalisées.

## Où

Pages publiques seulement, une unité « display » responsive, marquée « Publicité », sa hauteur réservée :

- accueil (visiteur), entre « Serveurs » et le bandeau de l'extension ;
- vue d'ensemble d'un serveur, entre les graphiques et les classements ;
- listes des joueurs et des alliances, sous le tableau, au-dessus des pages ;
- fiche d'un joueur, en bas ; fiche d'une alliance, entre les courbes et les membres ;
- outils, sous le panneau du résultat, jamais dans le formulaire ni dans le rapport.
- guides (`site-guides.md`), sous la liste et en bas d'un guide, après son pied, jamais au milieu du texte.

Jamais dans les Espaces d'alliance, le compte, la connexion ni les pages légales.

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
