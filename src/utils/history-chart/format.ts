import { formatAmount, formatDecimal } from "@/utils/number-format";

/** « +1 234 » or « −56 ». */
export const formatGain = (gain: number) => `${gain < 0 ? "−" : "+"}${formatAmount(Math.abs(gain))}`;

/** « +12,5 % », or « — » when unknown. */
export const formatPercent = (percent: number | null) =>
  percent === null ? "—" : `${percent < 0 ? "−" : "+"}${formatDecimal(Math.abs(percent))} %`;
