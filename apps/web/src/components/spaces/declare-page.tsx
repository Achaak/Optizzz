"use client";

// The page « Déclarer » of a space (ADR 0010, docs/features/site-declarer.md), made for a phone: a member who has not
// their extension at hand declares a flood, a convoy or a hunt. What they type is sealed here with the Clé d'alliance,
// as an Envoi of their Joueur: the site keeps ciphertext only. The link comes from the space's « Discord » panel.
import { formatEndTime } from "@optizzz/game/format/time-format";
import { mapDataSchema } from "@optizzz/map/map-data";
import {
  DECLARED_FLOOD_CATEGORY,
  DECLARED_HUNT_CATEGORY,
  DECLARED_TRANSIT_CATEGORY,
  MAX_DECLARED_ATTACKS,
  parseWhen,
} from "@optizzz/game/site-links/declarations";
import { DECLARED_CONVOY_CATEGORY } from "@optizzz/game/site-links/demandes";
import type { DeclaredCategory } from "@optizzz/game/site-links/envois";
import { cn } from "cn";
import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { LockIcon } from "~/components/icons";
import { NumberField } from "~/components/number-field";
import { PageHeader } from "~/components/panel";
import { Segmented } from "~/components/tools/hunt/hunt-parts";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { myDeclarations, sealDeclaration, type MyDeclaration } from "~/lib/envois/declarations";
import { api } from "~/trpc/react";
import { errorText } from "./errors";
import { Callout, FIELD_LABEL, Panel } from "./parts";
import { PassphraseUnlock } from "./passphrase-forms";
import { useSpaceAccess, type MemberView } from "./use-space-access";
import { useSpaceDemandes } from "./use-space-demandes";
import { useSpaceEnvois } from "./use-space-envois";
import { useSpaceKeys } from "./space-keys";

type Kind = "flood" | "convoy" | "hunt";
const KINDS = [
  { value: "flood", label: "Flood" },
  { value: "convoy", label: "Convoi" },
  { value: "hunt", label: "Chasse" },
] as const satisfies readonly { value: Kind; label: string }[];

const MODES = [
  { value: "at", label: "À" },
  { value: "in", label: "Dans" },
] as const;
type Mode = (typeof MODES)[number]["value"];

const AMOUNT_RULES = { integer: true, min: 0, amount: true, allowEmpty: true } as const;
const ATTACK_RULES = { integer: true, min: 1, max: MAX_DECLARED_ATTACKS } as const;
const BIG_INPUT = "h-11 bg-background text-base";

export function DeclarePage({ spaceId }: { spaceId: string }) {
  const view = api.spaces.view.useQuery({ spaceId }, { staleTime: 60_000, retry: false });
  if (view.isPending) return <p className="text-sm text-muted-foreground">Chargement de l&apos;espace…</p>;
  if (view.isError) return <Callout>{errorText(view.error)}</Callout>;
  if (view.data.kind !== "member")
    return (
      <div className="max-w-md space-y-3 text-sm">
        <Callout tone="info">
          Vous n&apos;êtes pas encore membre de cet espace : rejoignez-le d&apos;abord, depuis un appareil où vous avez
          l&apos;extension Optizzz.
        </Callout>
        <Link href={`/spaces/${spaceId}`} className="underline underline-offset-4">
          Voir l&apos;espace
        </Link>
      </div>
    );
  return <MemberDeclare view={view.data} />;
}

