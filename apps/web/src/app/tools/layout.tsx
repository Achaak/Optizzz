import { siteToolPath } from "@optizzz/game/site-links/site";
import { SectionNav } from "~/components/section-nav";
import { TOOLS } from "~/components/tools/tool-list";

const LINKS = [
  { href: "/tools", label: "Tous les outils" },
  ...TOOLS.filter((tool) => tool.ready).map((tool) => ({ href: siteToolPath(tool.id), label: tool.shortTitle })),
];

export default function ToolsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SectionNav label="Outils" links={LINKS} />
      {children}
    </>
  );
}
