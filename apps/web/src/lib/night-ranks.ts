// A player's rank by TDC on each night, from a server's PlayerDay rows held in memory (docs/features/site-public.md,
// « Ce que garde la base »). Counting it in SQL meant one pass over every row of the server per night: 18 s for one
// S4 player with 39 nights, enough to choke the VPS when several pages were rebuilt at once (2026-11-20).

/** A PlayerDay row: the player's TDC on every night of [day, until). */
export interface NightRow {
  playerId: number;
  field: number;
  day: Date;
  until: Date | null;
}

/** A server's rows, by TDC from the largest, each with the first night it holds and the first it no longer holds. */
export interface NightTable {
  nights: readonly Date[];
  field: Float64Array;
  playerId: Int32Array;
  /** Index in `nights` of the first night the row holds. */
  from: Uint16Array;
  /** Index in `nights` of the first night the row no longer holds; `nights.length` while it still holds. */
  to: Uint16Array;
}

/** The index of the first night on or after `date`: `nights` are sorted, oldest first. */
function firstNightFrom(nights: readonly Date[], date: Date): number {
  const time = date.getTime();
  let low = 0;
  let high = nights.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if ((nights[middle]?.getTime() ?? Infinity) < time) low = middle + 1;
    else high = middle;
  }
  return low;
}

/** `nights`: the server's nights (ServerDay), oldest first. About 12 bytes a row: 3 MB for S4's 240 000. */
export function nightTable(nights: readonly Date[], rows: readonly NightRow[]): NightTable {
  const order = rows.map((_, index) => index).sort((a, b) => (rows[b]?.field ?? 0) - (rows[a]?.field ?? 0));
  const table: NightTable = {
    nights,
    field: new Float64Array(rows.length),
    playerId: new Int32Array(rows.length),
    from: new Uint16Array(rows.length),
    to: new Uint16Array(rows.length),
  };
  order.forEach((source, index) => {
    const row = rows[source];
    if (!row) return;
    table.field[index] = row.field;
    table.playerId[index] = row.playerId;
    table.from[index] = firstNightFrom(nights, row.day);
    table.to[index] = row.until === null ? nights.length : firstNightFrom(nights, row.until);
  });
  return table;
}

/**
 * The rank by TDC of the players `ids` on each night from `since` on (every night when null), 1 first, ties sharing
 * it: 1 + the rows holding that night with a larger TDC. One pass over the rows, from the largest TDC down.
 */
export function nightRanks(
  table: NightTable,
  ids: readonly number[],
  since: Date | null,
): { id: number; day: Date; rank: number }[] {
  const { nights } = table;
  const first = since === null ? 0 : firstNightFrom(nights, since);
  const wanted = new Set(ids);
  // Each night asked: the player and its TDC that night.
  const targets: { id: number; night: number; field: number }[] = [];
  for (let row = 0; row < table.field.length; row++) {
    const id = table.playerId[row] ?? 0;
    if (!wanted.has(id)) continue;
    for (let night = Math.max(first, table.from[row] ?? 0); night < (table.to[row] ?? 0); night++)
      targets.push({ id, night, field: table.field[row] ?? 0 });
  }
  targets.sort((a, b) => b.field - a.field);
  // How many of the rows seen so far start, and stop, at each night.
  const starts = new Int32Array(nights.length + 1);
  const stops = new Int32Array(nights.length + 1);
  const ranked: { id: number; day: Date; rank: number }[] = [];
  let seen = 0;
  for (const target of targets) {
    while (seen < table.field.length && (table.field[seen] ?? 0) > target.field) {
      const from = table.from[seen] ?? 0;
      const to = table.to[seen] ?? 0;
      starts[from] = (starts[from] ?? 0) + 1;
      stops[to] = (stops[to] ?? 0) + 1;
      seen++;
    }
    let holding = 0;
    for (let night = 0; night <= target.night; night++) holding += (starts[night] ?? 0) - (stops[night] ?? 0);
    const day = nights[target.night];
    if (day) ranked.push({ id: target.id, day, rank: holding + 1 });
  }
  return ranked.sort((a, b) => a.day.getTime() - b.day.getTime() || a.id - b.id);
}
