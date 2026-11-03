import { describeChange } from "@optizzz/game/changes";
import { formatNumber } from "@optizzz/game/format/number-format";
import { dayMonth, formatDateTime } from "@optizzz/game/format/time-format";
import { SERVERS } from "@optizzz/game/servers";
import { siteToolPath } from "@optizzz/game/site-links/site";
import Link from "next/link";
import { AdSlot } from "~/components/ad-slot";
import { ChangeStamp } from "~/components/change-stamp";
import { HomeSwitch } from "~/components/home/dashboard";
import { RememberedServer, ServerRow } from "~/components/home/remembered-server";
import { JournalTicker } from "~/components/journal-ticker";
import { MapSketch } from "~/components/map-sketch";
import { AntTrail, LiveBadge, Panel, PanelLink, SmallLabel } from "~/components/panel";
import { Sparkline } from "~/components/sparkline";
import { TOOLS } from "~/components/tools/tool-list";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { journalPage, journalPerDay, mapSketch, serverBulletin, type ServerBulletin } from "~/server/queries";

// Rebuilt by the cron once the exports are stored (api/revalidate), at worst every hour.
export const revalidate = 3600;

const CHROME_STORE = "https://chromewebstore.google.com/detail/optizzz/goeifkbimepccacjfkkmhjmhgoiigjpl";
const FIREFOX_ADDONS = "https://addons.mozilla.org/fr/firefox/addon/optizzz/";

// Stroke icons for the three roles, drawn like the rest of the site's icons.
const ROLE_ICONS = {
  Espaces: "M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6zM9 11h6v5H9zM10 11V9.5a2 2 0 0 1 4 0V11",
  Outils:
    "M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2M8 7h8M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01",
  Serveurs: "M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20zM9 4v13.5M15 6.5V20",
} as const;

const ROLES = [
  {
    kicker: "01 · Alliance",
    title: "Espaces",
    text: "Demandes, convois, floods, absences, rappels Discord. Chiffré de bout en bout : le site ne lit rien.",
    href: "/spaces",
    link: "Découvrir",
  },
  {
    kicker: "02 · Calculs",
    title: "Outils",
    text: "Sans compte ni extension. Un lien suffit pour partager un calcul.",
    href: "/tools",
    link: "Calculer",
  },
  {
    kicker: "03 · Renseignement",
    title: "Serveurs",
    text: "Joueurs, alliances, diplomatie, carte. Relus chaque heure depuis l'export public.",
    href: "/s5",
    link: "Surveiller",
  },
];

/** A server's figures for the home page: its bulletin, and the Journal's Changes on the day of its last reading. */
interface HomeBulletin extends ServerBulletin {
  changesToday: number;
}

