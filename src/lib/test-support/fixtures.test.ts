import { loadFixture } from "./fixtures";

test("review-dialog fixture has a dialog containing a textarea and Cancel", () => {
  loadFixture("review-dialog");

  const dialog = document.querySelector('[role="dialog"]');
  expect(dialog).not.toBeNull();
  expect(dialog!.querySelector("textarea")).not.toBeNull();
  expect(
    [...dialog!.querySelectorAll("button")].map((button) =>
      button.textContent?.trim(),
    ),
  ).toContain("Cancel");
});

test("diff-comment fixture has an editor containing a textarea and Cancel", () => {
  loadFixture("diff-comment");

  const editor = document.querySelector('div[class*="AddCommentEditor"]');
  expect(editor).not.toBeNull();
  expect(editor!.querySelector("textarea")).not.toBeNull();
  expect(
    [...editor!.querySelectorAll("button")].map((button) =>
      button.textContent?.trim(),
    ),
  ).toContain("Cancel");
});
