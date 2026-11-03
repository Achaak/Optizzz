import { cn } from "cn";
import Link from "next/link";
import type { ReactNode } from "react";
import { SmallLabel } from "~/components/panel";
import { TableHead } from "~/components/ui/table";

// The pieces of the players' and alliances' lists: a filter bar, column heads that sort, the page links.

/** `path` with `query`, empty values left out: « /s5/players?tri=pseudo ». */
export function queryHref(path: string, query: Record<string, string>): string {
  const params = new URLSearchParams(query);
  for (const [key, value] of [...params]) if (!value) params.delete(key);
  const search = params.toString();
  return search ? `${path}?${search}` : path;
}

/** A column head that sorts the list by it, page 1; the current one marked. */
export function SortableHead({
  label,
  sort,
  current,
  href,
  className,
}: {
  label: string;
  sort: string;
  current: string;
  /** The list sorted by `sort`. */
  href: string;
  className?: string;
}) {
  const active = sort === current;
  return (
    <TableHead
      className={className}
      aria-sort={active ? (sort === "pseudo" || sort === "tag" ? "ascending" : "descending") : undefined}
    >
      <Link
        href={href}
        className={cn(
          "inline-flex items-center gap-1 hover:text-foreground",
          active ? "text-primary" : "text-muted-foreground",
        )}
      >
        {label}
        {active && <span aria-hidden>{sort === "pseudo" || sort === "tag" ? "▲" : "▼"}</span>}
      </Link>
    </TableHead>
  );
}

/** The filters over a list, sent as a GET form: the page stays a link. */
export function FilterBar({ action, children, count }: { action: string; children: ReactNode; count: ReactNode }) {
  return (
    <form action={action} className="flex flex-wrap items-end gap-3 border-b px-4 py-3">
      {children}
      <button
        type="submit"
        className="h-9 bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/85 rounded-lg"
      >
        Filtrer
      </button>
      <SmallLabel className="ml-auto self-center">{count}</SmallLabel>
    </form>
  );
}

/** A labelled field of the filter bar. */
export function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-1">
      <SmallLabel className="block">{label}</SmallLabel>
      {children}
    </label>
  );
}

/** A row of links of which one is current: a choice that stays in the address. */
export function ChoiceLinks<T extends string>({
  label,
  choices,
  current,
  text,
  href,
}: {
  label: string;
  choices: readonly T[];
  current: T;
  text: (choice: T) => string;
  href: (choice: T) => string;
}) {
  return (
    <nav aria-label={label} className="flex flex-wrap items-center gap-2">
      <SmallLabel>{label}</SmallLabel>
      <div className="flex flex-wrap gap-0.5 rounded-full bg-raised p-[3px]">
        {choices.map((choice) => (
          <Link
            key={choice}
            href={href(choice)}
            aria-current={choice === current ? "true" : undefined}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm",
              choice === current
                ? "bg-primary font-semibold text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {text(choice)}
          </Link>
        ))}
      </div>
    </nav>
  );
}
