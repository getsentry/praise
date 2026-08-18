import {
  addPraiseButton,
  buttonClass,
  type PraiseSource,
} from "./praise-button";
import { installExecCommand } from "./test-support/execCommand";
import { loadFixture } from "./test-support/fixtures";

const reviewPraises = ["Great review!", "Sharp eye!"];
const commentPraises = ["Nice work!", "Good call!"];

const praises: PraiseSource = (context) =>
  context === "reviews" ? reviewPraises : commentPraises;

function label(element: Element | null | undefined): string {
  return (element?.textContent ?? "").replace(/\s+/g, " ").trim();
}

function buttons(scope: ParentNode = document): HTMLElement[] {
  return [...scope.querySelectorAll<HTMLElement>(`.${buttonClass}`)];
}

beforeEach(() => {
  installExecCommand();
});

describe("in the review dialog", () => {
  let textarea: HTMLTextAreaElement;

  beforeEach(() => {
    loadFixture("review-dialog");
    textarea = document.querySelector<HTMLTextAreaElement>(
      '[role="dialog"] textarea',
    )!;
  });

  test("one button is added, immediately before Cancel", () => {
    addPraiseButton(textarea, praises);

    expect(buttons()).toHaveLength(1);
    const button = buttons()[0];
    expect(label(button)).toBe("PR");
    expect(label(button.nextElementSibling)).toBe("Cancel");
  });

  test("re-decorating the same textarea does not add a second button", () => {
    // React re-renders constantly, so this path is hit in normal use.
    addPraiseButton(textarea, praises);
    addPraiseButton(textarea, praises);

    expect(buttons()).toHaveLength(1);
  });

  test("clicking fills the textarea from the reviews list", () => {
    addPraiseButton(textarea, praises);
    buttons()[0].click();

    expect(reviewPraises).toContain(textarea.value);
  });

  test("a textarea outside the dialog gets no button", () => {
    const decoy = document.querySelector<HTMLTextAreaElement>("#praise-decoy")!;

    addPraiseButton(decoy, praises);

    expect(buttons()).toHaveLength(0);
  });
});

describe("in a diff comment editor", () => {
  let container: HTMLElement;
  let textarea: HTMLTextAreaElement;

  beforeEach(() => {
    loadFixture("diff-comment");
    container = document.querySelector<HTMLElement>('[data-editor="1"]')!;
    textarea = container.querySelector<HTMLTextAreaElement>("textarea")!;
  });

  test("the button lands in the editor it belongs to", () => {
    addPraiseButton(textarea, praises);

    expect(buttons()).toHaveLength(1);
    expect(container.contains(buttons()[0])).toBe(true);
    expect(label(buttons()[0].nextElementSibling)).toBe("Cancel");
  });

  test("clicking fills the textarea from the comments list", () => {
    addPraiseButton(textarea, praises);
    buttons()[0].click();

    expect(commentPraises).toContain(textarea.value);
  });

  test("decorating one editor leaves the other untouched", () => {
    addPraiseButton(textarea, praises);

    const other = document.querySelector<HTMLElement>('[data-editor="2"]')!;
    expect(buttons(other)).toHaveLength(0);
  });
});

describe("writing praises", () => {
  let textarea: HTMLTextAreaElement;

  beforeEach(() => {
    loadFixture("diff-comment");
    textarea = document.querySelector<HTMLTextAreaElement>(
      '[data-editor="1"] textarea',
    )!;
    addPraiseButton(textarea, praises);
  });

  test("clicking again can produce a different praise", () => {
    const button = buttons()[0];

    button.click();
    const first = textarea.value;

    // setPraise retries up to 10 times for a value different from the current
    // one, so with two praises available a change is effectively certain.
    button.click();

    expect(textarea.value).not.toBe(first);
    expect(commentPraises).toContain(textarea.value);
  });

  test("our own write leaves the button visible", () => {
    const button = buttons()[0];

    button.click();

    // The whole point of tracking what we wrote: the input event our write fires
    // is indistinguishable from the user's, and clicking again must stay possible.
    expect(button.hidden).toBe(false);
  });

  test("typing manually hides the button", () => {
    const button = buttons()[0];

    textarea.value = "I typed this myself";
    textarea.dispatchEvent(new Event("input", { bubbles: true }));

    expect(button.hidden).toBe(true);
  });

  test("clearing the field brings the button back", () => {
    const button = buttons()[0];

    textarea.value = "typed";
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.value = "";
    textarea.dispatchEvent(new Event("input", { bubbles: true }));

    expect(button.hidden).toBe(false);
  });

  test("an empty praise list writes nothing", () => {
    loadFixture("diff-comment");
    const empty = document.querySelector<HTMLTextAreaElement>(
      '[data-editor="1"] textarea',
    )!;
    addPraiseButton(empty, () => []);

    buttons()[0].click();

    expect(empty.value).toBe("");
  });
});
