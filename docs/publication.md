# Publier Optizzz

## Une nouvelle version (une fois les fiches créées)

1. Mettre à jour `version` dans `package.json` (source unique de la version), commiter.
2. Créer et pousser le tag : `git tag v1.2.3 && git push origin v1.2.3`.
3. Le workflow `.github/workflows/release.yml` vérifie que le tag correspond à la version, construit les zips, les soumet aux deux stores (`wxt submit`) et crée la release GitHub avec les zips.

## Première publication (à la main, une seule fois)

Les fiches doivent exister avant que le workflow puisse publier.

### Construire les paquets

```bash
pnpm install --frozen-lockfile
pnpm zip            # .output/optizzz-X.Y.Z-chrome.zip
pnpm zip:firefox    # .output/optizzz-X.Y.Z-firefox.zip + optizzz-X.Y.Z-sources.zip
```

### Chrome Web Store

1. Compte développeur : https://chrome.google.com/webstore/devconsole (frais uniques de 5 $, validation du compte).
2. « Nouvel élément » → téléverser `optizzz-X.Y.Z-chrome.zip`.
3. Remplir la fiche, la confidentialité et la distribution (publique) avec `docs/store/fiche.md`, ajouter les captures.
4. Soumettre pour examen.
5. Noter l'**ID de l'extension** (dans l'URL de la fiche) et l'**ID d'éditeur** (« Publisher ID », page Compte).

### Firefox Add-ons (AMO)

1. Compte : https://addons.mozilla.org/developers/ .
2. « Soumettre une nouvelle extension » → « Sur ce site » (listed) → téléverser `optizzz-X.Y.Z-firefox.zip`, puis `optizzz-X.Y.Z-sources.zip` quand il demande les sources.
3. Remplir la fiche avec `docs/store/fiche.md`, cocher Firefox pour Android.
4. L'identifiant de l'extension est `optizzz@achaak.github.io` (fixé dans `wxt.config.ts`, **ne jamais le changer**).

### Secrets GitHub pour le workflow

Dans _Settings → Secrets and variables → Actions_ du dépôt :

| Secret                                      | Où le trouver                                                                                            |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `CHROME_EXTENSION_ID`                       | URL de la fiche Chrome                                                                                   |
| `CHROME_PUBLISHER_ID`                       | Console développeur Chrome → Compte                                                                      |
| `CHROME_SERVICE_ACCOUNT_CLIENT_EMAIL`       | Compte de service Google Cloud (API Chrome Web Store activée), ajouté dans la console développeur Chrome |
| `CHROME_SERVICE_ACCOUNT_PRIVATE_KEY`        | Clé JSON de ce compte de service (champ `private_key`)                                                   |
| `FIREFOX_EXTENSION_ID`                      | `optizzz@achaak.github.io`                                                                               |
| `FIREFOX_JWT_ISSUER` / `FIREFOX_JWT_SECRET` | https://addons.mozilla.org/developers/addon/api/key/                                                     |

Pour obtenir et vérifier ces valeurs pas à pas : `pnpm dlx publish-extension init` (écrit dans `.env.submit`, ignoré par git), puis `pnpm wxt submit --dry-run` vérifie l'authentification sans rien publier.
