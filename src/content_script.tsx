let praises: [string];
let prReviews: [string];

chrome.storage.sync.get(
  {
    reviews: [],
    comments: [],
  },
  (items) => {
    prReviews = items.reviews;
    praises = items.comments;
  }
);

let observer = new MutationObserver(function () {
  addComment();
});

function observe() {
  let gitHubFiles = document.getElementById("files");
  if (gitHubFiles != null) {
    observer.observe(gitHubFiles, {
      attributes: false,
      childList: true,
      subtree: true,
    });
  }
}

observe();

function addComment() {
  observer.disconnect();

  let gitHubFiles = document.getElementById("files");
  let textareas = gitHubFiles?.querySelectorAll("textarea") ?? []
  for (let textarea of textareas) {
    textarea.parentElement
      ?.querySelectorAll(".sentry-pr-praise-button")
      .forEach((e) => e.remove());

    let span = document.createElement("span");
    span.innerHTML = "Give Praise";
    span.className = "sentry-pr-praise-button";

    textarea.parentElement?.append(span);

    toggleButton(textarea, span);

    span.addEventListener("click", function () {
      setText(textarea, praises);
    });
  }
  observe();
}

let reviewTextarea = document.getElementById(
  "pull_request_review_body"
) as HTMLTextAreaElement;

if (reviewTextarea != null) {
  let span = document.createElement("span");
  span.innerHTML = "Random Approval";
  span.className = "sentry-pr-praise-button";

  reviewTextarea.parentElement?.append(span);

  toggleButton(reviewTextarea, span);

  span.addEventListener("click", function () {
    setText(reviewTextarea, prReviews);
  });
}

function setText(textarea: HTMLTextAreaElement, comments: string[]) {
  var newText = "";
  do {
    let rand = Math.floor(Math.random() * comments.length);
    newText = comments[rand];
  } while (textarea.value == newText); // to not have the same text twice

  textarea.value = newText;

  textarea.dispatchEvent(new ClipboardEvent("paste"));
}

function toggleButton(textarea: HTMLTextAreaElement, span: HTMLElement) {
  textarea.addEventListener("input", function () {
    if (this.value.length > 0) {
      span.style.display = "none";
    } else {
      span.style.display = "block";
    }
  });
}
