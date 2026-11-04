import { SectionNav } from "~/components/section-nav";
import { GUIDES, guidePath } from "~/lib/guides/guides";

const LINKS = [
  { href: "/guides", label: "Tous les guides" },
  ...GUIDES.filter((guide) => guide.ready).map((guide) => ({ href: guidePath(guide.id), label: guide.shortTitle })),
];

export default function GuidesLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SectionNav label="Guides" links={LINKS} />
      {children}
    </>
  );
}
