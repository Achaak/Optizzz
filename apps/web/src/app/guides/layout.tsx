import { SectionNav } from "~/components/section-nav";
import { guidePath, WRITTEN_GUIDES } from "~/lib/guides/guides";

const LINKS = [
  { href: "/guides", label: "Tous les guides" },
  ...WRITTEN_GUIDES.map((guide) => ({ href: guidePath(guide.id), label: guide.shortTitle })),
];

export default function GuidesLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SectionNav label="Guides" links={LINKS} />
      {children}
    </>
  );
}
