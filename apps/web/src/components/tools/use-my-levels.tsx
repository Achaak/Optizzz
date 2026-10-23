"use client";

// « Mes niveaux » in a tool: what is typed in its level fields is remembered, except over a link's levels, which
// « Reprendre mes niveaux » replaces with the visitor's own. See my-levels.ts and docs/features/site-outils.md.
import { useCallback, useState } from "react";
import { Button } from "~/components/ui/button";
import { readStorage, writeStorage } from "./browser-storage";
import {
  MY_LEVELS_KEY,
  openLevels,
  parseMyLevels,
  resumeLevels,
  typedLevels,
  type LevelsMemory,
  type MyLevelKey,
  type MyLevels,
} from "./my-levels";

export interface MyLevelsInTool {
  /** The tool shows a link's levels: « Reprendre mes niveaux » is offered. */
  linked: boolean;
  /** To call with the level fields the visitor just typed (null: emptied). */
  remember: (typed: Partial<Record<MyLevelKey, number | null>>) => void;
  /** « Reprendre mes niveaux »: the visitor's levels, to put in the tool's fields. */
  resume: () => MyLevels;
}

/** `fromLink` and `opening` come from `useToolState`. */
export function useMyLevels({ fromLink, opening }: { fromLink: boolean; opening: number }): MyLevelsInTool {
  const [memory, setMemory] = useState<LevelsMemory & { opening: number }>({ mine: {}, linked: false, opening: -1 });

  // Read at each opening of the tool (a link pasted in the tab opens it again), while rendering.
  let current = memory;
  if (opening >= 0 && memory.opening !== opening) {
    current = { ...openLevels(parseMyLevels(readStorage(MY_LEVELS_KEY)), { fromLink }), opening };
    setMemory(current);
  }

  const remember = useCallback(
    (typed: Partial<Record<MyLevelKey, number | null>>) => {
      const next = typedLevels(current, typed);
      if (next === current) return;
      writeStorage(MY_LEVELS_KEY, JSON.stringify(next.mine));
      setMemory({ ...next, opening: current.opening });
    },
    [current],
  );

  const resume = useCallback(() => {
    const { memory: next, levels } = resumeLevels(current);
    setMemory({ ...next, opening: current.opening });
    return levels;
  }, [current]);

  return { linked: current.linked, remember, resume };
}

/** Shown while a tool holds a link's levels. */
export function ResumeLevelsButton({
  levels,
  onResume,
}: {
  levels: MyLevelsInTool;
  onResume: (mine: MyLevels) => void;
}) {
  if (!levels.linked) return null;
  return (
    <Button type="button" variant="outline" size="sm" onClick={() => onResume(levels.resume())}>
      Reprendre mes niveaux
    </Button>
  );
}
