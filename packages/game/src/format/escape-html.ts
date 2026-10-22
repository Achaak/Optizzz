/** Text safe to put inside HTML markup (ECharts tooltips): player and game data go through it. */
export const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${String(c.charCodeAt(0))};`);
