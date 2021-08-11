import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import TextareaAutosize from "react-textarea-autosize";

const Options = () => {
  const [reviews, setReviews] = useState<[string]>();
  const [comments, setComments] = useState<[string]>();

  useEffect(() => {
    chrome.storage.sync.get(
      {
        reviews: [],
        comments: [],
      },
      (items) => {
        setReviews(items.reviews);
        setComments(items.comments);
      }
    );
  }, []);
  
  function reviewsChanged(reviewText: string) {
    let reviews = split(reviewText)
    setReviews(reviews);
    chrome.storage.sync.set({ reviews: reviews } );
  }

  function commentsChanged(commentText: string) {
    let comments = split(commentText)
    setComments(comments)
    chrome.storage.sync.set({ comments: comments } );
  }

  function split(value: string): [string] {
    return value.split(/\n/) as [string];
  }

  return (
    <>
      <h2>Review Praises</h2>
      <TextareaAutosize
        className="textarea"
        onChange={(event) => {
          reviewsChanged(event.target.value)
        }}
        value={reviews?.join('\n')}
      />

      <h2>Comment Praises</h2>
      <TextareaAutosize
        className="textarea"
        onChange={(event) => {
          commentsChanged(event.target.value)
        }}
        value={comments?.join('\n')}
      />
    </>
  );
};

ReactDOM.render(
  <React.StrictMode>
    <Options />
  </React.StrictMode>,
  document.getElementById("root")
);
