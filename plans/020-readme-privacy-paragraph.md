# Plan 020: The README says what the extension really sends, like PRIVACY.md

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat dfa54c5..HEAD -- README.md PRIVACY.md`
> If either file changed since this plan was written, compare the "Current state" excerpts against the live
> files before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: docs
- **Planned at**: commit `dfa54c5`, 2026-11-12

## Why this matters

Optizzz is a browser extension for the game Fourmizzz, published on the Chrome Web Store and on Firefox
Add-ons; its `README.md` is the public page of the repository, in French. Its privacy paragraph still says
that nothing is ever sent anywhere but to the game, and that alliance sharing only goes through copy and
paste. That was true a month ago. Since then the server map reads its data from the project's own site
(optizzz.fr) by default, and a player may link the extension to an account on that site and send encrypted
data to their alliance's space. `PRIVACY.md`, the policy the stores link to, describes all of this correctly;
the README contradicts it. A privacy statement that is wrong is worse than none. This plan aligns the two
sentences of the README with the policy, without rewriting the policy.

## Current state

- `README.md:70` (a paragraph under the list of alliance features):

  ```markdown
  Les cartes, l'historique et les suivis s'appuient sur l'[API publique des exports](https://s5.fourmizzz.fr/developer.php) du jeu.
  ```

- `README.md:82-84`:

  ```markdown
  ## Confidentialité

  Aucune donnée n'est collectée ni envoyée ailleurs que vers Fourmizzz. Vos réglages restent dans votre navigateur, et le partage d'alliance passe uniquement par votre copier-coller. Voir [PRIVACY.md](PRIVACY.md).
  ```

- What `PRIVACY.md` says, and the README must not contradict:
  - Line 20: the Carte du serveur reads the players' positions from `https://optizzz.fr/api/<serveur>/map` by
    default; the request carries no account and no cookie; the option « Lire les positions sur optizzz.fr »
    switches it off.
  - Section « Ouvrir un outil de optizzz.fr »: three tools have a button that opens the site in a new tab,
    only on a click, with the player's entries in the address fragment, which is never sent to the site.
  - Section « Lier l'extension à votre Compte Optizzz (facultatif) »: only when the player asks, the extension
    is linked to an account on optizzz.fr; data is then sent to the alliance's space, encrypted in the browser
    with a key the site does not know.
- Conventions (from `CLAUDE.md`): text read by players is in French and addresses them as « vous »; the game's
  vocabulary is kept (alliance, convoi, chasse…). The project's own terms are capitalised as in `PRIVACY.md`:
  « Compte Optizzz », « Espace d'alliance », « Carte du serveur ».

## Commands you will need

| Purpose | Command             | Expected on success |
| ------- | ------------------- | ------------------- |
| Format  | `pnpm format:check` | exit 0              |

## Scope

**In scope**:

- `README.md` (the two passages above, nothing else)

**Out of scope**:

- `PRIVACY.md`, `docs/store/fiche.md`, the site's privacy page: they are already right.
- The README's feature list, its use of « tu » elsewhere, its build instructions: known to be dated, a
  separate pass.

## Git workflow

- Branch: `docs/readme-privacy`.
- One commit, e.g. `docs: the README's privacy paragraph follows PRIVACY.md`.
- Never `--no-verify`. Do not push.

## Steps

### Step 1: The data source sentence

Replace line 70 of `README.md` with:

```markdown
Les cartes, l'historique et les suivis s'appuient sur l'[API publique des exports](https://s5.fourmizzz.fr/developer.php) du jeu ; la Carte du serveur lit par défaut ces mêmes données publiques sur [optizzz.fr](https://optizzz.fr), bien plus léger (une option la ramène à l'export du jeu).
```

**Verify**: `grep -c "Carte du serveur lit par défaut" README.md` → `1`.

### Step 2: The privacy paragraph

Replace the paragraph under `## Confidentialité` (line 84) with:

```markdown
Par défaut, l'extension ne parle qu'à Fourmizzz, à une exception près : la Carte du serveur lit les positions publiques des joueurs sur optizzz.fr, sans compte ni cookie (une option la ramène à l'export du jeu). Vos réglages restent dans votre navigateur, et le partage d'alliance passe par votre copier-coller.

Rien d'autre ne part sans vous : un bouton « Ouvrir sur optizzz.fr » ouvre un outil du site avec votre saisie, écrite dans la partie de l'adresse que le navigateur n'envoie pas ; et si vous liez l'extension à un Compte Optizzz, elle envoie à l'Espace de votre alliance ce que vous avez coché, chiffré dans votre navigateur avec une clé que le site ne connaît pas.

Le détail est dans [PRIVACY.md](PRIVACY.md).
```

**Verify**: `grep -c "Aucune donnée n'est collectée ni envoyée ailleurs" README.md` → `0`.
`grep -c "PRIVACY.md" README.md` → at least `1`.

### Step 3: Gate

**Verify**: `pnpm format:check` → exit 0. `git status --short` → only `README.md`.

## Test plan

None: documentation only. The two greps and Prettier are the checks.

## Done criteria

- [ ] The sentence « Aucune donnée n'est collectée ni envoyée ailleurs que vers Fourmizzz » is gone from `README.md`
- [ ] The README names the Carte du serveur's read of optizzz.fr and the optional Compte Optizzz
- [ ] `pnpm format:check` exits 0
- [ ] Only `README.md` is modified
- [ ] `plans/README.md` status row updated

## STOP conditions

- `PRIVACY.md` no longer says what "Current state" lists (the map's default, the tools' button, the optional
  account): the replacement text would then be wrong too.
- Either passage of the README is no longer where the excerpts say, or was already rewritten.

## Maintenance notes

- Any new data that leaves the browser must be added to `PRIVACY.md`, `docs/store/fiche.md` and the
  extension's `data_collection_permissions` (a rule of `CLAUDE.md`); add this README paragraph to that list
  when reviewing such a change.
- The rest of the README is dated too: about ten features are missing from its list, a few sentences still say
  « tu », and its build section presents `pnpm build` as building the extension only while it also builds the
  site, which needs a database. Worth one pass by the owner.
