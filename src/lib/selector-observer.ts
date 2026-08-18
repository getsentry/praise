/**
 * Observes elements matching a selector, including ones added later.
 *
 * Instead of a MutationObserver, this registers a no-op CSS animation on the
 * selector and listens for `animationstart`. The browser's style engine does the
 * matching, so it costs nothing while idle and fires exactly once per element --
 * which matters on GitHub's PR pages, where React re-renders constantly and the
 * virtualized diff mounts and unmounts comment editors as you scroll.
 *
 * Marking each element with a `seen` class also removes it from the rule's match
 * set, so our own DOM changes can never re-trigger the listener.
 *
 * JSX-free port of refined-github's `source/helpers/selector-observer.tsx`.
 * https://github.com/refined-github/refined-github/blob/main/source/helpers/selector-observer.tsx
 */

const animationName = "praise-selector-observer";

let animationRegistered = false;

function registerAnimation(): void {
  if (animationRegistered) {
    return;
  }
  animationRegistered = true;

  const style = document.createElement("style");
  style.textContent = `@keyframes ${animationName} {}`;
  document.head.append(style);
}

let observerCount = 0;

export type ObserverOptions = {
  signal?: AbortSignal;
  /** Stop observing after the first matching element. */
  once?: boolean;
};

export default function observe(
  selectors: string | readonly string[],
  listener: (element: HTMLElement) => void,
  { signal, once }: ObserverOptions = {},
): void {
  if (signal?.aborted) {
    return;
  }

  const selector = Array.isArray(selectors)
    ? selectors.join(",\n")
    : (selectors as string);

  registerAnimation();

  // Unique per observer so two observers watching overlapping selectors don't
  // consume each other's elements.
  const seenMark = `praise-seen-${observerCount++}`;

  const rule = document.createElement("style");
  // `:where` keeps specificity at zero so we never affect GitHub's own styling.
  rule.textContent = `
    :where(${selector}):not(.${seenMark}) {
      animation: 1ms ${animationName};
    }
  `;
  document.body.append(rule);
  signal?.addEventListener("abort", () => {
    rule.remove();
  });

  const controller = once ? new AbortController() : undefined;
  const listenerSignal = controller
    ? signal
      ? AbortSignal.any([signal, controller.signal])
      : controller.signal
    : signal;

  globalThis.addEventListener(
    "animationstart",
    (event: AnimationEvent) => {
      if (event.animationName !== animationName) {
        return;
      }

      const target = event.target as HTMLElement;

      // The animation can also start on a ::before pseudo-element of a
      // non-matching element, so re-check explicitly.
      if (
        !(target instanceof HTMLElement) ||
        target.classList.contains(seenMark) ||
        !target.matches(selector)
      ) {
        return;
      }

      target.classList.add(seenMark);
      listener(target);
      controller?.abort();
    },
    { signal: listenerSignal },
  );
}
