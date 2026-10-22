<h1 align="center">CopyVersa</h1>

<p align="center">
  Copy any part of a web page as Markdown, clean text or rich text for Word, without dragging menus, styles or clutter along.
</p>

<p align="center"><a href="README.md">Español</a></p>

![CopyVersa highlights a table on a fictional court record and shows its format panel](docs/images/panel.png)

## Why

Copying from the web usually goes wrong. Pasting into Word brings colors, fonts and broken tables. Pasting into a text editor loses headings, lists and columns. And systems that show data inside form fields cannot be selected at all.

With CopyVersa, you point at a block of the page, click, and the content lands on your clipboard in the format you chose, with its structure intact.

## Features

- **Four formats:** Markdown (with GitHub tables), plain text, rich text for Word, Google Docs or email, and clean HTML.
- **Only what is visible:** hidden menus, scripts, styles, buttons and screen-reader-only text are left out.
- **Form values:** copies what fields, drop-downs and checkboxes show, read-only ones included.
- **Formatting kept:** bold, italics, underline and alignment applied through CSS become real formatting.
- **Complete tables:** any data table, with or without headers or merged cells. Plain text separates columns with tabs, ready for Excel.
- **Lettered lists:** keeps `a.`, `b.` or `i.`, `ii.` markers.
- **Source citation:** optionally adds the page title, address and access date.
- **Multiple selection:** collects blocks from different parts of the page and copies them together, in the order you chose them.
- **Robust:** works on pages with strict security policies and leaves the page and its styles untouched.

## Install

**Userscript (Chrome, Edge, Firefox, Safari):** install [Tampermonkey](https://www.tampermonkey.net/) or [Violentmonkey](https://violentmonkey.github.io/), then open [**copyversa.user.js**](https://github.com/oddradiocircle/Copyversa/releases/latest/download/copyversa.user.js). In Chrome and Edge, Tampermonkey needs **Allow user scripts** turned on in its extension details.

**Chrome or Edge extension:** download [**copyversa-extension.zip**](https://github.com/oddradiocircle/Copyversa/releases/latest/download/copyversa-extension.zip), unzip it, open `chrome://extensions`, turn on **Developer mode** and choose **Load unpacked**. The extension only reaches the tab where you activate it, when you activate it.

## Use

Press **Ctrl+Shift+X** (**Cmd+Shift+X** on Mac with the extension), move the mouse and click.

| Action          | Result                                            |
| --------------- | ------------------------------------------------- |
| Click           | Copy the highlighted block                        |
| Arrow up / down | Expand to the enclosing block, or go back         |
| Enter           | Copy the highlighted block, or all selected ones  |
| Shift + click   | Add or remove a block from the multiple selection |
| Esc             | Exit without copying                              |

If text is already selected when you press the shortcut, CopyVersa copies that selection right away.

## Privacy

CopyVersa sends nothing anywhere, has no analytics and loads no external code. See [PRIVACY.md](PRIVACY.md).

## Development

Requires Node.js 22 or later: `npm install`, `npm run build`, `npm test`, `npm run test:e2e`. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE) © Daniel Gómez-Padilla. Includes [Turndown](https://github.com/mixmark-io/turndown) (MIT).
