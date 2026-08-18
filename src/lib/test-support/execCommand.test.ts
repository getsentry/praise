import { setFieldText } from "text-field-edit";
import { installExecCommand } from "./execCommand";

/**
 * `setFieldText` is how we write into React-controlled textareas, so if the stub
 * is wrong every placement test fails for an unrelated-looking reason.
 */
test("setFieldText replaces the value and fires input, repeatably", () => {
  installExecCommand();

  const textarea = document.createElement("textarea");
  document.body.append(textarea);

  let inputEvents = 0;
  textarea.addEventListener("input", () => {
    inputEvents++;
  });

  textarea.focus();
  setFieldText(textarea, "Nice work!");
  expect(textarea.value).toBe("Nice work!");
  expect(inputEvents).toBe(1);

  // Clicking the button a second time must replace, not append.
  setFieldText(textarea, "Great catch!");
  expect(textarea.value).toBe("Great catch!");
  expect(inputEvents).toBe(2);
});

/**
 * `setFieldText(field, "")` routes through `execCommand("delete")`, not
 * `insertText` -- a real code path in text-field-edit even though nothing in
 * this suite exercises it via `setPraise` yet.
 */
test("setFieldText with an empty string clears a non-empty field", () => {
  installExecCommand();

  const textarea = document.createElement("textarea");
  textarea.value = "Nice work!";
  document.body.append(textarea);

  let inputEvents = 0;
  textarea.addEventListener("input", () => {
    inputEvents++;
  });

  textarea.focus();
  setFieldText(textarea, "");
  expect(textarea.value).toBe("");
  expect(inputEvents).toBe(1);
});
