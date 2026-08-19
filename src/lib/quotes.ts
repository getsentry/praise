// A curated, committed set rather than a user-editable list: the quotes have to
// be real and correctly attributed, and a few KB of static text has no business
// in chrome.storage.sync, whose per-item quota is 8 KB.

/**
 * One line each, no markdown and at most 100 characters: a quote goes straight
 * into the comment body, under the approval comment, and an approval reads as a
 * one-liner rather than a wall of text. See `quotes.test.ts`.
 */
export const APPROVE_QUOTES: string[] = [
  'Simplicity is prerequisite for reliability. — Edsger W. Dijkstra',
  'Simple things should be simple, complex things should be possible. — Alan Kay',
  'Controlling complexity is the essence of computer programming. — Brian Kernighan',
  'Talk is cheap. Show me the code. — Linus Torvalds',
  'Make it work, make it right, make it fast. — Kent Beck',
  'One of my most productive days was throwing away 1000 lines of code. — Ken Thompson',
  "Programming is not about typing, it's about thinking. — Rich Hickey",
  'Real artists ship. — Steve Jobs',
  'Software is a gas; it expands to fill its container. — Nathan Myhrvold',
  'Good code is its own best documentation. — Steve McConnell',
  'Everything should be built top-down, except the first time. — Alan Perlis',
  'The price of reliability is the pursuit of the utmost simplicity. — C.A.R. Hoare',
  'Do the simplest thing that could possibly work. — Ward Cunningham',
  'The function of good software is to make the complex appear to be simple. — Grady Booch',
  'Any sufficiently advanced technology is indistinguishable from magic. — Arthur C. Clarke',
  'Less is more. — Ludwig Mies van der Rohe',
  'Form follows function. — Louis Sullivan',
  'Truth can only be found in one place: the code. — Robert C. Martin',
  'The best code is no code at all. — Jeff Atwood',
  'Simplicity is about subtracting the obvious and adding the meaningful. — John Maeda',
  'Clear is better than clever. — Rob Pike',
  'Beautiful is better than ugly. Explicit is better than implicit. — Tim Peters',
  'Perfect is the enemy of good. — Voltaire',
  'If I have seen further it is by standing on the shoulders of giants. — Isaac Newton',
  'Alone we can do so little; together we can do so much. — Helen Keller',
  'Beauty of style and harmony and grace and good rhythm depend on simplicity. — Plato',
  "Elegance is not optional. — Richard O'Keefe",
  'Programming is a skill best acquired by practice and example rather than from books. — Alan Turing',
  'Make each program do one thing well. — Doug McIlroy',
  "The cheapest, fastest, and most reliable components are those that aren't there. — Gordon Bell",
  'Talent wins games, but teamwork wins championships. — Michael Jordan',
  'The details are not the details. They make the design. — Charles Eames',
];
