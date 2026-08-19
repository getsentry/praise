import { submitApproval } from '../lib/approve';

/** Runs the awaited gap immediately, so the tests do not wait on real frames. */
const immediately = (): Promise<void> => Promise.resolve();

function dialog(options: { approvable?: boolean; submittable?: boolean } = {}): HTMLTextAreaElement {
  const { approvable = true, submittable = true } = options;

  document.body.innerHTML = `
    <div role="dialog" aria-modal="true">
      <textarea data-component="Textarea"></textarea>
      <label><input type="radio" name="event" value="comment"> Comment</label>
      <label><input type="radio" name="event" value="approve" ${approvable ? '' : 'disabled'}> Approve</label>
      <button>Cancel</button>
      <button ${submittable ? '' : 'disabled'}>Submit review</button>
    </div>
  `;

  return document.querySelector('textarea')!;
}

function spyOnClicks(): string[] {
  const order: string[] = [];

  for (const element of document.querySelectorAll<HTMLElement>('input, button')) {
    const name = element.tagName === 'INPUT' ? `radio:${(element as HTMLInputElement).value}` : element.textContent;
    element.addEventListener('click', () => {
      order.push(name ?? '');
    });
  }

  return order;
}

describe('submitApproval', () => {
  it('selects Approve and then submits', async () => {
    const textarea = dialog();
    const clicks = spyOnClicks();

    await expect(submitApproval(textarea, immediately)).resolves.toBe(true);

    expect(clicks).toEqual(['radio:approve', 'Submit review']);
  });

  /** Approving your own PR. Submitting anyway would post a comment, not an approval. */
  it('submits nothing when the approve radio is disabled', async () => {
    const textarea = dialog({ approvable: false });
    const clicks = spyOnClicks();

    await expect(submitApproval(textarea, immediately)).resolves.toBe(false);

    expect(clicks).toEqual([]);
  });

  it('submits nothing when there is no approve radio at all', async () => {
    document.body.innerHTML = `
      <div role="dialog" aria-modal="true">
        <textarea data-component="Textarea"></textarea>
        <button>Submit review</button>
      </div>
    `;
    const textarea = document.querySelector('textarea')!;
    const clicks = spyOnClicks();

    await expect(submitApproval(textarea, immediately)).resolves.toBe(false);

    expect(clicks).toEqual([]);
  });

  it('leaves the verdict selected when Submit review cannot be pressed', async () => {
    const textarea = dialog({ submittable: false });
    const clicks = spyOnClicks();

    await expect(submitApproval(textarea, immediately)).resolves.toBe(false);

    expect(clicks).toEqual(['radio:approve']);
  });

  /** The footer is re-rendered by the verdict change, so it can only be read after it. */
  it('looks for Submit review only after the verdict is chosen', async () => {
    const textarea = dialog({ submittable: false });
    const submit = [...document.querySelectorAll('button')].find(button => button.textContent === 'Submit review')!;
    document.querySelector<HTMLInputElement>('input[value="approve"]')!.addEventListener('click', () => {
      submit.disabled = false;
    });
    const clicks = spyOnClicks();

    await expect(submitApproval(textarea, immediately)).resolves.toBe(true);

    expect(clicks).toEqual(['radio:approve', 'Submit review']);
  });
});
