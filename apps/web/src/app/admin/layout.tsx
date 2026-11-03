import type { ReactNode } from "react";
import { SectionNav } from "~/components/section-nav";
import { requireAdmin } from "~/server/admin";

// The back office (docs/features/site-back-office.md). The gate is here too: without it, the 404 shown to anyone else
// would carry this bar, which names the back office.
export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdmin();
  return (
    <>
      <SectionNav
        label="Back office"
        stamped
        links={[
          { href: "/admin", label: "Vue d'ensemble" },
          { href: "/admin/collecte", label: "Collecte et sauvegardes" },
          { href: "/admin/comptes", label: "Comptes et Espaces" },
        ]}
      />
      {children}
    </>
  );
}