/** « Bulletin S5 »: a server's figures, its players these two weeks, its latest diplomacy. */
function Bulletin({ id, name, bulletin }: { id: string; name: string; bulletin: HomeBulletin }) {
  const days = bulletin.playersPerDay;
  const first = days[0];
  const last = days.at(-1);
  const figures: [number, string][] = [
    [bulletin.players, "joueurs"],
    [bulletin.alliances, "alliances"],
    [bulletin.colonized, "colonisés"],
    [
      bulletin.changesToday,
      `${bulletin.changesToday === 1 ? "changement" : "changements"} le ${dayMonth(bulletin.reading)}`,
    ],
  ];
  return (
    <div className="lift flex h-full flex-col overflow-hidden rounded-[0.875rem] bg-card shadow-panel">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4.5 py-3.5">
        <span className="font-heading text-[1.375rem] font-bold tracking-wide uppercase">Bulletin {name}</span>
        <LiveBadge className="bg-accent shadow-none">Relevé du {formatDateTime(bulletin.reading)}</LiveBadge>
      </div>
      <div className="grid grid-cols-2 gap-2.5 px-4.5">
        {figures.map(([value, label]) => (
          <div key={label} className="rounded-[0.625rem] bg-raised px-3.5 py-3">
            <div className="text-[1.75rem] leading-tight font-semibold">{formatNumber(value)}</div>
            <div className="text-[0.8125rem] text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>
      {first && last && days.length >= 2 && (
        <figure className="m-0 space-y-1 px-4.5 pt-3.5">
          <Sparkline
            className="h-16 w-full"
            values={days.map((day) => day.players)}
            label={`Joueurs inscrits sur ${name}, de ${formatNumber(first.players)} le ${dayMonth(first.day)} à ${formatNumber(last.players)} le ${dayMonth(last.day)}`}
          />
          <figcaption className="flex justify-between text-[0.6875rem] text-muted-foreground">
            <span>
              {dayMonth(first.day)} · {formatNumber(first.players)}
            </span>
            <span>
              {dayMonth(last.day)} · {formatNumber(last.players)} joueurs
            </span>
          </figcaption>
        </figure>
      )}
      {bulletin.journal.length > 0 && (
        <ul className="space-y-2 px-4.5 pt-3 pb-4 text-sm">
          {bulletin.journal.map((line) => (
            <li key={line.id} className="flex flex-wrap items-center gap-2">
              <ChangeStamp change={line.change} />
              <span>
                <strong>{line.name}</strong> {describeChange(line.change)}
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-auto bg-raised px-4.5 py-3.5">
        <PanelLink href={`/${id}`}>Ouvrir {name}</PanelLink>
      </div>
    </div>
  );
}

function ToolsPanel() {
  return (
    <Panel flush title="Outils" aside={<PanelLink href="/tools">Tous les outils</PanelLink>}>
      <ul className="divide-y divide-dashed">
        {TOOLS.filter((tool) => tool.ready).map((tool) => (
          <li key={tool.id}>
            <Link
              href={siteToolPath(tool.id)}
              className="grid gap-x-4 gap-y-0.5 px-4.5 py-2.5 hover:bg-raised sm:grid-cols-[7rem_minmax(0,1fr)]"
            >
              <span className="font-heading text-lg font-semibold tracking-wide uppercase">{tool.shortTitle}</span>
              <span className="text-sm text-muted-foreground">{tool.description}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function ServersTable({ bulletins }: { bulletins: Map<string, ServerBulletin> }) {
  return (
    <section aria-labelledby="servers-title" className="space-y-3">
      <div className="flex items-center gap-4">
        <h2 id="servers-title" className="font-heading text-4xl font-bold uppercase">
          Serveurs
        </h2>
        <svg height={8} aria-hidden="true" className="min-w-0 flex-1">
          <line
            x1={0}
            y1={4}
            x2="100%"
            y2={4}
            stroke="var(--border)"
            strokeWidth={4}
            strokeDasharray="0 9"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <div className="overflow-hidden rounded-[0.875rem] bg-card shadow-panel">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {[
                ["Serveur", "pl-4"],
                ["Joueurs", "px-4 text-right"],
                ["État", "px-4"],
              ].map(([label, className]) => (
                <TableHead key={label} className={className}>
                  {label}
                </TableHead>
              ))}
              <TableHead className="pr-4">
                <span className="sr-only">Lien</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {SERVERS.map((server) => (
              <ServerRow
                key={server.id}
                id={server.id}
                name={server.name}
                players={bulletins.get(server.id)?.players ?? null}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}

export default async function Home() {
  const bulletins = new Map<string, HomeBulletin>();
  const read = await Promise.all(
    SERVERS.map(async (server) => {
      const bulletin = await serverBulletin(server.id);
      if (!bulletin) return null;
      // The Journal's Changes on the Paris day of the last reading (a day without any is missing from the list).
      const today = dayMonth(bulletin.reading);
      const day = (await journalPerDay(server.id)).find((entry) => dayMonth(entry.day) === today);
      const changesToday = day ? day.players + day.alliances + day.colonies + day.diplomacy : 0;
      return { ...bulletin, changesToday };
    }),
  );
  for (const [index, bulletin] of read.entries()) {
    const server = SERVERS[index];
    if (server && bulletin) bulletins.set(server.id, bulletin);
  }
  const blocks = Object.fromEntries(
    SERVERS.flatMap((server) => {
      const bulletin = bulletins.get(server.id);
      return bulletin
        ? [[server.id, <Bulletin key={server.id} id={server.id} name={server.name} bulletin={bulletin} />]]
        : [];
    }),
  );
  const fallback = [...bulletins.keys()].at(-1) ?? "";
  const [nests, latest] = fallback
    ? await Promise.all([mapSketch(fallback), journalPage(fallback, { group: null, q: "", day: null, page: 1 })])
    : [[], { lines: [] }];
  const fallbackName = SERVERS.find((server) => server.id === fallback)?.name ?? "";

  const visitor = (
    <div className="space-y-14">
      <section className="relative flex flex-wrap items-stretch gap-10 py-6">
        {/* The last server's map, its biggest players as dots: the site's own data as the picture. */}
        <MapSketch
          nests={nests}
          className="pointer-events-none absolute top-0 -right-24 hidden h-full w-[54rem] opacity-90 md:block"
        />
        <div className="rise relative flex min-w-0 flex-[999_1_32rem] flex-col justify-center gap-5">
          <SmallLabel className="flex items-center gap-2.5 text-primary">
            <AntTrail width={40} />
            Compagnon de Fourmizzz
          </SmallLabel>
          <h1 className="text-6xl leading-[0.92] sm:text-8xl">
            Coordonnez.
            <br />
            <span className="text-primary">Calculez.</span>
            <br />
            Surveillez.
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            Un Espace chiffré pour votre alliance, les simulateurs sans rien installer, et chaque joueur des serveurs{" "}
            {SERVERS[0]?.name} à {SERVERS.at(-1)?.name} suivi heure par heure. Le prolongement de l&apos;extension
            Optizzz.
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href="#extension"
              className="flex h-13 items-center rounded-[0.625rem] bg-primary px-6 font-semibold text-primary-foreground shadow-panel transition hover:-translate-y-px hover:brightness-110 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            >
              Installer l&apos;extension
            </a>
            <Link
              href="/tools"
              className="flex h-13 items-center rounded-[0.625rem] border bg-card px-6 font-semibold hover:bg-accent"
            >
              Ouvrir les outils
            </Link>
          </div>
        </div>
        <div className="rise relative min-w-0 flex-[1_1_21.25rem] [animation-delay:120ms]">
          <RememberedServer blocks={blocks} fallback={fallback} />
        </div>
      </section>

      <JournalTicker server={fallbackName} lines={latest.lines.slice(0, 8)} />

      <section className="grid gap-5 md:grid-cols-3">
        {ROLES.map((role) => (
          <article key={role.title} className="lift flex flex-col gap-3 rounded-[0.875rem] bg-card p-7 shadow-panel">
            <div
              className={`grid size-13 place-items-center rounded-xl ${role.title === "Outils" ? "bg-info-soft text-info" : "bg-accent text-primary"}`}
            >
              <svg
                width={26}
                height={26}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d={ROLE_ICONS[role.title as keyof typeof ROLE_ICONS]} />
              </svg>
            </div>
            <SmallLabel className="text-primary">{role.kicker}</SmallLabel>
            <h2 className="font-heading text-[2rem] font-bold uppercase">{role.title}</h2>
            <p className="text-muted-foreground">{role.text}</p>
            {role.title === "Outils" && (
              <ul className="flex flex-wrap gap-1.5">
                {TOOLS.filter((tool) => tool.ready).map((tool) => (
                  <li key={tool.id}>
                    <Link
                      href={siteToolPath(tool.id)}
                      className="block rounded-full bg-raised px-3 py-1 text-[0.8125rem] hover:bg-accent"
                    >
                      {tool.shortTitle}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-auto pt-2">
              <PanelLink href={role.href}>{role.link}</PanelLink>
            </div>
          </article>
        ))}
      </section>

      <ServersTable bulletins={bulletins} />

      <AdSlot />

      <section
        id="extension"
        className="relative flex scroll-mt-6 flex-wrap items-center justify-between gap-6 overflow-hidden rounded-[1.125rem] bg-card p-9 shadow-panel"
      >
        <svg
          viewBox="0 0 400 120"
          preserveAspectRatio="none"
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 size-full"
        >
          <path
            className="ant-trail"
            d="M-10 100 C80 100 90 30 180 40 S300 110 410 20"
            fill="none"
            stroke="var(--contour)"
            strokeWidth={5}
          />
        </svg>
        <div className="relative min-w-0 flex-[999_1_26rem] space-y-1.5">
          <h2 className="font-heading text-4xl font-bold uppercase">Dans le jeu : l&apos;extension</h2>
          <p className="text-muted-foreground">
            Fins de ponte et de chantier, lanceur de chasse, carte, suivis, sur les pages mêmes de Fourmizzz.
          </p>
        </div>
        <div className="relative flex flex-wrap gap-3">
          <a
            href={CHROME_STORE}
            className="flex h-13 items-center rounded-[0.625rem] bg-primary px-5 font-semibold text-primary-foreground transition hover:-translate-y-px hover:brightness-110 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
          >
            Pour Chrome
          </a>
          <a
            href={FIREFOX_ADDONS}
            className="flex h-13 items-center rounded-[0.625rem] border border-primary px-5 font-semibold hover:bg-accent"
          >
            Pour Firefox
          </a>
        </div>
      </section>
    </div>
  );

  return (
    <HomeSwitch
      visitor={visitor}
      bulletin={<RememberedServer blocks={blocks} fallback={fallback} />}
      tools={
        <div className="space-y-6">
          <ToolsPanel />
          <ServersTable bulletins={bulletins} />
        </div>
      }
    />
  );
}
