import {
  findApproveRadio,
  findInsertionPoint,
  findReviewCommentButton,
  findSubmitReviewButton,
  praiseContext,
} from '../lib/selectors';

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

/** The dialog with its verdict radios. */
function reviewDialogWithVerdicts(options: { approvable?: boolean } = {}): HTMLTextAreaElement {
  const approve = options.approvable ?? true;

  document.body.innerHTML = `
    <div role="dialog" aria-modal="true">
      <div class="Dialog-module__body">
        <textarea data-component="Textarea" placeholder="Leave a comment"></textarea>
        <label><input type="radio" name="event" value="comment"> Comment</label>
        ${
          approve
            ? '<label><input type="radio" name="event" value="approve"> Approve</label>'
            : '<label><input type="radio" name="event" value="approve" disabled> Approve</label>'
        }
        <label><input type="radio" name="event" value="request_changes"> Request changes</label>
      </div>
      <div class="Dialog-module__footer">
        <button>Cancel</button>
        <button>Submit review</button>
      </div>
    </div>
  `;

  return document.querySelector('textarea')!;
}

describe('findApproveRadio', () => {
  it('finds the approve radio by value', () => {
    const radio = findApproveRadio(reviewDialogWithVerdicts());

    expect(radio?.value).toBe('approve');
  });

  it('finds it by its label when the value is not the giveaway', () => {
    document.body.innerHTML = `
      <div role="dialog" aria-modal="true">
        <textarea data-component="Textarea"></textarea>
        <label><input type="radio" name="event" id="a"> Comment</label>
        <label><input type="radio" name="event" id="b"> Approve</label>
      </div>
    `;

    expect(findApproveRadio(document.querySelector('textarea')!)?.id).toBe('b');
  });

  /** Approving your own PR: GitHub renders the radio but disables it. */
  it('ignores a disabled approve radio', () => {
    expect(findApproveRadio(reviewDialogWithVerdicts({ approvable: false }))).toBeUndefined();
  });

  it('finds nothing outside the review dialog', () => {
    document.body.innerHTML = `
      <div class="AddCommentEditor-module__Box"><textarea data-component="Textarea"></textarea></div>
      <label><input type="radio" value="approve"> Approve</label>
    `;

    expect(findApproveRadio(document.querySelector('textarea')!)).toBeUndefined();
  });
});

describe('findSubmitReviewButton', () => {
  it('finds Submit review in the dialog footer', () => {
    expect(findSubmitReviewButton(reviewDialogWithVerdicts())?.textContent).toBe('Submit review');
  });

  it('ignores a disabled Submit review', () => {
    const textarea = reviewDialogWithVerdicts();
    document.querySelectorAll('button').forEach(button => {
      button.disabled = true;
    });

    expect(findSubmitReviewButton(textarea)).toBeUndefined();
  });

  it('finds nothing outside the review dialog', () => {
    document.body.innerHTML = `
      <div class="AddCommentEditor-module__Box"><textarea data-component="Textarea"></textarea></div>
      <button>Submit review</button>
    `;

    expect(findSubmitReviewButton(document.querySelector('textarea')!)).toBeUndefined();
  });
});

/**
 * What a live dialog served, captured with `npm run probe` and trimmed. Keeps
 * the details a hand-written fixture gets wrong: `value="approve"`, and a
 * Submit caption carrying its keyboard shortcut.
 */
function capturedReviewDialog(): HTMLTextAreaElement {
  document.body.innerHTML = `
    <div role="dialog" data-component="AnchoredOverlay" aria-modal="true">
      <textarea class="MarkdownInput-module__textArea__jjK6q"></textarea>
      <input aria-checked="true" data-component="Radio" type="radio" value="comment" checked name="reviewEvent">
      <input aria-checked="false" data-component="Radio" type="radio" value="approve" name="reviewEvent">
      <input aria-checked="false" data-component="Radio" type="radio" value="request changes" name="reviewEvent">
      <button data-component="Button" type="button" class="sentry-pr-praise-button">Approve</button>
      <button data-component="Button" type="button" data-variant="default">Cancel</button>
      <button data-component="Button" type="button" class="ReviewMenuFooter-module__SubmitReviewButton__KIlAr" data-variant="primary">
        Submit review<span>command</span><span>⌘</span><span>enter</span><span>⏎</span>
      </button>
    </div>
  `;

  return document.querySelector('textarea')!;
}

describe('the dialog as GitHub actually serves it', () => {
  it("finds the approve radio by GitHub's own value", () => {
    expect(findApproveRadio(capturedReviewDialog())?.value).toBe('approve');
  });

  /** An equality match would miss it. */
  it('finds Submit review despite the shortcut trailing its caption', () => {
    expect(findSubmitReviewButton(capturedReviewDialog())).toBeDefined();
  });

  /** Our own button is captioned "Approve" too. */
  it('does not mistake our own button for the verdict', () => {
    expect(findApproveRadio(capturedReviewDialog())?.tagName).toBe('INPUT');
  });

  /** How it arrives on your own PR: rendered, but not usable. */
  it('finds nothing when GitHub has disabled approving', () => {
    const textarea = capturedReviewDialog();
    document.querySelectorAll('input, button').forEach(element => {
      (element as HTMLInputElement).disabled = true;
    });

    expect(findApproveRadio(textarea)).toBeUndefined();
    expect(findSubmitReviewButton(textarea)).toBeUndefined();
  });
});

