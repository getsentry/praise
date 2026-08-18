import { loadFixture } from "./test-support/fixtures";
import {
  diffCommentEditor,
  findInsertionPoint,
  markdownTextarea,
  praiseContext,
  reviewDialog,
} from "./selectors";

/** The caption `findInsertionPoint` anchors to, and the one we assert against. */
function label(element: Element | null | undefined): string {
  return (element?.textContent ?? "").replace(/\s+/g, " ").trim();
}

describe("review dialog", () => {
  beforeEach(() => {
    loadFixture("review-dialog");
  });

  test("the dialog selectors find the dialog", () => {
    expect(document.querySelectorAll(reviewDialog.join(",")).length).toBe(1);
  });

  test("the textarea selectors find both editors on the page", () => {
    // Deliberately broad -- these match every markdown editor, which is why
    // praiseContext() has to do the filtering.
    expect(document.querySelectorAll(markdownTextarea.join(",")).length).toBe(
      2,
    );
  });

  test("the dialog textarea is a review", () => {
    const textarea = document.querySelector<HTMLTextAreaElement>(
      '[role="dialog"] textarea',
    )!;
    expect(praiseContext(textarea)).toBe("reviews");
  });

  test("a textarea outside the dialog is left alone", () => {
    const textarea =
      document.querySelector<HTMLTextAreaElement>("#praise-decoy")!;
    expect(praiseContext(textarea)).toBeUndefined();
  });

  test("the insertion point is the row holding the dialog's Cancel", () => {
    const textarea = document.querySelector<HTMLTextAreaElement>(
      '[role="dialog"] textarea',
    )!;

    const insertionPoint = findInsertionPoint(textarea);

    expect(insertionPoint).toBeDefined();
    expect(label(insertionPoint!.before)).toBe("Cancel");
    // The row, not the flex column above it: inserting into the column is what
    // put the button below the textarea at full width.
    expect(insertionPoint!.row).toBe(insertionPoint!.before.parentElement);
    expect(label(insertionPoint!.row)).toContain("Submit review");
  });
});

describe("diff comment editor", () => {
  beforeEach(() => {
    loadFixture("diff-comment");
  });

  test("the editor selectors find both editors", () => {
    expect(document.querySelectorAll(diffCommentEditor.join(",")).length).toBe(
      2,
    );
  });

  test("a diff textarea is a comment", () => {
    const textarea = document.querySelector<HTMLTextAreaElement>(
      '[data-editor="1"] textarea',
    )!;
    expect(praiseContext(textarea)).toBe("comments");
  });

  test.each([["1"], ["2"]])(
    "editor %s anchors to its own Cancel, not its neighbour's",
    (editor) => {
      const container = document.querySelector<HTMLElement>(
        `[data-editor="${editor}"]`,
      )!;
      const textarea =
        container.querySelector<HTMLTextAreaElement>("textarea")!;

      const insertionPoint = findInsertionPoint(textarea);

      expect(insertionPoint).toBeDefined();
      expect(label(insertionPoint!.before)).toBe("Cancel");
      // The real regression risk: climbing out and taking the other editor's
      // button, or the diff toolbar's page-level "Submit review".
      expect(container.contains(insertionPoint!.before)).toBe(true);
    },
  );
});
