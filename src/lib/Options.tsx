import React, { useEffect, useState } from 'react';
import { GifList } from './GifList';
import { PraiseList } from './PraiseList';
import { PraiseText } from './PraiseText';

type Stored = {
  approveComment: string;
  comments: string[];
  approveGifs: string[];
  approveGifsEnabled: boolean;
  approveQuotesEnabled: boolean;
};

export const Options = () => {
  const [approveComment, setApproveComment] = useState('');
  const [comments, setComments] = useState<string[]>([]);
  const [approveGifs, setApproveGifs] = useState<string[]>([]);
  // Matches the seeding default, so the checkbox does not flicker off before
  // storage answers.
  const [gifsEnabled, setGifsEnabled] = useState(true);
  const [quotesEnabled, setQuotesEnabled] = useState(false);

  useEffect(() => {
    chrome.storage.sync.get<Stored>(
      {
        approveComment: '',
        comments: [],
        approveGifs: [],
        approveGifsEnabled: true,
        approveQuotesEnabled: false,
      },
      items => {
        setApproveComment(items.approveComment);
        setComments(items.comments);
        setApproveGifs(items.approveGifs);
        setGifsEnabled(items.approveGifsEnabled);
        setQuotesEnabled(items.approveQuotesEnabled);
      },
    );
  }, []);

  function approveCommentChanged(next: string) {
    setApproveComment(next);
    void chrome.storage.sync.set({ approveComment: next });
  }

  function commentsChanged(next: string[]) {
    setComments(next);
    void chrome.storage.sync.set({ comments: next });
  }

  function approveGifsChanged(next: string[]) {
    setApproveGifs(next);
    void chrome.storage.sync.set({ approveGifs: next });
  }

  function gifsEnabledChanged(next: boolean) {
    setGifsEnabled(next);
    void chrome.storage.sync.set({ approveGifsEnabled: next });
  }

  function quotesEnabledChanged(next: boolean) {
    setQuotesEnabled(next);
    void chrome.storage.sync.set({ approveQuotesEnabled: next });
  }

  return (
    <>
      <PraiseText
        heading="PR Approval"
        label="PR Approval Comment"
        value={approveComment}
        onChange={approveCommentChanged}
      />
      {/* Nested under PR Approval: a quote sits under the approval comment. */}
      <section className="praise-list setting-section">
        <h3>Quotes</h3>
        <label className="setting-toggle">
          <input
            type="checkbox"
            role="switch"
            checked={quotesEnabled}
            onChange={event => {
              quotesEnabledChanged(event.target.checked);
            }}
          />
          Add a random quote below your PR Approval Comment
        </label>
      </section>
      {/* Nested under PR Approval: gifs only ever accompany a review. */}
      <section className="praise-list setting-section">
        <h3>GIFs</h3>
        <label className="setting-toggle">
          <input
            type="checkbox"
            role="switch"
            checked={gifsEnabled}
            onChange={event => {
              gifsEnabledChanged(event.target.checked);
            }}
          />
          Add a GIF to your PR Approval Comment
        </label>
        {/*
         * The list stays editable with the toggle off. Hiding or disabling it
         * would read as "your GIFs are gone" rather than "paused", and the
         * content script already treats off the same as an empty list.
         */}
        <GifList label="GIFs" items={approveGifs} onChange={approveGifsChanged} hideHeading />
      </section>
      <PraiseList label="Praising PR Review Comments" items={comments} onChange={commentsChanged} />
    </>
  );
};
