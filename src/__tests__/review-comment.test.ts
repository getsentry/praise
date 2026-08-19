import { submitReviewComment } from '../lib/review-comment';

/** Skips the real frame wait. */
const immediately = (): Promise<void> => Promise.resolve();

function editor(buttons: string): HTMLTextAreaElement {
  document.body.innerHTML = `
    <div id="wrapper">
      <div class="AddCommentEditor-module__ConversationCommentBox__qxXdE">
        <textarea data-component="Textarea" placeholder="Leave a comment"></textarea>
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

function spyOnClicks(): string[] {
  const clicked: string[] = [];

  for (const button of document.querySelectorAll<HTMLButtonElement>('button')) {
    button.addEventListener('click', () => {
      clicked.push(button.textContent ?? '');
    });
  }

  return clicked;
}

describe('submitReviewComment', () => {
  it('starts a review when none is pending', async () => {
    const textarea = editor('<button>Add single comment</button><button>Start a review</button>');
    const clicks = spyOnClicks();

    await expect(submitReviewComment(textarea, immediately)).resolves.toBe(true);
    expect(clicks).toEqual(['Start a review']);
  });

  it('adds to the review already in progress', async () => {
    const textarea = editor('<button>Add single comment</button><button>Add review comment</button>');
    const clicks = spyOnClicks();

    await expect(submitReviewComment(textarea, immediately)).resolves.toBe(true);
    expect(clicks).toEqual(['Add review comment']);
  });

  it('posts nothing when only a single comment is on offer', async () => {
    const textarea = editor('<button>Add single comment</button>');
    const clicks = spyOnClicks();

    await expect(submitReviewComment(textarea, immediately)).resolves.toBe(false);
    expect(clicks).toEqual([]);
  });

  it('looks for the button only after the write has been rendered', async () => {
    const textarea = editor('<button data-inactive="true">Start a review</button>');
    const button = [...document.querySelectorAll('button')].find(each => each.textContent === 'Start a review')!;
    const clicks = spyOnClicks();
    const activate = (): Promise<void> => {
      button.removeAttribute('data-inactive');
      return Promise.resolve();
    };

    await expect(submitReviewComment(textarea, activate)).resolves.toBe(true);
    expect(clicks).toEqual(['Start a review']);
  });

  it('posts nothing when the button never becomes active', async () => {
    const textarea = editor('<button data-inactive="true">Start a review</button>');
    const clicks = spyOnClicks();

    await expect(submitReviewComment(textarea, immediately)).resolves.toBe(false);
    expect(clicks).toEqual([]);
  });

  it('posts nothing when the review button is disabled', async () => {
    const textarea = editor('<button disabled>Start a review</button>');
    const clicks = spyOnClicks();

    await expect(submitReviewComment(textarea, immediately)).resolves.toBe(false);
    expect(clicks).toEqual([]);
  });
});
