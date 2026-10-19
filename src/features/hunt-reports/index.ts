import type { Levels } from "@/game/army/units";
import type { Feature } from "../feature";
import { loadLaying } from "@/data/laying";
import { loadLevels } from "@/data/levels";
import { HUNT_REPORT_STYLE, mountHuntReport } from "./mount";
import { expeditionCount } from "./report";

type MountedReport = ReturnType<typeof mountHuntReport>;

/** The conversation's header row, a few rows above its detail. */
function headerOf(conversation: Element): Element | null {
  let row = conversation.previousElementSibling;
  while (row && !row.classList.contains("en_tete_message")) row = row.previousElementSibling;
  return row;
}

/**
 * Table of the fights of each « Chasses » conversation the player opens, with the losses the engine predicts.
 * See docs/features/hunt-reports.md.
 */
export const huntReports: Feature = {
  id: "hunt-reports",
  toggle: "hunt-reports",
  matches: (url) => url.pathname.toLowerCase() === "/messagerie.php",
  run(ctx) {
    const style = document.createElement("style");
    style.textContent = HUNT_REPORT_STYLE;
    document.head.append(style);

    // Read once, when the first hunt conversation is opened; null when the shield cannot be known.
    let levels: Promise<Pick<Levels, "shield" | "cochineal"> | null> | undefined;
    const getLevels = () =>
      (levels ??= loadLevels(location.origin).catch((error: unknown) => {
        console.warn("[Optizzz] hunt reports: levels unknown", error);
        return null;
      }));

    // The laying speed turns the losses into laying time; null when Reine.php cannot be read.
    let layingSpeed: Promise<number | null> | undefined;
    const getLayingSpeed = () =>
      (layingSpeed ??= loadLaying(location.origin, new Date())
        .then((laying) => laying?.speed ?? null)
        .catch((error: unknown) => {
          console.warn("[Optizzz] hunt reports: laying speed unknown", error);
          return null;
        }));

    const mounted = new WeakMap<Element, { report: MountedReport; count: number }>();
    const pending = new WeakSet<Element>();
    const scan = () => {
      for (const conversation of document.querySelectorAll("tr.contenu_conversation")) {
        if (headerOf(conversation)?.getAttribute("data-type") !== "Chasses" || pending.has(conversation)) continue;
        const known = mounted.get(conversation);
        if (known) {
          // More fights loaded by « Voir les messages précédents ».
          const count = known.report.messageCount();
          if (count !== known.count) {
            known.count = count;
            known.report.update();
          }
          continue;
        }
        pending.add(conversation);
        void Promise.all([getLevels(), getLayingSpeed()]).then(([read, speed]) => {
          const report = mountHuntReport(
            conversation,
            read,
            (text) => navigator.clipboard.writeText(text),
            expeditionCount(headerOf(conversation)?.textContent ?? ""),
            speed,
          );
          mounted.set(conversation, { report, count: report.messageCount() });
          pending.delete(conversation);
        });
      }
    };

    // The game loads each conversation over AJAX when its title is clicked. The report's own changes are skipped.
    const observer = new MutationObserver((records) => {
      const outside = records.some(
        (record) => !(record.target instanceof Element && record.target.closest(".optizzz-hunt-report")),
      );
      if (outside) scan();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    ctx.onInvalidated(() => observer.disconnect());
    scan();
  },
};
