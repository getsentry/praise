import { findInsertionPoint, praiseContext } from '../lib/selectors';

/**
 * Markup captured from a live PR page. The inline editor keeps Cancel in a
 * footer that is a *sibling* of the AddCommentEditor box, so the two only meet
 * one level above it.
 */
function inlineDiffEditor(): HTMLTextAreaElement {
  document.body.innerHTML = `
    <div id="wrapper">
      <div class="AddCommentEditor-module__ConversationCommentBox__qxXdE">
        <div class="MarkdownInput-module__inputWrapper__vOI3M">
          <textarea data-component="Textarea" placeholder="Leave a comment"></textarea>
        </div>
        <button>Write</button>
        <button>Preview</button>
      </div>
      <div class="Footer-module__footer__asFN1">
        <div class="Footer-module__childrenStyling__XjmP5">
          <button>Cancel</button>
          <button>Comment</button>
        </div>
      </div>
    </div>
  `;

  return document.querySelector('textarea')!;
}

/** The review dialog, where the footer sits inside the dialog itself. */
function reviewDialog(): HTMLTextAreaElement {
  document.body.innerHTML = `
    <div role="dialog" aria-modal="true">
      <div class="Dialog-module__body">
        <textarea data-component="Textarea" placeholder="Leave a comment"></textarea>
      </div>
      <div class="Dialog-module__footer">
        <button>Cancel</button>
        <button>Submit review</button>
      </div>
    </div>
  `;

  return document.querySelector('textarea')!;
}

describe('findInsertionPoint', () => {
  it('finds Cancel in the inline editor footer', () => {
    const textarea = inlineDiffEditor();

    expect(praiseContext(textarea)).toBe('comments');

    const point = findInsertionPoint(textarea);

    expect(point).toBeDefined();
    expect(point!.before.textContent).toBe('Cancel');
    expect(point!.row.contains(point!.before)).toBe(true);
  });

  it('finds Cancel in the review dialog', () => {
    const textarea = reviewDialog();

    expect(praiseContext(textarea)).toBe('reviews');
    expect(findInsertionPoint(textarea)!.before.textContent).toBe('Cancel');
  });

  it('ignores an editor that has no Cancel', () => {
    document.body.innerHTML = `
      <div class="AddCommentEditor-module__Box">
        <textarea data-component="Textarea"></textarea>
        <button>Comment</button>
      </div>
    `;

    expect(findInsertionPoint(document.querySelector('textarea')!)).toBeUndefined();
  });

  it('does not climb out to an unrelated Cancel on the page', () => {
    document.body.innerHTML = `
      <div id="page">
        <div class="Toolbar"><button>Cancel</button></div>
        <div id="files">
          <div>
            <div class="AddCommentEditor-module__Box">
              <textarea data-component="Textarea"></textarea>
            </div>
          </div>
        </div>
      </div>
    `;

    expect(findInsertionPoint(document.querySelector('textarea')!)).toBeUndefined();
  });

  it('does not take a neighbouring editor’s Cancel', () => {
    document.body.innerHTML = `
      <div id="files">
        <div class="AddCommentEditor-module__Box"><textarea data-component="Textarea"></textarea></div>
        <div><div class="AddCommentEditor-module__Box"><textarea id="other"></textarea></div>
          <div class="Footer-module__footer"><button>Cancel</button></div>
        </div>
      </div>
    `;

    expect(findInsertionPoint(document.querySelector('textarea')!)).toBeUndefined();
  });
});