/** The inline editor's footer, with whichever submit buttons GitHub offers. */
function inlineEditorFooter(buttons: string): HTMLTextAreaElement {
  document.body.innerHTML = `
    <div id="wrapper">
      <div class="AddCommentEditor-module__ConversationCommentBox__qxXdE">
        <div class="MarkdownInput-module__inputWrapper__vOI3M">
          <textarea data-component="Textarea" placeholder="Leave a comment"></textarea>
        </div>
      </div>
      <div class="Footer-module__footer__asFN1">
        <div class="Footer-module__childrenStyling__XjmP5">
          <button>Cancel</button>
          ${buttons}
        </div>
      </div>
    </div>
  `;

  return document.querySelector('textarea')!;
}

describe('findReviewCommentButton', () => {
  it('finds Start a review when no review is pending', () => {
    const textarea = inlineEditorFooter('<button>Add single comment</button><button>Start a review</button>');

    expect(findReviewCommentButton(textarea)?.textContent).toBe('Start a review');
  });

  it('finds Add review comment when a review is already in progress', () => {
    const textarea = inlineEditorFooter('<button>Add single comment</button><button>Add review comment</button>');

    expect(findReviewCommentButton(textarea)?.textContent).toBe('Add review comment');
  });

  it('finds nothing when only a single comment is on offer', () => {
    const textarea = inlineEditorFooter('<button>Add single comment</button>');

    expect(findReviewCommentButton(textarea)).toBeUndefined();
  });

  it('does not mistake a plain Comment button for a review comment', () => {
    const textarea = inlineEditorFooter('<button>Comment</button>');

    expect(findReviewCommentButton(textarea)).toBeUndefined();
  });

  it('ignores a disabled review button', () => {
    const textarea = inlineEditorFooter('<button disabled>Start a review</button>');

    expect(findReviewCommentButton(textarea)).toBeUndefined();
  });

  it('ignores a review button Primer has marked inactive', () => {
    const textarea = inlineEditorFooter('<button data-inactive="true">Start a review</button>');

    expect(findReviewCommentButton(textarea)).toBeUndefined();
  });

  it('finds a review button nested in its loading wrapper', () => {
    const textarea = inlineEditorFooter(
      '<div data-loading-wrapper="true"><button>Comment</button></div>' +
        '<div data-loading-wrapper="true"><button>Start a review</button></div>',
    );

    expect(findReviewCommentButton(textarea)?.textContent).toBe('Start a review');
  });

  it('finds nothing in the review dialog', () => {
    expect(findReviewCommentButton(reviewDialogWithVerdicts())).toBeUndefined();
  });

  it('does not reach a neighbouring editor’s Start a review', () => {
    document.body.innerHTML = `
      <div id="files">
        <div class="AddCommentEditor-module__Box"><textarea data-component="Textarea"></textarea></div>
        <div><div class="AddCommentEditor-module__Box"><textarea id="other"></textarea></div>
          <div class="Footer-module__footer"><button>Cancel</button><button>Start a review</button></div>
        </div>
      </div>
    `;

    expect(findReviewCommentButton(document.querySelector('textarea')!)).toBeUndefined();
  });
});

/** Captured with `npm run probe -- diff-comment` and trimmed. */
function capturedDiffEditor(inactive: boolean): HTMLTextAreaElement {
  const mark = inactive ? 'data-inactive="true"' : '';

  document.body.innerHTML = `
    <div id="wrapper">
      <div class="AddCommentEditor-module__ConversationCommentBox__qxXdE">
        <textarea class="MarkdownInput-module__textArea__jjK6q" data-component="Textarea"></textarea>
      </div>
      <div class="Footer-module__footer__asFN1">
        <div class="Footer-module__childrenStyling__XjmP5">
          <button data-component="Button" type="button" class="prc-Button-ButtonBase-9n-Xk sentry-pr-praise-button">
            <span data-component="text">Praise</span>
          </button>
          <button data-component="Button" type="button" data-variant="default">
            <span data-component="text">Cancel</span>
          </button>
          <div data-loading-wrapper="true">
            <button data-component="Button" type="button" ${mark} data-variant="default">
              <span data-component="text">Comment</span>
            </button>
          </div>
          <div data-loading-wrapper="true">
            <button data-component="Button" type="button" ${mark} data-variant="primary">
              <span data-component="text">Start a review</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  return document.querySelector('textarea')!;
}

describe('the inline editor as GitHub actually serves it', () => {
  it('finds Start a review once the editor has content', () => {
    expect(findReviewCommentButton(capturedDiffEditor(false))?.textContent?.trim()).toBe('Start a review');
  });

  it('never returns the plain Comment button', () => {
    expect(findReviewCommentButton(capturedDiffEditor(false))?.dataset.variant).toBe('primary');
  });

  it('finds nothing while both submit buttons are inactive', () => {
    expect(findReviewCommentButton(capturedDiffEditor(true))).toBeUndefined();
  });

  it('does not return our own Praise button', () => {
    expect(findReviewCommentButton(capturedDiffEditor(false))?.classList.contains('sentry-pr-praise-button')).toBe(
      false,
    );
  });
});
