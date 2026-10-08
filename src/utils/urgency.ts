// One scale of urgency for every countdown to a problem (famine, full warehouse): header, simulator and badge.

const HOUR = 60 * 60_000;

/** Red below this. */
export const DANGER_UNDER = 6 * HOUR;
/** Orange below this. */
export const WARNING_UNDER = 24 * HOUR;

export type Urgency = "danger" | "warning";

/** How urgent a problem `left` milliseconds away is; null when it is far enough. */
export const urgencyOf = (left: number): Urgency | null =>
  left < DANGER_UNDER ? "danger" : left < WARNING_UNDER ? "warning" : null;

/** The same red and orange everywhere, the toolbar badge included (it takes plain colours, not CSS variables). */
export const URGENCY_COLORS: Record<Urgency, string> = { danger: "#cc0000", warning: "#c76b00" };
