# PRaise

Chrome extension for praising GitHub pull requests in one click. It adds an
Approve button to the review dialog, which fills in your approval comment with a
random GIF and submits the review, and a Praise button to inline diff comments,
which drops in a random thank you. Both texts and the GIF list are editable on
the options page.

## Installation

To use the alpha version please follow the following steps. This extension uses Manifest V3 and requires Chrome 88 or newer.

### Download the prebuilt extension

1. Go to the [Actions tab](https://github.com/getsentry/praise/actions) of this repo.
2. Open the latest successful `Build` run on `main`.
3. Download the `praise-extension` artifact and unzip it.
4. Open `chrome://extensions`
5. Enable Developer Mode on the top right
6. Click on "Load unpacked"
7. Select the unzipped folder. `manifest.json` is at the top level of it, so pick that folder itself and not a subfolder.
8. Happy praising 👏

Two things to know about the artifact:

- You need to be signed in to GitHub to download it. Anonymous downloads of workflow artifacts are not possible.
- Artifacts expire after 90 days. If the run you are looking at is older than that, use a more recent one or build from source.

### Build from source

1. Clone this repo.
2. `npm install`
3. `npm run build`
4. Open Chrome -> Manage Extensions
5. Enable Developer Mode on the top right
6. Click on "Load unpacked"
7. Select the `dist` of this project folder.
8. Happy praising 👏
