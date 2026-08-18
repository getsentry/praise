let defaultReviews = ["LGTM 🚀", "Ship it 🚢", "RSLGTM 🏆", "Good job 👏"];

let defaultComments = [
  "This is awesome 👏 ",
  "Thanks for improving this 🚢:",
  "I like this a lot 🚀",
  "You deserve a 🥇",
  "Best change ever 💯",
  "🏆 Developer of the year 🏆",
  "This code makes my day ☀️",
  "You rock 🎸. Thanks.",
  "🌮  to you!",
  "Oh yeah 💪",
];

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason !== chrome.runtime.OnInstalledReason.INSTALL) {
    return;
  }

  chrome.storage.sync.get(["reviews", "comments"], (items) => {
    const seed: { reviews?: string[]; comments?: string[] } = {};

    if (!Array.isArray(items.reviews) || items.reviews.length === 0) {
      seed.reviews = defaultReviews;
    }
    if (!Array.isArray(items.comments) || items.comments.length === 0) {
      seed.comments = defaultComments;
    }

    if (Object.keys(seed).length > 0) {
      chrome.storage.sync.set(seed);
    }
  });
});
