"use client";

// « Rappels du site », in the « Discord » panel, for an Admin (docs/features/site-discord.md): a second webhook the
// site reads, on which optizzz.fr itself posts content-free reminders at an event, each kind off by default. The page
// compares its address with the announcements' one it decrypted, by their hash, and warns when they are the same.
import { normalizeWebhookUrl } from "@optizzz/game/site-links/discord";
import { useEffect, useId, useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { suspensionText } from "~/lib/spaces/discord";
import {
  OFFERED_REMINDER_KINDS,
  REMINDER_LABELS,
  reminderLine,
  webhookHash,
  type ReminderKind,
} from "~/lib/spaces/reminders";
import { api } from "~/trpc/react";
import { errorText } from "./errors";
import { Callout } from "./parts";

const NOT_A_WEBHOOK =
  "Ce n'est pas l'adresse d'un webhook Discord : elle commence par https://discord.com/api/webhooks/. Copiez-la dans Discord, depuis Paramètres du salon › Intégrations › Webhooks.";

/** Whether the reminders' address is the announcements' one: compared by hash, the site never hands it out. */
function useSameAsAnnouncements(announcementsUrl: string | null, remindersHash: string | null): boolean {
  const [hash, setHash] = useState<string | null>(null);
  useEffect(() => {
    if (!announcementsUrl) return;
    const run = { cancelled: false };
    void webhookHash(announcementsUrl).then((value) => {
      if (!run.cancelled) setHash(value);
    });
    return () => {
      run.cancelled = true;
    };
  }, [announcementsUrl]);
  return announcementsUrl !== null && hash !== null && hash === remindersHash;
}

export function RemindersSection({
  spaceId,
  spaceName,
  announcementsUrl,
}: {
  spaceId: string;
  spaceName: string;
  /** The announcements' address, decrypted on this page; null when there is none (or not yet opened). */
  announcementsUrl: string | null;
}) {
  const id = useId();
  const utils = api.useUtils();
  const query = api.spaces.reminders.useQuery({ spaceId });
  const { mutateAsync } = api.spaces.saveReminders.useMutation();
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const view = query.data;
  const same = useSameAsAnnouncements(announcementsUrl, view?.address?.hash ?? null);

  const save = (input: { url?: string | null; kinds: ReminderKind[] }, after?: () => void) => {
    setBusy(true);
    setError(null);
    mutateAsync({ spaceId, ...input })
      .then(async () => {
        after?.();
        await utils.spaces.reminders.invalidate({ spaceId });
      })
      .catch((failure: unknown) => setError(errorText(failure)))
      .finally(() => setBusy(false));
  };

  const toggle = (kind: ReminderKind, on: boolean) => {
    const kinds = new Set(view?.kinds ?? []);
    if (on) kinds.add(kind);
    else kinds.delete(kind);
    save({ kinds: OFFERED_REMINDER_KINDS.filter((k) => kinds.has(k)) });
  };

  return (
    <div className="space-y-3 border-t border-foreground/10 pt-3">
      <h3 className="font-semibold">Rappels du site</h3>
      <p className="text-muted-foreground">
        Optizzz peut aussi prévenir l&apos;alliance quand aucun membre n&apos;a son navigateur ouvert&nbsp;: un court
        rappel posté par optizzz.fr, sans pseudo, ni nombre, ni cible, ni heure, avec un lien vers l&apos;espace.
      </p>
      <p>
        Le site peut lire cette adresse-ci, et donc écrire sur ce salon&nbsp;: créez pour elle un second webhook, de
        préférence sur un autre salon, jamais celui des annonces.
      </p>

      {query.isPending && <p className="text-muted-foreground">Ouverture des rappels…</p>}
      {query.error && <Callout>{errorText(query.error)}</Callout>}
      {view && !view.available && (
        <Callout tone="info">Les rappels du site ne sont pas encore disponibles sur optizzz.fr.</Callout>
      )}
      {view?.unreadable && (
        <Callout>L&apos;adresse des rappels ne s&apos;ouvre plus sur le site. Enregistrez-la de nouveau.</Callout>
      )}
      {view?.suspension && <Callout>{suspensionText(view.suspension)}</Callout>}
      {same && (
        <Callout tone="warning">
          C&apos;est l&apos;adresse des annonces&nbsp;: le site pourra aussi écrire comme vos annonces. Créez plutôt un
          second webhook.
        </Callout>
      )}

      {view?.available && (
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
              save({ url, kinds: view.kinds }, () => setAddress(""));
            }}
          >
            <label htmlFor={`${id}-url`} className="block font-medium">
              {view.address ? "Nouvelle adresse du webhook des rappels" : "Adresse du webhook des rappels"}
            </label>
            <p id={`${id}-help`} className="break-words text-muted-foreground">
              {view.address ? (
                <>
                  Webhook des rappels&nbsp;: <span className="break-all">{view.address.masked}</span>.
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
              <Button type="submit" disabled={busy || address.trim() === ""}>
                Enregistrer
              </Button>
              {(view.address ?? view.unreadable) && (
                <Button type="button" variant="outline" disabled={busy} onClick={() => save({ url: null, kinds: [] })}>
                  Retirer l&apos;adresse
                </Button>
              )}
            </div>
          </form>

          <fieldset className="space-y-2" disabled={busy || !view.address}>
            <legend className="font-medium">Rappels envoyés</legend>
            {OFFERED_REMINDER_KINDS.map((kind) => (
              <label key={kind} className="flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4"
                  checked={view.kinds.includes(kind)}
                  onChange={(change) => toggle(kind, change.target.checked)}
                />
                <span>
                  <span className="block">{REMINDER_LABELS[kind]}</span>
                  <span className="block text-muted-foreground">
                    « {reminderLine(kind, spaceName)}, à voir sur Optizzz »
                  </span>
                </span>
              </label>
            ))}
            <p className="text-xs text-muted-foreground">
              {view.address
                ? "Rien n'est coché d'avance. Au plus un rappel de chaque sorte toutes les 30 minutes."
                : "Enregistrez d'abord l'adresse du webhook des rappels."}
            </p>
          </fieldset>
        </>
      )}
      {error && <Callout>{error}</Callout>}
    </div>
  );
}
