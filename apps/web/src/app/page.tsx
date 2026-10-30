import { describeChange } from "@optizzz/game/changes";
import { formatNumber } from "@optizzz/game/format/number-format";
import { dayMonth, formatDateTime } from "@optizzz/game/format/time-format";
import { SERVERS } from "@optizzz/game/servers";
import { siteToolPath } from "@optizzz/game/site-links/site";
import Link from "next/link";
import { AdSlot } from "~/components/ad-slot";
import { HomeSwitch } from "~/components/home/dashboard";
import { RememberedServer } from "~/components/home/remembered-server";
import { MonoLabel, Panel, PanelLink } from "~/components/panel";
import { Sparkline } from "~/components/sparkline";
import { TOOLS } from "~/components/tools/tool-list";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { journalTag } from "~/lib/server-stats";
import { serverBulletin, type ServerBulletin } from "~/server/queries";

// Rebuilt by the cron once the exports are stored (api/revalidate), at worst every hour.
export const revalidate = 3600;

const CHROME_STORE = "https://chromewebstore.google.com/detail/optizzz/goeifkbimepccacjfkkmhjmhgoiigjpl";
const FIREFOX_ADDONS = "https://addons.mozilla.org/fr/firefox/addon/optizzz/";

const ROLES = [
  {
    kicker: "01 · Alliance",
    title: "Espaces",
    text: "Demandes de ressources, convois, floods, absences, rappels Discord. Chiffré de bout en bout : le site ne lit rien.",
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
    text: "Joueurs, alliances, diplomatie, carte. Relus chaque heure depuis l'export public du jeu.",
    href: "/s5",
    link: "Surveiller",
  },
];

/** « Bulletin S5 »: a server's figures, its players these two weeks, its latest diplomacy. */
function Bulletin({ id, name, bulletin }: { id: string; name: string; bulletin: ServerBulletin }) {
  const days = bulletin.playersPerDay;
  const first = days[0];
  const last = days.at(-1);
  return (
    <div className="flex h-full flex-col border bg-card">
      <div className="flex justify-between gap-4 border-b px-4 py-2.5">
        <MonoLabel>Bulletin {name}</MonoLabel>
        <MonoLabel>{formatDateTime(bulletin.reading)}</MonoLabel>
      </div>
      <div className="grid grid-cols-3 border-b">
        {[
          [bulletin.players, "joueurs"],
          [bulletin.alliances, "alliances"],
          [bulletin.colonized, "colonisés"],
        ].map(([value, label]) => (
          <div key={label} className="border-r px-4 py-3 last:border-r-0">
            <div className="font-mono text-2xl">{formatNumber(Number(value))}</div>
            <div className="text-xs text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>
      {first && last && days.length >= 2 && (
        <figure className="m-0 space-y-1 border-b px-4 py-3">
          <Sparkline
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
        <ul className="space-y-1.5 border-b px-4 py-3 text-sm">
          {bulletin.journal.map((line) => (
            <li key={line.id}>
              <MonoLabel className="mr-2 text-info">{journalTag(line.change)}</MonoLabel>
              <strong>{line.name}</strong> {describeChange(line.change)}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-auto px-4 py-3">
        <PanelLink href={`/${id}`}>Ouvrir {name}</PanelLink>
      </div>
    </div>
  );
}

function ToolsPanel() {
  return (
    <Panel title="Outils" aside={<PanelLink href="/tools">Tous les outils</PanelLink>}>
      <div className="flex flex-wrap gap-2">
        {TOOLS.filter((tool) => tool.ready).map((tool) => (
          <Link key={tool.id} href={siteToolPath(tool.id)} className="border px-3 py-1.5 text-sm hover:bg-accent">
            {tool.shortTitle}
          </Link>
        ))}
      </div>
    </Panel>
  );
}

function ServersTable({ bulletins }: { bulletins: Map<string, ServerBulletin> }) {
  return (
    <Panel flush title="Serveurs">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">Serveur</TableHead>
            <TableHead className="text-right">Joueurs</TableHead>
            <TableHead className="hidden sm:table-cell">Ces deux semaines</TableHead>
            <TableHead className="pr-4" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {SERVERS.map((server) => {
            const bulletin = bulletins.get(server.id);
            return (
              <TableRow key={server.id}>
                <TableCell className="pl-4 font-heading text-2xl font-bold">{server.name}</TableCell>
                <TableCell className="text-right font-mono">
                  {bulletin ? formatNumber(bulletin.players) : <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="hidden w-48 sm:table-cell">
                  {bulletin ? (
                    <Sparkline
                      className="h-8 w-40"
                      values={bulletin.playersPerDay.map((day) => day.players)}
                      label={`Joueurs inscrits sur ${server.name} ces deux semaines`}
                    />
                  ) : (
                    <span className="text-sm text-muted-foreground">Pas encore relu</span>
                  )}
                </TableCell>
                <TableCell className="pr-4 text-right">
                  {bulletin && <PanelLink href={`/${server.id}`}>Ouvrir</PanelLink>}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Panel>
  );
}

export default async function Home() {
  const bulletins = new Map<string, ServerBulletin>();
  for (const [index, bulletin] of (await Promise.all(SERVERS.map((server) => serverBulletin(server.id)))).entries()) {
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
    <div className="space-y-12">
      <section className="flex flex-wrap items-stretch gap-8">
        <div className="flex min-w-0 flex-[999_1_32rem] flex-col justify-center gap-5">
          <MonoLabel className="text-primary">Compagnon de Fourmizzz</MonoLabel>
          <h1 className="text-6xl leading-[0.95] sm:text-7xl">Coordonnez. Calculez. Surveillez.</h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            Un Espace chiffré pour votre alliance, les simulateurs sans rien installer, et chaque joueur des serveurs
            suivi heure par heure. Le prolongement de l&apos;extension Optizzz.
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
        <div className="min-w-0 flex-[1_1_20rem]">
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
            Fins de ponte et de chantier, lanceur de chasse, carte, suivis de joueurs, sur les pages mêmes de Fourmizzz.
            Elle remplit aussi l&apos;Espace de votre alliance, d&apos;un clic.
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
      tools={
        <div className="space-y-6">
          <ToolsPanel />
          <ServersTable bulletins={bulletins} />
        </div>
      }
    />
  );
}
