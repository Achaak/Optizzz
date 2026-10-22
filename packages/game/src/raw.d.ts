// Game pages kept as fixtures, imported as text by the tests (Vite's `?raw`).
declare module "*?raw" {
  const content: string;
  export default content;
}
