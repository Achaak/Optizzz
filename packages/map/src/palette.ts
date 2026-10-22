// The colours of a map. ECharts draws on a canvas and cannot read CSS variables: each app passes its own, chosen
// for colour blindness (docs/adr/0003-daltonisme.md).
export interface MapPalette {
  text: string;
  /** A player on holiday. */
  holiday: string;
  /** Every player of the server under the ones chosen. */
  background: string;
  /** Me, or the reference. */
  selected: string;
  /** Outline of labels drawn over points: the chart's background. */
  halo: string;
  /** Chips, in order. */
  chips: readonly string[];
  /** Pacts and wars each get a family of hues: blues against reds and oranges, never greens against reds. */
  allies: readonly string[];
  enemies: readonly string[];
}
