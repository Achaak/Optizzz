"use client";

// « Discord », for an Admin (docs/features/site-discord.md): the webhook's address and the events that go to the
// alliance's channel, each off by default. Encrypted here with the Clé d'alliance; a record written before a member's
// exclusion is encrypted again with the newest version when an Admin opens the page, and the page offers to replace
// an address that member knows. The messages leave from the extension of the member who acts, never from the site.
import type { AllianceKeyring } from "@optizzz/crypto/alliance-key";
import {
  DISCORD_EVENT_LABELS,
  DISCORD_EVENTS,
  normalizeWebhookUrl,
  type DiscordEvent,
  type DiscordSettings,
} from "@optizzz/game/site-links/discord";
import { useEffect, useId, useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { knownByExcluded, lockDiscord, openDiscord, refusalText, staleDiscord } from "~/lib/spaces/discord";
import { api } from "~/trpc/react";
import { errorText } from "./errors";
import { Callout, Panel } from "./parts";
import type { MemberView } from "./use-space-access";

const NOT_A_WEBHOOK =
  "Ce n'est pas l'adresse d'un webhook Discord : elle commence par https://discord.com/api/webhooks/. Copiez-la dans Discord, depuis Paramètres du salon › Intégrations › Webhooks.";
const UNREADABLE = "Le réglage Discord ne s'ouvre pas sur cet appareil. Rechargez la page.";

const isConflict = (error: unknown) => (error as { data?: { code?: string } }).data?.code === "CONFLICT";

/** The record, opened, and what saves it; a record from before a rotation is encrypted again with the newest version. */
function useDiscordSettings(view: MemberView, keyring: AllianceKeyring | null) {
  const stored = view.discord;
  const newest = Math.max(0, ...view.versions);
  const { mutateAsync } = api.spaces.saveDiscord.useMutation();
  const utils = api.useUtils();
  const [opened, setOpened] = useState<{ blob: string | null; settings: DiscordSettings | null } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const spaceId = view.space.id;
  const writable = view.me.keyStatus === "current" && keyring !== null;

  useEffect(() => {
    if (!keyring) return;
    const run = { cancelled: false };
    void (async () => {
      if (!stored) {
        setOpened({ blob: null, settings: null });
        return;
      }
      let settings: DiscordSettings;
      try {
        settings = await openDiscord(stored.blob, keyring);
      } catch (error) {
        console.error("[Optizzz] the Discord settings do not open", error);
        if (!run.cancelled) setProblem(UNREADABLE);
        return;
      }
      if (run.cancelled) return;
      setProblem(null);
      setOpened({ blob: stored.blob, settings });
      if (!writable || !staleDiscord(stored.blob, newest)) return;
      // Written before a member's exclusion: encrypted again with the newest version, the address kept.
      await mutateAsync({ spaceId, blob: await lockDiscord(settings, keyring), expectedRevision: stored.revision });
      await utils.spaces.view.invalidate({ spaceId });
    })().catch(async (error: unknown) => {
      if (!isConflict(error)) console.error("[Optizzz] the Discord settings could not be encrypted again", error);
      await utils.spaces.view.invalidate({ spaceId });
    });
    return () => {
      run.cancelled = true;
    };
  }, [stored, keyring, writable, newest, spaceId, mutateAsync, utils]);

  async function save(settings: DiscordSettings): Promise<void> {
    if (!keyring) return;
    await mutateAsync({ spaceId, blob: await lockDiscord(settings, keyring), expectedRevision: stored?.revision ?? 0 });
    await utils.spaces.view.invalidate({ spaceId });
  }

  const ready = opened !== null && opened.blob === (stored?.blob ?? null);
  return { settings: ready ? opened.settings : undefined, problem, newest, save, writable };
}

/** « …/api/webhooks/1234…/••••abcd »: enough to recognise it, not to copy it from over a shoulder. */
function maskedUrl(url: string): string {
  const [, id = "", token = ""] = /\/api\/webhooks\/(\d+)\/(.+)$/.exec(url) ?? [];
  return `discord.com/api/webhooks/${id.slice(0, 4)}…/••••${token.slice(-4)}`;
}

export function DiscordPanel({ view, keyring }: { view: MemberView; keyring: AllianceKeyring | null }) {
  const id = useId();
  const discord = useDiscordSettings(view, keyring);
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { settings, newest } = discord;

  if (!keyring) return null;
  const current: DiscordSettings = settings ?? { url: null, events: [], urlSetAtVersion: newest };
  const refusal = view.discord?.refusal ?? null;

  const act = (next: DiscordSettings, after?: () => void) => {
    setBusy(true);
    setError(null);
    discord
      .save(next)
      .then(after)
      .catch((failure: unknown) => setError(errorText(failure)))
      .finally(() => setBusy(false));
  };

  const toggle = (event: DiscordEvent, on: boolean) => {
    const events = new Set(current.events);
    if (on) events.add(event);
    else events.delete(event);
    act({ ...current, events: DISCORD_EVENTS.filter((e) => events.has(e)) });
  };

  return (
    <Panel title="Discord">
      <p className="text-muted-foreground">
        Annoncez sur le salon Discord de l&apos;alliance ce que font les membres. Le message part de l&apos;extension du
        membre qui agit, jamais d&apos;optizzz.fr, et seulement pour ce qu&apos;il envoie déjà à l&apos;espace. Seuls
        les membres de l&apos;espace peuvent lire l&apos;adresse du webhook.
      </p>
      {discord.problem && <Callout>{discord.problem}</Callout>}
      {refusal && current.url && <Callout>{refusalText(refusal)}</Callout>}
      {current.url && knownByExcluded(current, newest) && (
        <Callout tone="warning">
          <div className="space-y-3">
            <p>
              Un membre a été exclu depuis l&apos;enregistrement de ce webhook&nbsp;: il en connaît l&apos;adresse et
              pourrait écrire sur le salon. Créez un nouveau webhook dans Discord et enregistrez sa nouvelle adresse
              ici, puis supprimez l&apos;ancien.
            </p>
            <Button
              variant="outline"
              disabled={busy || !discord.writable}
              onClick={() => act({ ...current, urlSetAtVersion: newest })}
            >
              Garder ce webhook
            </Button>
          </div>
        </Callout>
      )}

      {settings === undefined && !discord.problem ? (
        <p className="text-muted-foreground">Ouverture du réglage Discord…</p>
      ) : (
        settings !== undefined && (
          <>
            <form
              className="space-y-1"
              onSubmit={(event) => {
                event.preventDefault();
                const url = normalizeWebhookUrl(address);
                if (!url) {
                  setError(NOT_A_WEBHOOK);
                  return;
                }
                act({ ...current, url, urlSetAtVersion: newest }, () => setAddress(""));
              }}
            >
              <label htmlFor={`${id}-url`} className="block font-medium">
                {current.url ? "Nouvelle adresse du webhook" : "Adresse du webhook"}
              </label>
              <p id={`${id}-help`} className="break-words text-muted-foreground">
                {current.url ? (
                  <>
                    Webhook enregistré&nbsp;: <span className="break-all">{maskedUrl(current.url)}</span>.
                  </>
                ) : (
                  "Dans Discord : Paramètres du salon › Intégrations › Webhooks › Nouveau webhook, puis « Copier l'URL du webhook »."
                )}
              </p>
              <div className="flex flex-wrap gap-2">
                <Input
                  id={`${id}-url`}
                  type="url"
                  inputMode="url"
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  placeholder="https://discord.com/api/webhooks/…"
                  autoComplete="off"
                  spellCheck={false}
                  aria-describedby={`${id}-help`}
                  className="w-full min-w-0 sm:w-auto sm:max-w-md sm:flex-1"
                />
                <Button type="submit" disabled={busy || !discord.writable || address.trim() === ""}>
                  Enregistrer
                </Button>
                {current.url && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy || !discord.writable}
                    onClick={() => act({ ...current, url: null, urlSetAtVersion: newest })}
                  >
                    Retirer le webhook
                  </Button>
                )}
              </div>
            </form>

            <fieldset className="space-y-2" disabled={busy || !discord.writable || !current.url}>
              <legend className="font-medium">Ce qui part sur Discord</legend>
              {DISCORD_EVENTS.map((event) => (
                <label key={event} className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-4"
                    checked={current.events.includes(event)}
                    onChange={(change) => toggle(event, change.target.checked)}
                  />
                  <span>
                    <span className="block">{DISCORD_EVENT_LABELS[event].label}</span>
                    <span className="block text-muted-foreground">{DISCORD_EVENT_LABELS[event].example}</span>
                  </span>
                </label>
              ))}
              <p className="text-xs text-muted-foreground">
                {current.url
                  ? "Rien n'est coché d'avance. Les floods ne disent jamais l'armée envoyée."
                  : "Enregistrez d'abord l'adresse du webhook."}
              </p>
            </fieldset>
          </>
        )
      )}
      {error && <Callout>{error}</Callout>}
      <p className="text-xs text-muted-foreground">
        Chaque membre garde la main&nbsp;: rien ne part sur Discord pour une catégorie qu&apos;il n&apos;envoie pas à
        l&apos;espace, ni tant qu&apos;il n&apos;a pas autorisé Discord dans son extension.
      </p>
    </Panel>
  );
}