function MemberDeclare({ view }: { view: MemberView }) {
  const keys = useSpaceKeys();
  const access = useSpaceAccess(keys.pair && keys.trust ? view : undefined);
  const keyring = access.keyring;
  const envois = useSpaceEnvois(view, keyring);
  const demandes = useSpaceDemandes(view, keyring, envois.items);
  const utils = api.useUtils();
  const declare = api.envois.declare.useMutation({
    onSuccess: () => utils.envois.space.invalidate({ spaceId: view.space.id }),
  });
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const me = view.members.find((m) => m.isMe)?.pseudo ?? "";
  const sender = { server: view.me.server, playerId: view.me.playerId };

  async function send<C extends DeclaredCategory>(
    category: C,
    item: Parameters<typeof sealDeclaration<C>>[2],
    what: string,
  ) {
    if (!keyring) return;
    setError(null);
    setDone(null);
    try {
      const sealed = await sealDeclaration(sender, category, item, keyring, new Date());
      await declare.mutateAsync({
        category,
        ...sender,
        keyVersion: sealed.keyVersion,
        items: [sealed.item],
        removed: [],
      });
      setDone(`${what} déclaré.`);
    } catch (failure) {
      setError(errorText(failure));
    }
  }

  async function withdraw(category: DeclaredCategory, fingerprint: string) {
    if (!keyring) return;
    setError(null);
    try {
      const keyVersion = Math.max(...keyring.map((k) => k.version));
      await declare.mutateAsync({ category, ...sender, keyVersion, items: [], removed: [fingerprint] });
    } catch (failure) {
      setError(errorText(failure));
    }
  }

  const header = (
    <PageHeader
      kicker={
        <Link href={`/spaces/${view.space.id}`} className="hover:text-foreground hover:underline">
          {view.space.name}
        </Link>
      }
      title="Déclarer"
    >
      Ce que vous avez lancé sans l&apos;extension. Il apparaît dans l&apos;Espace, marqué «&nbsp;déclaré&nbsp;»,
      jusqu&apos;à ce que votre extension le voie.
    </PageHeader>
  );

  if (!keys.pair)
    return (
      <div className="max-w-md space-y-5">
        {header}
        <Panel title="Sur un nouvel appareil">
          <PassphraseUnlock intro={<p>Ouvrez la Clé d&apos;alliance pour déclarer : votre Phrase de chiffrement.</p>} />
        </Panel>
      </div>
    );
  if (!keyring)
    return (
      <div className="max-w-md space-y-5">
        {header}
        {access.ready || access.keyringError ? (
          <Callout tone="warning">
            L&apos;accès à cet espace doit encore vous être donné sur cet appareil.{" "}
            <Link href={`/spaces/${view.space.id}`} className="underline underline-offset-4">
              Ouvrir l&apos;espace
            </Link>
          </Callout>
        ) : (
          <p className="text-sm text-muted-foreground">Ouverture de l&apos;espace…</p>
        )}
      </div>
    );

  const mine = envois.declarations ? myDeclarations(envois.declarations, view.me.playerId, new Date()) : [];
  const validated = (demandes.demandes ?? []).filter((d) => d.status === "validated" && !d.content.self);
  return (
    <div className="max-w-md space-y-5">
      {header}
      <DeclareView
        server={view.space.server}
        recipients={view.members.filter((m) => !m.isMe).map((m) => m.pseudo)}
        demandes={validated.map((d) => ({ id: d.id, requester: d.requester, label: d.label }))}
        mine={mine}
        busy={declare.isPending}
        done={done}
        error={error}
        onSend={(category, item, what) => {
          if (category === DECLARED_CONVOY_CATEGORY) return send(category, { ...item, from: me }, what);
          return send(category, item, what);
        }}
        onWithdraw={(category, fingerprint) => void withdraw(category, fingerprint)}
      />
    </div>
  );
}

/** What a convoy for a Demande needs besides its sender, whom the page adds. */
type Sent =
  | [typeof DECLARED_FLOOD_CATEGORY, { target: string; attacks: number; at: number }]
  | [typeof DECLARED_TRANSIT_CATEGORY, { to: string; food: number; materials: number; at: number }]
  | [typeof DECLARED_CONVOY_CATEGORY, { demande: string; to: string; food: number; materials: number; at: number }]
  | [typeof DECLARED_HUNT_CATEGORY, { fieldGain: number; returnsAt: number }];

