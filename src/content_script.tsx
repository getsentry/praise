let commentPraises: [string];
let reviewPraises: [string];

loadPraises();
observeDOMChanges();

function loadPraises() {
  chrome.storage.sync.get(
    {
      reviews: [],
      comments: [],
    },
    (items) => {
      reviewPraises = items.reviews;
      commentPraises = items.comments;
    }
  );
}

function observeDOMChanges() {
  // When the users adds a PR comment we add the praise button
  let observer = new MutationObserver(function () {
    // To not end up in an endless loop
    observer.disconnect();

    setUpComments();
    setUpReview();

    observe();
  });

  observe();

  function observe() {
    observer.observe(document, {
      attributes: false,
      childList: true,
      subtree: true,
    });
  }
}

function setUpComments() {
  let gitHubFiles = document.getElementById("files");
  let textareas = gitHubFiles?.querySelectorAll("textarea") ?? [];
  for (let textarea of textareas) {
    textarea.parentElement
      ?.querySelectorAll(".sentry-pr-praise-button")
      .forEach((e) => e.remove());

    setUpPraiseButton(textarea, () => commentPraises);
  }
}

function setUpReview() {
  let reviewTextarea = document.getElementById(
    "pull_request_review_body"
  ) as HTMLTextAreaElement;

  if (reviewTextarea != null) {
    setUpPraiseButton(reviewTextarea, () => reviewPraises);
  }
}

function setUpPraiseButton(
  textarea: HTMLTextAreaElement,
  comments: { (): string[] }
) {
  let span = document.createElement("span");
  span.innerHTML = "PR";
  span.className = "sentry-pr-praise-button";

  textarea.parentElement?.append(span);
  toggleButton(textarea, span);
  span.addEventListener("click", function () {
    setPraise(textarea, comments());
  });
}

/**
 * Sets a random praise to the textarea.
 *
 * @param textarea The textarea to put the praise.
 * @param praises The praises to randomly pick.
 */
function setPraise(textarea: HTMLTextAreaElement, praises: string[]) {
  var newText = "";
  do {
    let rand = Math.floor(Math.random() * praises.length);
    newText = praises[rand];
  } while (textarea.value == newText); // to not have the same text twice

  // Github form validation logic needs the focus and input event
  textarea.focus();
  textarea.value = newText;
  textarea.dispatchEvent(
    new CustomEvent("input", { detail: { "sentry-ignore-input": true } })
  );
}

/**
 * Hide the button when the user enters manual text.
 *
 * @param textarea The textarea to put the praise.
 * @param button The button inside the textarea.
 */
function toggleButton(textarea: HTMLTextAreaElement, button: HTMLElement) {
  textarea.addEventListener("input", function (event) {
    if (event instanceof CustomEvent) {
      let e = event as CustomEvent;
      if (e.detail["sentry-ignore-input"]) {
        return;
      }
    }

    if (this.value.length > 0) {
      button.style.display = "none";
    } else {
      button.style.display = "block";
    }
  });
}
