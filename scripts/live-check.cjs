// Optional: sends only the three public sample queries below to Google.
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { strict: assert } = require('node:assert');
const script = readFileSync(join(__dirname, '..', 'main.js'), 'utf8');
const translate = new Function(`${script}; return translate;`)();
const http = {
    async fetch(url, options) {
        const endpoint = new URL(url);
        for (const [key, value] of Object.entries(options.query)) endpoint.searchParams.set(key, value);
        const response = await fetch(endpoint, { signal: AbortSignal.timeout(options.timeout * 1000) });
        return { ok: response.ok, status: response.status, data: await response.text() };
    },
};
(async () => {
    for (const [query, dictionary] of [['run', true], ['bank', true], ['I read a book yesterday.', false]]) {
        const result = await translate(query, 'en', 'zh-CN', {
            config: { requestPath: process.env.GOOGLE_TRANSLATE_BASE_URL || '' }, utils: { http },
        });
        assert.equal(typeof result === 'object', dictionary, `Unexpected result for ${query}`);
        if (dictionary) {
            assert(result.explanations.some((entry) => entry.trait !== '翻译'));
            console.log(`${query}: ${result.explanations.length} definition groups`);
        } else {
            assert(result.trim());
            console.log(`${query}: ${result}`);
        }
    }
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
