import Link from "next/link";
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
  const href = (target: number) => {
    const params = new URLSearchParams({ ...query, ...(target > 1 && { page: String(target) }) });
    for (const [key, value] of [...params]) if (!value) params.delete(key);
    const search = params.toString();
    return search ? `${path}?${search}` : path;
  };
  return (
    <nav aria-label="Pages" className="flex items-center justify-between gap-4 text-sm">
      {page > 1 ? (
        <Link href={href(page - 1)} className={buttonVariants({ variant: "outline" })}>
          Précédente
        </Link>
      ) : (
        <span />
      )}
      <span className="text-muted-foreground">
        Page {page} sur {pages}
      </span>
      {page < pages ? (
        <Link href={href(page + 1)} className={buttonVariants({ variant: "outline" })}>
          Suivante
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
