import Link from "next/link";
import { queryHref } from "~/components/list-parts";
import { buttonVariants } from "~/components/ui/button";

/** « Page 2 sur 412 » with the previous and next pages, keeping the rest of the query. */
export function Pager({
  path,
  query,
  page,
  pages,
}: {
  path: string;
  query: Record<string, string>;
  page: number;
  pages: number;
}) {
  if (pages <= 1) return null;
  const href = (target: number) => queryHref(path, { ...query, page: target > 1 ? String(target) : "" });
  return (
    <nav aria-label="Pages" className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
      {page > 1 ? (
        <Link href={href(page - 1)} className={buttonVariants({ variant: "outline", size: "lg" })}>
          ← Précédente
        </Link>
      ) : (
        <span />
      )}
      <span className="font-mono text-xs text-muted-foreground">
        Page {page} sur {pages}
      </span>
      {page < pages ? (
        <Link href={href(page + 1)} className={buttonVariants({ variant: "outline", size: "lg" })}>
          Suivante →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
