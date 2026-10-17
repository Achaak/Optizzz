# Publier Optizzz

## Une nouvelle version (une fois les fiches créées)

1. Mettre à jour `version` dans `package.json` (source unique de la version), commiter (`chore(release): 1.2.3`) et pousser sur `main`. Rien d'autre : pas de tag à créer.
2. Le workflow `.github/workflows/release.yml` part de lui-même dès qu'un push sur `main` touche `package.json`. Si le tag `v1.2.3` existe déjà, il s'arrête là (version déjà publiée). Sinon il relance toutes les vérifications de la CI, construit les zips, les soumet aux deux stores (`wxt submit`) et crée la release GitHub avec les zips, qui pose le tag `v1.2.3`.
3. Si une version précédente est encore en examen chez Chrome, son examen est annulé et la nouvelle version prend sa place (`--chrome-cancel-pending`) : l'examen repart de zéro.
4. Si la soumission échoue (secret refusé, store indisponible…), corriger puis relancer à la main : _Actions → Release → Run workflow_ sur `main`, ou `gh workflow run release.yml`. Faute de tag, la version est republiée.

Les stores refusent une version déjà soumise : toute nouvelle publication passe par une nouvelle version dans `package.json`.

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

Fiche publiée : https://chromewebstore.google.com/detail/optizzz/goeifkbimepccacjfkkmhjmhgoiigjpl (ID `goeifkbimepccacjfkkmhjmhgoiigjpl`).

### Firefox Add-ons (AMO)

1. Compte : https://addons.mozilla.org/developers/ .
2. « Soumettre une nouvelle extension » → « Sur ce site » (listed) → téléverser `optizzz-X.Y.Z-firefox.zip`, puis `optizzz-X.Y.Z-sources.zip` quand il demande les sources.
3. Remplir la fiche avec `docs/store/fiche.md`, cocher Firefox pour Android.
4. L'identifiant de l'extension est `optizzz@achaak.github.io` (fixé dans `wxt.config.ts`, **ne jamais le changer**).

Fiche publiée : https://addons.mozilla.org/fr/firefox/addon/optizzz/ (slug `optizzz`).

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

Pour les créer pas à pas : `bash scripts/setup-release-secrets.sh`. L'assistant ouvre chaque page (Google Cloud, console Chrome, AMO), récupère les valeurs, les pose en secrets GitHub avec `gh secret set`, en garde une copie dans `.env.submit` (ignoré par git), vérifie l'authentification avec `wxt submit --dry-run` puis propose de lancer la publication. On peut le relancer : il garde les valeurs déjà saisies. Ancienne méthode : `pnpm dlx publish-extension init` (écrit dans `.env.submit`, ignoré par git), puis `pnpm wxt submit --dry-run` vérifie l'authentification sans rien publier.
