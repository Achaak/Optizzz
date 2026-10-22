import { afterEach, describe, expect, it } from "vitest";
import { waitForElement } from "./wait-for-element";

describe("waitForElement", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("resolves immediately when the element is already there", async () => {
    document.body.innerHTML = `<table id="target"></table>`;
    await expect(waitForElement("#target", 100)).resolves.toBeInstanceOf(HTMLTableElement);
  });

  it("resolves when the element is inserted later", async () => {
    const found = waitForElement("#target", 1000);
    setTimeout(() => {
      document.body.innerHTML = `<div><table id="target"></table></div>`;
    }, 10);
    await expect(found).resolves.toBeInstanceOf(HTMLTableElement);
  });

  it("resolves to null after the timeout", async () => {
    await expect(waitForElement("#missing", 20)).resolves.toBeNull();
  });
});
