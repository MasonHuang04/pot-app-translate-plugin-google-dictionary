const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const root = join(__dirname, '..');
const script = readFileSync(join(root, 'main.js'), 'utf8');
// Match invoke_plugin.js's eval entry point, without Node globals in the plugin.
const translate = vm.runInNewContext(`${script}\ntranslate`, { URL });
const json = (value) => JSON.parse(JSON.stringify(value));
const info = JSON.parse(readFileSync(join(root, 'info.json'), 'utf8'));

// Synthetic fixtures based on the published Google response schema; not live captures.
const word = {
    sentences: [{ trans: '跑', orig: 'run' }, { src_translit: 'rən' }],
    dict: [
        { pos: '动词', terms: ['跑', '经营'], entry: [
            { word: '跑', reverse_translation: ['run', 'sprint'] },
            { word: '经营', reverse_translation: ['operate', 'run'] },
        ] },
        { pos: '名词', terms: ['运行', '旅程'] },
    ],
    definitions: [{ pos: 'verb', entry: [
        { gloss: 'move rapidly on foot', example: 'They <b>run</b> every day.' },
        { gloss: 'manage a business', example: 'They run a shop.' },
    ] }],
    synsets: [{ pos: 'verb', entry: [{ synonym: ['sprint', 'jog', 'sprint'] }] }],
    examples: { example: [{ text: 'They <b>run</b> every day.' }, { text: 'The bus runs late.' }] },
};
function client(data, { status = 200, config = {}, legacy = false } = {}) {
    const calls = [];
    const fetch = async (url, options) => {
        calls.push({ url, options });
        return { ok: status >= 200 && status < 300, status, data };
    };
    return {
        calls,
        query: (text = 'run', from = 'en', to = 'zh-CN') => translate(text, from, to, {
            config, utils: legacy ? { tauriFetch: fetch } : { http: { fetch } },
        }),
    };
}

