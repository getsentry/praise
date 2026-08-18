/**
 * Gives jsdom just enough `execCommand` for `text-field-edit` to work.
 *
 * jsdom implements no `execCommand` at all, so `setFieldText` throws before it
 * writes anything. We only need `insertText`, and only over the current
 * selection: `setRangeText` plus a bubbling `input` event is what a real browser
 * does, and it is what React's own change tracking listens for.
 */
export function installExecCommand(): void {
  // Deprecated by the platform, but `text-field-edit` calls it deliberately --
  // it is the only way to write into a React-controlled field and still fire a
  // trusted `input` event. Emulating it is the point of this helper.
  // oxlint-disable-next-line typescript/no-deprecated
  document.execCommand = (command: string, _showUi?: boolean, value?: string): boolean => {
    if (command === 'delete') {
      // `setFieldText(field, "")` doesn't call insertText -- text-field-edit
      // routes an empty replacement through execCommand("delete") instead.
      // No test in this suite reaches it yet (setPraise short-circuits on an
      // empty praise list), but leaving it unhandled would silently no-op on
      // a real code path the next test writer might hit.
      const element = document.activeElement;
      if (!(element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement)) {
        return false;
      }

      const start = element.selectionStart ?? 0;
      const end = element.selectionEnd ?? element.value.length;
      element.setRangeText('', start, end, 'end');
      element.dispatchEvent(
        new InputEvent('input', {
          bubbles: true,
          inputType: 'deleteContentBackward',
        }),
      );

      return true;
    }

    if (command !== 'insertText') {
      return false;
    }

    const element = document.activeElement;
    if (!(element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement)) {
      return false;
    }

    const start = element.selectionStart ?? element.value.length;
    const end = element.selectionEnd ?? element.value.length;
    element.setRangeText(value ?? '', start, end, 'end');
    element.dispatchEvent(
      new InputEvent('input', {
        bubbles: true,
        inputType: 'insertText',
        data: value ?? '',
      }),
    );

    return true;
  };
}
