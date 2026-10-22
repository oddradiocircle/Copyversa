// Builds the userscript and the browser extension into dist/.
//   node scripts/build.mjs          one build
//   node scripts/build.mjs --watch  rebuild on every change
import { context } from 'esbuild';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';

const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const watch = process.argv.includes('--watch');
const repo = 'https://github.com/oddradiocircle/Copyversa';
const latest = `${repo}/releases/latest/download`;

const metadata = `// ==UserScript==
// @name           CopyVersa
// @namespace      ${repo}
// @version        ${pkg.version}
// @description    ${pkg.description}
// @description:en Copy web content as Markdown, plain text or rich text, keeping its structure.
// @author         ${pkg.author}
// @license        ${pkg.license}
// @icon           https://raw.githubusercontent.com/oddradiocircle/Copyversa/main/assets/icon.svg
// @homepageURL    ${repo}
// @supportURL     ${repo}/issues
// @updateURL      ${latest}/copyversa.meta.js
// @downloadURL    ${latest}/copyversa.user.js
// @match          *://*/*
// @grant          GM_getValue
// @grant          GM_setValue
// @grant          GM_setClipboard
// @grant          GM_registerMenuCommand
// @run-at         document-idle
// ==/UserScript==
`;

// Turndown is bundled, so its MIT notice travels with the code.
const turndownLicense = await readFile('node_modules/turndown/LICENSE', 'utf8');
const notice = `/*\n * CopyVersa ${pkg.version} includes Turndown (https://github.com/mixmark-io/turndown).\n *\n${turndownLicense
    .trim()
    .split('\n')
    .map((line) => ` * ${line}`.trimEnd())
    .join('\n')}\n */`;

// Turndown probes DOMParser as soon as it loads. CopyVersa always hands it DOM
// nodes, never HTML strings, so the probe is skipped: on pages that enforce
// Trusted Types it would log a violation on every page load.
const skipTurndownParser = {
    name: 'skip-turndown-parser',
    setup(build) {
        build.onLoad({ filter: /turndown\.browser\.es\.js$/ }, async ({ path }) => {
            const probe = 'var HTMLParser = canParseHTMLNatively() ? root.DOMParser : createHTMLParser();';
            const source = await readFile(path, 'utf8');
            if (!source.includes(probe)) throw new Error('Turndown changed: review skip-turndown-parser');
            return { contents: source.replace(probe, 'var HTMLParser = null;'), loader: 'js' };
        });
    },
};

const shared = {
    bundle: true,
    format: 'iife',
    target: 'es2022',
    charset: 'utf8',
    legalComments: 'none',
    loader: { '.css': 'text' },
    logLevel: 'info',
    plugins: [skipTurndownParser],
};

await rm('dist', { recursive: true, force: true });
await mkdir('dist/extension', { recursive: true });

const builds = await Promise.all([
    context({
        ...shared,
        entryPoints: ['src/userscript.js'],
        outfile: 'dist/copyversa.user.js',
        banner: { js: metadata },
        footer: { js: notice },
    }),
    context({
        ...shared,
        entryPoints: ['src/extension/content.js'],
        outfile: 'dist/extension/content.js',
        footer: { js: notice },
    }),
    context({
        ...shared,
        entryPoints: ['src/extension/background.js'],
        outfile: 'dist/extension/background.js',
    }),
]);

await writeFile('dist/copyversa.meta.js', metadata);
const manifest = JSON.parse(await readFile('src/extension/manifest.json', 'utf8'));
manifest.version = pkg.version;
await writeFile('dist/extension/manifest.json', `${JSON.stringify(manifest, null, 4)}\n`);
await cp('src/extension/_locales', 'dist/extension/_locales', { recursive: true });
await cp('assets/icons', 'dist/extension/icons', { recursive: true });
await cp('LICENSE', 'dist/extension/LICENSE');

if (watch) {
    await Promise.all(builds.map((build) => build.watch()));
} else {
    await Promise.all(builds.map((build) => build.rebuild()));
    await Promise.all(builds.map((build) => build.dispose()));
}
