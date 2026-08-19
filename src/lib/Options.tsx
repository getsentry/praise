import React, { useEffect, useState } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import { useDebouncedStorageWrite } from './use-debounced-storage-write';

/** How long typing has to pause before the praises are written to storage. */
const SAVE_DELAY_MS = 500;

export const Options = () => {
  const [reviews, setReviews] = useState<string[]>();
  const [comments, setComments] = useState<string[]>();
  const save = useDebouncedStorageWrite(SAVE_DELAY_MS);

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

  function reviewsChanged(reviewText: string) {
    let reviews = split(reviewText);
    setReviews(reviews);
    save({ reviews: reviews });
  }

  function commentsChanged(commentText: string) {
    let comments = split(commentText);
    setComments(comments);
    save({ comments: comments });
  }

  function split(value: string): string[] {
    // `''.split(/\n/)` yields `['']`, which would store one empty praise for
    // an empty textarea. An empty box means no praises at all.
    if (value === '') return [];
    return value.split(/\n/);
  }

  return (
    <>
      <h2>Review Praises</h2>
      <TextareaAutosize
        minRows={4}
        onChange={event => {
          reviewsChanged(event.target.value);
        }}
        value={reviews?.join('\n')}
      />

      <h2>Comment Praises</h2>
      <TextareaAutosize
        minRows={4}
        onChange={event => {
          commentsChanged(event.target.value);
        }}
        value={comments?.join('\n')}
      />
    </>
  );
};
