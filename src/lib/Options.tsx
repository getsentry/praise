import React, { useEffect, useState } from 'react';
import { PraiseList } from './PraiseList';

export const Options = () => {
  const [reviews, setReviews] = useState<string[]>([]);
  const [comments, setComments] = useState<string[]>([]);

  useEffect(() => {
    chrome.storage.sync.get<{ reviews: string[]; comments: string[] }>(
      {
        reviews: [],
        comments: [],
      },
      items => {
        setReviews(items.reviews);
        setComments(items.comments);
      },
    );
  }, []);

  function reviewsChanged(next: string[]) {
    setReviews(next);
    void chrome.storage.sync.set({ reviews: next });
  }

  function commentsChanged(next: string[]) {
    setComments(next);
    void chrome.storage.sync.set({ comments: next });
  }

  return (
    <>
      <PraiseList label="Review Praises" items={reviews} onChange={reviewsChanged} />
      <PraiseList label="Comment Praises" items={comments} onChange={commentsChanged} />
    </>
  );
};
