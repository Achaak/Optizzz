// 35 real hunt fights read in the s5 inbox (2026-10-05 to 2026-10-07), one line per fight:
// date | troops sent | prey | damage dealt (base + Weapons bonus) | prey killed | damage taken | ants killed
// | promotions | cm² won | food brought back. No player name. See docs/research/chasse.md.
// Weapons level = bonus / base × 10. Shield: 4 on 2026-10-07 (read on laboratoire.php that day), unknown before.
export const HUNT_REPORT_LINES = `
07/10/26 11h08|1921 JSN, 119 SN|43 Petites araignées|6358+2544|43|56|4|5|118|794
07/10/26 12h40|1975 JSN, 124 SN|18 Petites araignées, 8 Guèpes|6545+2618|26|64|5|5|122|820
07/10/26 13h46|1964 JSN, 129 SN|33 Petites araignées, 3 Cigales|6537+2615|36|64|5|6|120|816
07/10/26 14h49|2017 JSN, 135 SN|18 Petites araignées, 7 Guèpes, 1 Cigale|6726+2691|26|66|5|5|124|842
07/10/26 15h51|2055 JSN, 140 SN|6 Petites araignées, 11 Criquets, 1 Cigale, 1 Hanneton|6865+2746|19|75|6|6|126|859
06/10/26 18h22|1454 JSN, 80 SN|8 Petites araignées, 16 Araignées|4762+1429|24|41|3|4|84|555
06/10/26 19h09|1446 JSN, 84 SN|18 Petites araignées, 5 Criquets|4758+1428|23|45|4|4|83|555
06/10/26 20h01|1438 JSN, 88 SN|2 Petites araignées, 6 Cigales|4754+1427|8|45|4|3|82|554
06/10/26 20h49|1431 JSN, 91 SN|10 Petites araignées, 4 Chenilles, 4 Guèpes|4748+1900|18|45|4|4|81|553
06/10/26 21h38|1423 JSN, 95 SN|2 Petites araignées, 1 Hanneton, 1 Scarabée|4744+1898|4|40|3|3|80|552
06/10/26 22h32|1416 JSN, 98 SN|18 Petites araignées, 4 Guèpes|4738+1896|22|44|4|4|79|551
06/10/26 23h23|1408 JSN, 102 SN|2 Petites araignées, 1 Hanneton, 1 Scarabée|4734+1894|4|40|3|3|78|550
07/10/26 00h42|1401 JSN, 105 SN|10 Petites araignées, 4 Guèpes, 1 Hanneton|4728+1892|15|47|4|4|81|591
07/10/26 08h41|1892 JSN, 109 SN|15 Petites araignées, 11 Criquets|6221+2489|26|66|5|5|117|777
07/10/26 10h06|1931 JSN, 114 SN|18 Petites araignées, 11 Chenilles|6363+2546|29|57|5|5|108|738
05/10/26 21h01|837 JSN, 47 SN|4 Petites araignées, 5 Chenilles|2746+824|9|21|2|1|38|269
05/10/26 21h36|834 JSN, 48 SN|9 Petites araignées, 1 Abeille|2742+823|10|24|2|1|37|266
05/10/26 22h16|831 JSN, 49 SN|9 Petites araignées, 2 Guèpes|2738+822|11|22|2|2|39|287
05/10/26 22h53|827 JSN, 51 SN|2 Petites araignées, 5 Araignées, 2 Guèpes|2736+821|9|23|2|2|39|289
05/10/26 23h32|823 JSN, 53 SN|2 Petites araignées, 5 Araignées, 1 Abeille|2734+821|8|24|2|1|38|286
06/10/26 00h24|820 JSN, 54 SN|16 Petites araignées|2730+819|16|21|1|1|38|288
06/10/26 01h03|817 JSN, 55 SN|7 Petites araignées, 4 Chenilles|2726+818|11|22|2|1|37|285
06/10/26 08h11|1149 JSN, 56 SN|10 Petites araignées, 5 Criquets|3727+1119|15|34|3|2|59|390
06/10/26 09h09|1197 JSN, 58 SN|8 Petites araignées, 6 Criquets|3881+1165|14|36|3|3|62|407
06/10/26 10h32|1196 JSN, 61 SN|6 Petites araignées, 3 Cigales, 1 Abeille|3893+1168|10|41|3|3|71|452
05/10/26 14h11|689 JSN, 35 SN|5 Petites araignées, 3 Criquets|2242+449|8|20|1|1|30|217
05/10/26 14h40|704 JSN, 36 SN|5 Petites araignées, 3 Criquets|2292+459|8|20|1|1|31|223
05/10/26 15h13|722 JSN, 37 SN|5 Petites araignées, 3 Criquets|2351+471|8|20|1|1|32|229
05/10/26 15h49|737 JSN, 38 SN|7 Petites araignées, 1 Abeille|2401+481|8|21|2|1|33|235
05/10/26 16h53|757 JSN, 39 SN|13 Petites araignées|2466+494|13|17|1|1|34|241
05/10/26 17h25|773 JSN, 40 SN|2 Petites araignées, 5 Araignées, 1 Cigale|2519+504|8|20|1|1|35|247
05/10/26 18h17|806 JSN, 41 SN|5 Petites araignées, 3 Chenilles, 1 Criquet|2623+525|9|20|1|1|36|253
05/10/26 19h09|839 JSN, 42 SN|5 Petites araignées, 2 Cigales|2727+546|7|21|2|1|38|263
05/10/26 19h46|845 JSN, 43 SN|2 Petites araignées, 2 Guèpes, 1 Abeille|2750+550|5|25|2|2|38|265
05/10/26 20h26|841 JSN, 45 SN|15 Petites araignées|2748+550|15|20|1|2|38|267
`;

export interface HuntReport {
  date: string;
  sent: Record<string, number>;
  /** Prey count by French plural name, as written in the report. */
  prey: Record<string, number>;
  /** « Vous infligez 6 358 (+ 2 544) »: base attack, then the Weapons bonus (rounded up by the game). */
  attackBase: number;
  attackBonus: number;
  weaponsLevel: number;
  preyKilled: number;
  damageTaken: number;
  antsKilled: number;
  /** Young dwarves (JSN) promoted to dwarves (SN). */
  promoted: number;
  fieldWon: number;
  food: number;
}

const counts = (text: string) =>
  Object.fromEntries(
    text.split(", ").map((part) => {
      const [count = "", ...name] = part.split(" ");
      return [name.join(" "), Number(count)];
    }),
  );

export const HUNT_REPORTS: HuntReport[] = HUNT_REPORT_LINES.trim()
  .split("\n")
  .map((line) => {
    const [date = "", sent = "", prey = "", dealt = "", preyKilled, taken, killed, promoted, field, food] =
      line.split("|");
    const [base = 0, bonus = 0] = dealt.split("+").map(Number);
    return {
      date,
      sent: counts(sent),
      prey: counts(prey),
      attackBase: base,
      attackBonus: bonus,
      weaponsLevel: Math.round((bonus / base) * 10),
      preyKilled: Number(preyKilled),
      damageTaken: Number(taken),
      antsKilled: Number(killed),
      promoted: Number(promoted),
      fieldWon: Number(field),
      food: Number(food),
    };
  });
