import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Amount } from "./Amount";
import { setCompactNumbers } from "@optizzz/game/format/number-format";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  setCompactNumbers(false);
});

const draw = (value: number) => {
  act(() => {
    root.render(<Amount value={value} />);
  });
};

describe("Amount", () => {
  it("writes the exact number, without a tooltip, while compact numbers are off", () => {
    draw(1234567);
    expect(container.innerHTML).toBe("1 234 567");
  });

  it("gives the exact number on hover when it is shortened", () => {
    setCompactNumbers(true);
    draw(1234567);
    expect(container.textContent).toBe("1,23M");
    expect(container.querySelector("span")?.title).toBe("1 234 567");
  });

  it("adds no tooltip under 10 000", () => {
    setCompactNumbers(true);
    draw(9999);
    expect(container.innerHTML).toBe("9 999");
  });
});
