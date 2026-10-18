import reineHtml from "./reine.html?raw";

const row = (units: string, place: string, id: number) =>
  `<tr><td>${units}</td><td>${place}</td><td>4m 21s</td><td><span id="ponte_${String(id)}">4m 21s</span></td></tr>`;

/** Reine.php with these « Pontes en cours » rows: units as written, then the garrison. */
export const reineWithQueue = (...rows: [string, string][]) =>
  reineHtml.replace("<!--QUEUE-->", rows.map(([units, place], i) => row(units, place, 100 + i)).join(""));