test('Pot manifest, language codes and assets are consistent', () => {
    assert.match(info.id, /^plugin\./);
    assert.equal(info.plugin_type, 'translate');
    assert.equal(info.language.zh_cn, 'zh-CN');
    assert.equal(info.language.zh_tw, 'zh-TW');
    assert.equal(info.language.auto, 'auto');
    assert(existsSync(join(root, info.icon)));
    assert.equal(info.needs.find((item) => item.key === 'outputFormat').options.dictionary, '词典卡片（默认）');
});
test('word lookup retains parts of speech, multiple senses and reverse translations', async () => {
    const result = await client(word).query();
    assert.deepEqual(json(result.explanations.slice(0, 3)), [
        { trait: '翻译', explains: ['跑'] },
        { trait: '动词', explains: ['跑（run, sprint）', '经营（operate, run）'] },
        { trait: '名词', explains: ['运行', '旅程'] },
    ]);
    assert.deepEqual(json(result.pronunciations), [{ region: '', symbol: 'rən', voice: '' }]);
    assert.deepEqual(json(result.associations), ['近义词 · verb：sprint, jog']);
    assert.equal(result.explanations.length, 5);
});
test('definition and usage examples survive and duplicate examples are removed', async () => {
    const result = await client(word).query();
    assert(result.explanations.some((item) => item.explains.includes('manage a business')));
    assert.deepEqual(json(result.sentence), [
        { source: 'They run every day.' }, { source: 'They run a shop.' }, { source: 'The bus runs late.' },
    ]);
});
test('missing phonetics and detailed entries do not crash word lookup', async () => {
    const result = await client({ sentences: [{ trans: '银行' }], dict: [{ pos: '名词', terms: ['银行', '河岸'] }] }).query('bank');
    assert.equal(result.pronunciations.length, 0);
    assert.deepEqual(json(result.explanations[1]), { trait: '名词', explains: ['银行', '河岸'] });
});
test('terms missing from detailed entries are retained', async () => {
    const result = await client({ dict: [{ pos: 'noun', entry: [{ word: '银行' }], terms: ['银行', '河岸'] }] }).query('bank');
    assert.deepEqual(json(result.explanations[0].explains), ['银行', '河岸']);
});
test('definitions without bilingual dictionary entries still produce a dictionary', async () => {
    const result = await client({ definitions: [{ pos: 'noun', entry: [{ gloss: 'a financial institution' }] }] }).query('bank', 'en', 'en');
    assert.deepEqual(json(result.explanations), [{ trait: '原文释义 · noun', explains: ['a financial institution'] }]);
});
test('sentence translation joins segments without introducing spaces', async () => {
    const data = { sentences: [{ trans: '我昨天' }, { trans: '读了一本书。' }, { src_translit: 'irrelevant' }], dict: [] };
    assert.equal(await client(data).query('I read a book yesterday.'), '我昨天读了一本书。');
});
test('multiword phrases can have dictionary results', async () => {
    const result = await client({ dict: [{ pos: '短语', terms: ['起飞', '脱下'] }] }).query('take off');
    assert.deepEqual(json(result.explanations[0].explains), ['起飞', '脱下']);
});
test('empty or malformed optional dictionary fields fall back to translation', async () => {
    const data = { sentences: [{ trans: '你好' }], dict: [null, { entry: [null, {}], terms: [null, 12] }], definitions: [null, { entry: [null] }] };
    assert.equal(await client(data).query('hello'), '你好');
});
test('no dictionary data falls back to translation in every output mode', async () => {
    assert.equal(await client({ sentences: [{ trans: '你好' }] }, { config: { outputFormat: 'text' } }).query(), '你好');
});
test('JSON text responses and legacy tauriFetch utility are accepted', async () => {
    assert.equal((await client(JSON.stringify(word), { legacy: true }).query()).explanations.length, 5);
});
test('legacy arrays preserve dictionary, phonetics, definitions and examples', async () => {
    const data = [];
    data[0] = [['银行', 'bank'], [null, null, null, 'baŋk']];
    data[1] = [['名词', ['银行', '河岸'], [['银行', ['bank']]]]];
    data[11] = [['noun', [[['lender'], 'id']]]];
    data[12] = [['noun', [['a financial institution', 'id', 'A local bank.']]]];
    data[13] = [[['The <b>bank</b> is open.']]];
    const result = await client(data).query('bank');
    assert.deepEqual(json(result.explanations[1].explains), ['银行（bank）', '河岸']);
    assert.equal(result.explanations[2].explains[0], 'a financial institution');
    assert.deepEqual(json(result.sentence), [{ source: 'A local bank.' }, { source: 'The bank is open.' }]);
});
test('legacy arrays without second sentence or pronunciation do not crash', async () => {
    const result = await client([[['你好', 'hello']], [['感叹词', ['你好']]]]).query('hello');
    assert.equal(result.explanations[1].explains[0], '你好');
    assert.equal(result.pronunciations.length, 0);
});
test('legacy sentence translation works', async () => {
    assert.equal(await client([[['你好。', 'Hello.'], ['再见。', 'Goodbye.']], null]).query(), '你好。再见。');
});
test('full text mode includes the complete dictionary and readable examples', async () => {
    const result = await client(word, { config: { outputFormat: 'text' } }).query();
    for (const expected of ['【动词】', '经营（operate, run）', 'move rapidly on foot', '近义词', 'They run every day.']) assert(result.includes(expected));
    assert(!result.includes('<b>'));
});
test('example HTML cannot introduce tags, event handlers, or decoded entity attacks', async () => {
    const data = { ...word, definitions: [], examples: { example: [
        { text: '<img src=x onerror=alert(1)><b>bank</b> &amp; &#x3c;script&#x3e;' },
        { text: '&lt;img src=x onerror=alert(1)&gt; &quot;bank&quot; &#0; &#99999999;' },
    ] } };
    const result = await client(data).query();
    for (const example of result.sentence) assert(!example.source.includes('<'));
    assert.equal(result.sentence[0].source, 'bank &amp; &lt;script&gt;');
    assert(result.sentence[1].source.includes('&lt;img'));
});
test('each request includes all dictionary sections, proper languages and original Unicode', async () => {
    const c = client(word);
    await c.query('  银行 & café / + ?  ', 'auto', 'zh-TW');
    const { url, options } = c.calls[0];
    assert.equal(new URL(url).origin, 'https://translate.google.com');
    assert.deepEqual(new URL(url).searchParams.getAll('dt'), ['t', 'bd', 'rm', 'md', 'ex', 'ss']);
    assert.deepEqual(json(options.query), { client: 'gtx', dj: '1', sl: 'auto', tl: 'zh-TW', hl: 'zh-TW', ie: 'UTF-8', oe: 'UTF-8', q: '银行 & café / + ?' });
    assert.equal(options.timeout, 20);
    assert.equal(options.responseType, 1);
    assert.equal(c.calls.length, 1);
});
test('custom endpoints accept a host, a path prefix, and the full API path', async () => {
    for (const [requestPath, expected] of [
        ['translate.googleapis.com/', 'https://translate.googleapis.com/translate_a/single'],
        ['https://example.org/google/', 'https://example.org/google/translate_a/single'],
        ['http://localhost:5000/translate_a/single/', 'http://localhost:5000/translate_a/single'],
    ]) {
        const c = client(word, { config: { requestPath } });
        await c.query();
        assert.equal(c.calls[0].url.split('?')[0], expected);
    }
});
test('bad endpoint configuration is rejected before any request', async () => {
    for (const requestPath of ['ftp://example.org', 'https://example.org?key=secret', 'https://example.org#fragment', 'https://user:password@example.org']) {
        const c = client(word, { config: { requestPath } });
        await assert.rejects(c.query(), /请求地址/);
        assert.equal(c.calls.length, 0);
    }
});
test('empty queries never issue a network request', async () => {
    const c = client(word);
    assert.equal(await c.query('  '), '');
    assert.equal(c.calls.length, 0);
});
test('HTTP errors are actionable and do not automatically retry a rate limit', async () => {
    for (const status of [429, 403, 500]) {
        const c = client(null, { status });
        await assert.rejects(c.query(), new RegExp(`HTTP ${status}`));
        assert.equal(c.calls.length, 1);
    }
});
test('network errors give a useful connection message', async () => {
    await assert.rejects(translate('bank', 'en', 'zh-CN', { utils: { http: { fetch: async () => { throw new Error('offline'); } } } }), /网络.*代理设置/);
});
test('invalid responses do not render a false success or remote error page', async () => {
    for (const data of [null, {}, [], 123, 'not json', '<html>proxy error</html>', '{"error":"quota"}']) {
        await assert.rejects(client(data).query(), /Google/);
    }
});
test('invalid target language and missing HTTP utility fail clearly', async () => {
    await assert.rejects(client(word).query('run', 'en', 'auto'), /目标语言/);
    await assert.rejects(translate('run', 'en', 'zh-CN'), /HTTP 接口/);
});
test('parallel translations do not share dictionary state', async () => {
    const [first, second] = await Promise.all([client(word).query(), client({ dict: [{ terms: ['银行'] }] }).query('bank')]);
    assert.equal(first.explanations.length, 5);
    assert.equal(second.explanations.length, 1);
    assert.deepEqual(json(second.explanations[0].explains), ['银行']);
});
