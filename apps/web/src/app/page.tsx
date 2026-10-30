import { describeChange } from "@optizzz/game/changes";
import { formatNumber } from "@optizzz/game/format/number-format";
import { dayMonth, formatDateTime } from "@optizzz/game/format/time-format";
import { SERVERS } from "@optizzz/game/servers";
import { siteToolPath } from "@optizzz/game/site-links/site";
import Link from "next/link";
import { AdSlot } from "~/components/ad-slot";
import { HomeSwitch } from "~/components/home/dashboard";
import { RememberedServer, ServerRow } from "~/components/home/remembered-server";
import { MonoLabel, Panel, PanelLink } from "~/components/panel";
import { Sparkline } from "~/components/sparkline";
import { TOOLS } from "~/components/tools/tool-list";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { journalTag } from "~/lib/server-stats";
import { journalPerDay, serverBulletin, type ServerBulletin } from "~/server/queries";

// Rebuilt by the cron once the exports are stored (api/revalidate), at worst every hour.
export const revalidate = 3600;

const CHROME_STORE = "https://chromewebstore.google.com/detail/optizzz/goeifkbimepccacjfkkmhjmhgoiigjpl";
const FIREFOX_ADDONS = "https://addons.mozilla.org/fr/firefox/addon/optizzz/";

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
    <div className="flex h-full flex-col border bg-card">
      <div className="flex justify-between gap-4 border-b px-4 py-2.5">
        <MonoLabel>Bulletin {name}</MonoLabel>
        <MonoLabel>{formatDateTime(bulletin.reading)}</MonoLabel>
      </div>
      <div className="grid grid-cols-2">
        {figures.map(([value, label], index) => (
          <div key={label} className={`p-4 ${index % 2 === 0 ? "border-r" : ""} ${index < 2 ? "border-b" : ""}`}>
            <div className="font-mono text-[1.75rem] leading-tight">{formatNumber(value)}</div>
            <div className="text-[0.8125rem] text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>
      {first && last && days.length >= 2 && (
        <figure className="m-0 space-y-1 border-t px-4 py-3">
          <Sparkline
            className="h-16 w-full"
            values={days.map((day) => day.players)}
            label={`Joueurs inscrits sur ${name}, de ${formatNumber(first.players)} le ${dayMonth(first.day)} à ${formatNumber(last.players)} le ${dayMonth(last.day)}`}
          />
          <figcaption className="flex justify-between font-mono text-[0.6875rem] text-muted-foreground">
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
        <ul className="space-y-1.5 border-t px-4 py-3 text-sm">
          {bulletin.journal.map((line) => (
            <li key={line.id}>
              <span className="mr-2 font-mono text-[0.6875rem] text-info uppercase">{journalTag(line.change)}</span>
              <strong>{line.name}</strong> {describeChange(line.change)}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-auto border-t px-4 py-3">
        <PanelLink href={`/${id}`}>Ouvrir {name}</PanelLink>
      </div>
    </div>
  );
}

function ToolsPanel() {
  return (
    <Panel flush title="Outils" aside={<PanelLink href="/tools">Tous les outils</PanelLink>}>
      <ul className="divide-y">
        {TOOLS.filter((tool) => tool.ready).map((tool) => (
          <li key={tool.id}>
            <Link
              href={siteToolPath(tool.id)}
              className="grid gap-x-4 gap-y-0.5 px-4 py-2.5 hover:bg-accent sm:grid-cols-[7rem_minmax(0,1fr)]"
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
      <h2 id="servers-title" className="font-heading text-3xl font-bold uppercase">
        Serveurs
      </h2>
      <div className="border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {[
                ["Serveur", "pl-4"],
                ["Joueurs", "px-4 text-right"],
                ["État", "px-4"],
              ].map(([label, className]) => (
                <TableHead
                  key={label}
                  className={`font-mono text-[0.6875rem] font-medium tracking-widest text-muted-foreground uppercase ${className ?? ""}`}
                >
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

  const visitor = (
    <div className="space-y-14">
      <section className="flex flex-wrap items-stretch gap-8">
        <div className="flex min-w-0 flex-[999_1_32rem] flex-col justify-center gap-5">
          <MonoLabel className="text-primary">Compagnon de Fourmizzz</MonoLabel>
          <h1 className="text-6xl leading-[0.95] sm:text-7xl">Coordonnez. Calculez. Surveillez.</h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            Un Espace chiffré pour votre alliance, les simulateurs sans rien installer, et chaque joueur des serveurs{" "}
            {SERVERS[0]?.name} à {SERVERS.at(-1)?.name} suivi heure par heure. Le prolongement de l&apos;extension
            Optizzz.
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href="#extension"
              className="flex h-12 items-center bg-primary px-6 font-semibold text-primary-foreground hover:bg-primary/85"
            >
              Installer l&apos;extension
            </a>
            <Link href="/tools" className="flex h-12 items-center border px-6 font-semibold hover:bg-accent">
              Ouvrir les outils
            </Link>
          </div>
        </div>
        <div className="min-w-0 flex-[1_1_21.25rem]">
          <RememberedServer blocks={blocks} fallback={fallback} />
        </div>
      </section>

      <section className="grid border bg-card md:grid-cols-3">
        {ROLES.map((role) => (
          <article
            key={role.title}
            className="flex flex-col gap-2.5 border-b p-6 md:border-r md:border-b-0 md:last:border-r-0"
          >
            <MonoLabel className="text-primary">{role.kicker}</MonoLabel>
            <h2 className="font-heading text-3xl font-bold uppercase">{role.title}</h2>
            <p className="text-muted-foreground">{role.text}</p>
            {role.title === "Outils" && (
              <ul className="flex flex-wrap gap-1.5">
                {TOOLS.filter((tool) => tool.ready).map((tool) => (
                  <li key={tool.id}>
                    <Link
                      href={siteToolPath(tool.id)}
                      className="block border px-2.5 py-0.5 text-[0.8125rem] hover:bg-accent"
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
        className="flex scroll-mt-6 flex-wrap items-center justify-between gap-6 border border-primary bg-accent p-7"
      >
        <div className="min-w-0 flex-[999_1_26rem] space-y-1.5">
          <h2 className="font-heading text-3xl font-bold uppercase">Dans le jeu : l&apos;extension</h2>
          <p className="text-muted-foreground">
            Fins de ponte et de chantier, lanceur de chasse, carte, suivis, sur les pages mêmes de Fourmizzz.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <a
            href={CHROME_STORE}
            className="flex h-12 items-center bg-primary px-5 font-semibold text-primary-foreground hover:bg-primary/85"
          >
            Pour Chrome
          </a>
          <a
            href={FIREFOX_ADDONS}
            className="flex h-12 items-center border border-primary px-5 font-semibold hover:bg-card"
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
