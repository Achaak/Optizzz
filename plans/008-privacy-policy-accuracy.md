# Plan 008: Make the published privacy policy match what the extension does

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 9361968..HEAD -- PRIVACY.md docs/store/fiche.md docs/features/roadmap.md apps/extension/src/features/toggles.ts apps/extension/src/features/alerts/notification-settings.ts apps/extension/src/data/probes.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: docs
- **Planned at**: commit `9361968`, 2026-10-16

## Why this matters

`PRIVACY.md` is the privacy policy published on the Chrome Web Store and Firefox Add-ons listings of Optizzz (a
browser extension for Fourmizzz.fr). Store reviewers and players read it as a statement of fact. Three statements
no longer match the code:

1. It says everything is saved in `storage.local` « et nulle part ailleurs », but the feature switches and the
   notification choices are saved in `storage.sync`, which the browser synchronizes through the player's Google or
   Firefox account when sync is on. Still no Optizzz server, but the sentence is wrong.
2. It lists the game forms sent on click as the hunt launch and the workers split only; the extension also sends
   the game's army form to move « sondes » (one ant kept on the Dôme / Loge), on the player's click or right
   after a hunt or attack the player sent.
3. It does not mention what alliance sharing stores (states pasted by members, values typed by hand).

`docs/features/roadmap.md` also states the rule for game actions as « liens pré-remplis … Jamais
d'automatisation », while shipped features send forms on click. After this plan, the policy, the store texts and
the roadmap rule all describe the actual behaviour.

## Current state

- `PRIVACY.md` (French, currently addresses the reader with « tu »):
  - line 3: `_Dernière mise à jour : 8 octobre 2026_`
  - line 22: `Seulement quand tu cliques : le formulaire du jeu pour lancer une chasse (Lanceur de chasse) ou appliquer une répartition des ouvrières (Prévisions de ressources). Rien n'est envoyé automatiquement.`
  - line 26: `Dans le stockage local de ton navigateur (\`storage.local\`), et nulle part ailleurs :` followed by a bullet list (lines 28–33) with no bullet for alliance sharing.
  - line 41: permission `storage` : « enregistrer les paramètres et le cache décrits ci-dessus ».
- Code facts (do not change code):
  - `apps/extension/src/features/toggles.ts:11` — `export const TOGGLES_KEY = "sync:featureToggles";`
  - `apps/extension/src/features/alerts/notification-settings.ts:5` — `export const NOTIFICATIONS_KEY = "sync:alertNotifications";`
  - `apps/extension/src/data/probes.ts:74-79` — POSTs `${origin}/Armee.php` with `credentials: "include"` to move a probe.
  - `apps/extension/src/data/shared-states.ts` — key `` `local:allianceSharing:${host}:states` ``: members' pasted states, values
    typed by hand, and the player's own last share.
  - Every other key is `local:` (`grep -rhoE '"(local|sync|session):[A-Za-z]+' src` and the same with a backtick).
- `docs/store/fiche.md`:
  - line 46 already describes probes correctly (« les sondes ne sont déplacées qu'à votre clic ou juste après une
    chasse ou une attaque que vous avez envoyée »);
  - line 194 (Chrome « host permission » justification) and line 208 (AMO note) list forms sent on click as
    « lancer une chasse, appliquer une répartition » only;
  - line 182 (« Enregistrer localement… ») describes storage.
- `docs/features/roadmap.md:27`: `- **Actions de jeu** : liens pré-remplis vers les formulaires d'attaque ou de convoi du jeu, que le joueur valide lui-même. Jamais d'automatisation.`
- `CLAUDE.md` rule: player-facing text addresses the player with « vous ». PRIVACY.md is player-facing; switch it to
  « vous » while editing (the store listing `fiche.md` already uses « vous »).

## Commands you will need

| Purpose      | Command                                                                              | Expected on success |
| ------------ | ------------------------------------------------------------------------------------ | ------------------- |
| Format check | `pnpm format:check`                                                                  | exit 0              |
| Format       | `pnpm exec prettier --write PRIVACY.md docs/store/fiche.md docs/features/roadmap.md` | exit 0              |

## Scope

**In scope**: `PRIVACY.md`, `docs/store/fiche.md`, `docs/features/roadmap.md`.

**Out of scope**:

- Any code change (e.g. moving the switches to `storage.local`): the decision to use sync is the maintainer's.
- `README.md` (a separate docs pass).
- Uploading the new text to the stores: the maintainer does it at the next release (`docs/publication.md`).

## Git workflow

- Branch: `docs/privacy-accuracy`. Commit e.g. `docs(privacy): say what goes to storage.sync and the probe moves`.
- Pre-commit hook runs Prettier on markdown, typecheck and tests: never `--no-verify`. Do not push.

## Steps

### Step 1: `PRIVACY.md`

1. Switch the whole file from « tu / ton / tes » to « vous / votre / vos », keeping the meaning.
2. Line 3: update the date to the day you make the change, same format (« 16 octobre 2026 »).
3. « Ce que l'extension envoie au jeu »: list three forms, still only on the player's click:
   lancer une chasse (Lanceur de chasse), appliquer une répartition des ouvrières (Prévisions de ressources),
   déplacer les sondes sur la page Armée (bouton Sondes, ou juste après une chasse ou une attaque que vous avez
   envoyée). Keep « Rien n'est envoyé automatiquement. » only if it remains true as worded; otherwise use
   « Rien n'est envoyé sans une action de votre part. »
4. « Ce que l'extension enregistre »: change the intro to say data is in the browser's local storage
   (`storage.local`), **except** the tools switched on and the notification choices, which are in
   `storage.sync`: « votre navigateur les synchronise entre vos appareils si vous avez activé sa synchronisation
   (compte Google ou Firefox) ; ils ne passent par aucun serveur d'Optizzz ». Add a bullet for alliance sharing:
   « pour le Partage d'alliance : les états que vous collez depuis le salon de votre alliance, les valeurs que vous
   saisissez à la main, et votre dernier partage ».
5. Permissions › `storage`: mention both areas (« local, et synchronisé pour les interrupteurs et les notifications »).

**Verify**: `grep -n "storage.sync" PRIVACY.md` → at least one line; `grep -n "sondes" PRIVACY.md` → at least one
line; `grep -nwE "tu|ton|tes|toi" PRIVACY.md` → nothing.

### Step 2: `docs/store/fiche.md`

- Line 194 and line 208: add « déplacer les sondes » to the list of forms sent on click.
- Line 182: add one sentence: « Les interrupteurs des outils et les choix de notifications sont dans
  `storage.sync`, synchronisé par le navigateur lui-même si le joueur l'a activé. »

**Verify**: `grep -n "sondes" docs/store/fiche.md` → lines 37, 46, 194 and 208 (approximately); `grep -n "storage.sync" docs/store/fiche.md` → one line.

### Step 3: `docs/features/roadmap.md:27`

Replace the rule with: « **Actions de jeu** : un formulaire du jeu n'est envoyé que sur un clic du joueur (lancer
une chasse, appliquer une répartition, déplacer les sondes) ; ailleurs, des liens pré-remplis que le joueur valide
lui-même. Jamais d'envoi sur minuterie ni en arrière-plan. »

**Verify**: `grep -n "Actions de jeu" docs/features/roadmap.md` shows the new sentence.

### Step 4: Format

**Verify**: `pnpm format:check` → exit 0.

## Test plan

Docs only; the greps above are the checks. A reviewer should read `PRIVACY.md` in full once.

## Done criteria

- [ ] `PRIVACY.md` mentions `storage.sync`, the probe moves and alliance sharing, and uses « vous » throughout
- [ ] `docs/store/fiche.md` lines on forms sent and on storage are updated
- [ ] `docs/features/roadmap.md` « Actions de jeu » rule updated
- [ ] `pnpm format:check` exits 0
- [ ] No file outside the three in-scope ones modified
- [ ] `plans/README.md` status row updated

## STOP conditions

- You find any request sent to a host other than `*.fourmizzz.fr` (`grep -rnE "fetch\(|XMLHttpRequest" src` and
  read the targets): STOP and report — that would be a policy change, not a wording fix.
- You find another `sync:` or `session:` key not listed above.
- A sentence can only be made true by changing code.

## Maintenance notes

- Any new `sync:` key, new permission, or new form sent to the game must update `PRIVACY.md` and
  `docs/store/fiche.md` in the same PR (`CLAUDE.md` already requires it for permissions and outgoing data).
- The stores show the policy text pasted at submission (`fiche.md` line ~203): it updates only when the
  maintainer pastes it again.
