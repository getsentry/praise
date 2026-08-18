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

chrome.runtime.onInstalled.addListener(function () {
  console.log("installed");
  chrome.storage.sync.set({
    reviews: defaultReviews,
    comments: defaultComments,
  });
});