/** The three forms and « Vos déclarations », without the space's loading: what the page shows once the key is open. */
function DeclareView({
  server,
  recipients,
  demandes,
  mine,
  busy,
  done,
  error,
  onSend,
  onWithdraw,
}: {
  server: string;
  recipients: string[];
  demandes: { id: string; requester: string; label: string }[];
  mine: MyDeclaration[];
  busy: boolean;
  done: string | null;
  error: string | null;
  onSend: (...sent: [...Sent, string]) => Promise<void>;
  onWithdraw: (category: DeclaredCategory, fingerprint: string) => void;
}) {
  const [kind, setKind] = useState<Kind>("flood");
  return (
    <>
      <Panel>
        <KindChoice value={kind} onChange={setKind} />
        {kind === "flood" && (
          <FloodForm server={server} busy={busy} onDeclare={(item) => onSend(DECLARED_FLOOD_CATEGORY, item, "Flood")} />
        )}
        {kind === "convoy" && (
          <ConvoyForm
            recipients={recipients}
            demandes={demandes}
            busy={busy}
            onDeclare={({ demande, ...convoy }) =>
              demande === null
                ? onSend(DECLARED_TRANSIT_CATEGORY, convoy, "Convoi")
                : onSend(DECLARED_CONVOY_CATEGORY, { ...convoy, demande }, "Convoi")
            }
          />
        )}
        {kind === "hunt" && (
          <HuntForm busy={busy} onDeclare={(item) => onSend(DECLARED_HUNT_CATEGORY, item, "Chasse")} />
        )}
        {done && <Callout tone="info">{done}</Callout>}
        {error && <Callout>{error}</Callout>}
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <LockIcon width={14} height={14} className="mt-0.5 shrink-0" />
          Chiffré dans ce navigateur avec la Clé d&apos;alliance : le site ne voit pas ce que vous saisissez.
        </p>
      </Panel>
      <Panel title="Vos déclarations">
        {mine.length === 0 ? (
          <p className="text-muted-foreground">Rien de déclaré qui soit encore à venir.</p>
        ) : (
          <ul className="divide-y">
            {mine.map((d) => (
              <li key={d.fingerprint} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0 break-words">{d.text}</span>
                <Button
                  variant="outline"
                  className="h-10 shrink-0"
                  disabled={busy}
                  onClick={() => onWithdraw(d.category, d.fingerprint)}
                >
                  Retirer
                </Button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">
          Une déclaration disparaît de l&apos;Espace dès que votre extension envoie la même chose (même cible ou
          destinataire, mêmes quantités, à 2 minutes près).
        </p>
      </Panel>
    </>
  );
}

/** Flood, Convoi, Chasse: three wide buttons, big enough for a thumb. */
function KindChoice({ value, onChange }: { value: Kind; onChange: (kind: Kind) => void }) {
  return (
    <div role="group" aria-label="Sorte" className="grid grid-cols-3 gap-1 rounded-[0.625rem] bg-raised p-1">
      {KINDS.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "h-11 rounded-[0.5rem] text-sm",
            value === option.value ? "bg-primary font-semibold text-primary-foreground" : "hover:bg-accent",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** « Arrivée » or « Retour »: a time of day (« À ») or the time left (« Dans »), and the instant it makes. */
function WhenField({ word, onChange }: { word: "Arrivée" | "Retour"; onChange: (when: Date | null) => void }) {
  const id = useId();
  const [mode, setMode] = useState<Mode>("at");
  const [text, setText] = useState("");
  const now = new Date();
  const when = parseWhen(mode, text, now);
  const change = (nextMode: Mode, nextText: string) => {
    setMode(nextMode);
    setText(nextText);
    onChange(parseWhen(nextMode, nextText, new Date()));
  };
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className={FIELD_LABEL}>
          {word}
        </label>
        <Segmented
          label={`${word} : heure ou temps qui reste`}
          options={MODES}
          value={mode}
          onChange={(next) => change(next, text)}
        />
      </div>
      <Input
        id={id}
        aria-describedby={`${id}-hint`}
        className={cn(BIG_INPUT, "font-mono")}
        value={text}
        placeholder={mode === "at" ? "18h12" : "2h30m"}
        onChange={(event) => change(mode, event.target.value)}
      />
      <p id={`${id}-hint`} className="text-xs text-muted-foreground">
        {when
          ? `${word === "Arrivée" ? "arrivée" : "retour"} ${formatEndTime(when, now)}`
          : mode === "at"
            ? "L'heure que montre le jeu, heure de Paris : « 18h12 »."
            : "Le temps qui reste, comme le jeu l'écrit : « 2h30m », « 45m »."}
      </p>
    </div>
  );
}

/** The server's pseudos, for the target's suggestions: the whole public map, so the site learns no target. */
function useServerPseudos(server: string): string[] {
  const [pseudos, setPseudos] = useState<string[]>([]);
  useEffect(() => {
    let current = true;
    fetch(`/api/${server}/map`)
      .then(async (response) => (response.ok ? mapDataSchema.parse(await response.json()).players.pseudo : []))
      .then(
        (loaded) => {
          if (current) setPseudos(loaded);
        },
        (error: unknown) => {
          // Without it, the target is typed without suggestions.
          console.error("[Optizzz] the server's players could not be read", error);
        },
      );
    return () => {
      current = false;
    };
  }, [server]);
  return pseudos;
}

function FloodForm({
  server,
  busy,
  onDeclare,
}: {
  server: string;
  busy: boolean;
  onDeclare: (item: { target: string; attacks: number; at: number }) => Promise<void>;
}) {
  const ids = { target: useId(), attacks: useId(), list: useId() };
  const pseudos = useServerPseudos(server);
  const [target, setTarget] = useState("");
  const [attacks, setAttacks] = useState<number | null>(1);
  const [when, setWhen] = useState<Date | null>(null);
  const ready = target.trim() !== "" && attacks !== null && attacks >= 1 && when !== null;
  return (
    <form
      className="space-y-3.5"
      onSubmit={(event) => {
        event.preventDefault();
        if (ready) void onDeclare({ target: target.trim(), attacks, at: when.getTime() });
      }}
    >
      <div className="space-y-1.5">
        <label htmlFor={ids.target} className={FIELD_LABEL}>
          Cible
        </label>
        <Input
          id={ids.target}
          list={ids.list}
          className={BIG_INPUT}
          autoComplete="off"
          value={target}
          onChange={(event) => setTarget(event.target.value)}
        />
        <datalist id={ids.list}>
          {target.trim().length >= 2 &&
            pseudos
              .filter((p) => p.toLowerCase().startsWith(target.trim().toLowerCase()))
              .slice(0, 20)
              .map((p) => <option key={p} value={p} />)}
        </datalist>
      </div>
      <div className="space-y-1.5">
        <label htmlFor={ids.attacks} className={FIELD_LABEL}>
          Nombre d&apos;attaques
        </label>
        <NumberField
          id={ids.attacks}
          className={BIG_INPUT}
          inputMode="numeric"
          value={attacks}
          rules={ATTACK_RULES}
          onCommit={setAttacks}
        />
      </div>
      <WhenField word="Arrivée" onChange={setWhen} />
      <Button type="submit" className="h-12 w-full text-base font-semibold" disabled={busy || !ready}>
        Déclarer le flood
      </Button>
    </form>
  );
}

function ConvoyForm({
  recipients,
  demandes,
  busy,
  onDeclare,
}: {
  recipients: string[];
  demandes: { id: string; requester: string; label: string }[];
  busy: boolean;
  onDeclare: (convoy: {
    to: string;
    food: number;
    materials: number;
    at: number;
    demande: string | null;
  }) => Promise<void>;
}) {
  const ids = { to: useId(), food: useId(), materials: useId(), demande: useId() };
  const [to, setTo] = useState(recipients[0] ?? "");
  const [food, setFood] = useState<number | null>(0);
  const [materials, setMaterials] = useState<number | null>(0);
  const [when, setWhen] = useState<Date | null>(null);
  const [demande, setDemande] = useState("");
  const theirs = demandes.filter((d) => d.requester.toLowerCase() === to.toLowerCase());
  const chosen = theirs.some((d) => d.id === demande) ? demande : "";
  const ready = to !== "" && (food ?? 0) + (materials ?? 0) > 0 && when !== null;
  const select = cn("block w-full rounded-lg border border-input px-2.5", BIG_INPUT);
  return (
    <form
      className="space-y-3.5"
      onSubmit={(event) => {
        event.preventDefault();
        if (ready)
          void onDeclare({
            to,
            food: food ?? 0,
            materials: materials ?? 0,
            at: when.getTime(),
            demande: chosen === "" ? null : chosen,
          });
      }}
    >
      <div className="space-y-1.5">
        <label htmlFor={ids.to} className={FIELD_LABEL}>
          Destinataire
        </label>
        <select id={ids.to} className={select} value={to} onChange={(event) => setTo(event.target.value)}>
          {recipients.map((pseudo) => (
            <option key={pseudo} value={pseudo}>
              {pseudo}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <div className="space-y-1.5">
          <label htmlFor={ids.food} className={FIELD_LABEL}>
            Nourriture
          </label>
          <NumberField id={ids.food} className={BIG_INPUT} value={food} rules={AMOUNT_RULES} onCommit={setFood} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor={ids.materials} className={FIELD_LABEL}>
            Matériaux
          </label>
          <NumberField
            id={ids.materials}
            className={BIG_INPUT}
            value={materials}
            rules={AMOUNT_RULES}
            onCommit={setMaterials}
          />
        </div>
      </div>
      <WhenField word="Arrivée" onChange={setWhen} />
      <div className="space-y-1.5">
        <label htmlFor={ids.demande} className={FIELD_LABEL}>
          Pour une Demande (facultatif)
        </label>
        <select
          id={ids.demande}
          className={select}
          value={chosen}
          disabled={theirs.length === 0}
          onChange={(event) => setDemande(event.target.value)}
        >
          <option value="">Aucune</option>
          {theirs.map((d) => (
            <option key={d.id} value={d.id}>
              {d.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          {theirs.length === 0
            ? `${to || "Ce membre"} n'a pas de Demande validée.`
            : `Seules les Demandes validées de ${to}.`}
        </p>
      </div>
      <Button type="submit" className="h-12 w-full text-base font-semibold" disabled={busy || !ready}>
        Déclarer le convoi
      </Button>
    </form>
  );
}

function HuntForm({
  busy,
  onDeclare,
}: {
  busy: boolean;
  onDeclare: (item: { fieldGain: number; returnsAt: number }) => Promise<void>;
}) {
  const id = useId();
  const [field, setField] = useState<number | null>(null);
  const [when, setWhen] = useState<Date | null>(null);
  const ready = field !== null && field > 0 && when !== null;
  return (
    <form
      className="space-y-3.5"
      onSubmit={(event) => {
        event.preventDefault();
        if (ready) void onDeclare({ fieldGain: field, returnsAt: when.getTime() });
      }}
    >
      <div className="space-y-1.5">
        <label htmlFor={id} className={FIELD_LABEL}>
          cm² rapportés
        </label>
        <NumberField id={id} className={BIG_INPUT} value={field} rules={AMOUNT_RULES} onCommit={setField} />
      </div>
      <WhenField word="Retour" onChange={setWhen} />
      <Button type="submit" className="h-12 w-full text-base font-semibold" disabled={busy || !ready}>
        Déclarer la chasse
      </Button>
    </form>
  );
}
