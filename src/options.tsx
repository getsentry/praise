import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import TextareaAutosize from "react-textarea-autosize";

const Options = () => {
  const [reviews, setReviews] = useState<string[]>();
  const [comments, setComments] = useState<string[]>();

  useEffect(() => {
    chrome.storage.sync.get(
      {
        reviews: [],
        comments: [],
      },
      (items: { reviews: string[]; comments: string[] }) => {
        setReviews(items.reviews);
        setComments(items.comments);
      },
    );
  }, []);

  function reviewsChanged(reviewText: string) {
    let reviews = split(reviewText);
    setReviews(reviews);
    chrome.storage.sync.set({ reviews: reviews });
  }

  function commentsChanged(commentText: string) {
    let comments = split(commentText);
    setComments(comments);
    chrome.storage.sync.set({ comments: comments });
  }

  function split(value: string): string[] {
    return value.split(/\n/);
  }

  return (
    <>
      <h2>Review Praises</h2>
      <TextareaAutosize
        className="textarea"
        onChange={(event) => {
          reviewsChanged(event.target.value);
        }}
        value={reviews?.join("\n")}
      />

      <h2>Comment Praises</h2>
      <TextareaAutosize
        className="textarea"
        onChange={(event) => {
          commentsChanged(event.target.value);
        }}
        value={comments?.join("\n")}
      />
    </>
  );
};

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Options />
  </React.StrictMode>,
);
