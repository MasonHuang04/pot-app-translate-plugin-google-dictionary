// SPDX-License-Identifier: GPL-3.0-only
// Pot loads this file with eval(`${script} translate`); do not use imports/exports.
async function translate(text, from, to, options = {}) {
    const { config = {}, utils = {} } = options;
    if (typeof text !== 'string' || !text.trim()) return '';
    if (!to || to === 'auto') throw new Error('请选择目标语言。');
    const fetch = utils.http?.fetch || utils.tauriFetch;
    if (typeof fetch !== 'function') throw new Error('Pot 未提供 HTTP 接口，请使用支持翻译插件的版本。');

    // Keep helpers inside translate: Pot evaluates plugins in its own scope.
    const list = (value) => Array.isArray(value) ? value : [];
    function plain(value) {
        if (typeof value !== 'string') return '';
        const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
        return value.replace(/<br\s*\/?\s*>/gi, '\n').replace(/<[^>]*>/g, '')
            .replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (match, name) => {
                if (name[0] !== '#') return entities[name.toLowerCase()];
                const hex = name[1].toLowerCase() === 'x';
                const code = parseInt(name.slice(hex ? 2 : 1), hex ? 16 : 10);
                return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff)
                    ? String.fromCodePoint(code) : match;
            }).trim();
    }
    function html(value) {
        // Pot renders example sentences through dangerouslySetInnerHTML.
        return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    const unique = (values) => [...new Set(values.filter(Boolean))];

    let base = typeof config.requestPath === 'string' ? config.requestPath.trim() : '';
    if (!base) base = 'https://translate.google.com';
    if (!/^[a-z][a-z\d+.-]*:\/\//i.test(base)) base = 'https://' + base;
    let endpoint;
    try {
        endpoint = new URL(base);
        if (!['https:', 'http:'].includes(endpoint.protocol) || endpoint.search || endpoint.hash
            || endpoint.username || endpoint.password) throw new Error();
        endpoint.pathname = endpoint.pathname.replace(/\/+$/, '').replace(/\/translate_a\/single$/, '')
            + '/translate_a/single';
    } catch (_) {
        throw new Error('请求地址应为域名或基础 URL，例如 https://translate.google.com。');
    }
    // Repeated dt parameters must stay in the URL; Tauri query values are strings.
    for (const part of ['t', 'bd', 'rm', 'md', 'ex', 'ss']) endpoint.searchParams.append('dt', part);
    const query = {
        client: 'gtx', dj: '1', sl: from || 'auto', tl: to, hl: to,
        ie: 'UTF-8', oe: 'UTF-8', q: text.trim(),
    };
    let response;
    try {
        response = await fetch(endpoint.toString(), {
            method: 'GET', query, timeout: 20, responseType: 1,
        });
    } catch (_) {
        throw new Error('无法连接 Google Translate。请检查网络、Pot 的代理设置或插件的请求地址。');
    }
    if (!response?.ok) {
        if (response?.status === 429) {
            throw new Error('Google Translate 请求过于频繁（HTTP 429），请稍后再试。');
        }
        throw new Error(`Google Translate 请求失败（HTTP ${response?.status ?? '未知'}）。`);
    }
    let data = response.data;
    if (typeof data === 'string') {
        try { data = JSON.parse(data); }
        catch (_) { throw new Error('Google 返回了非 JSON 内容，请检查请求地址或网络。'); }
    }
    // Some reverse proxies ignore dj=1 and return the legacy array format.
    if (Array.isArray(data)) {
        data = {
            sentences: list(data[0]).map((item) => ({ trans: item?.[0], src_translit: item?.[3] })),
            dict: list(data[1]).map((group) => ({
                pos: group?.[0], terms: group?.[1],
                entry: list(group?.[2]).map((item) => ({ word: item?.[0], reverse_translation: item?.[1] })),
            })),
            definitions: list(data[12]).map((group) => ({
                pos: group?.[0], entry: list(group?.[1]).map((item) => ({ gloss: item?.[0], example: item?.[2] })),
            })),
            examples: { example: list(data[13]?.[0]).map((item) => ({ text: item?.[0] })) },
            synsets: list(data[11]).map((group) => ({
                pos: group?.[0], entry: list(group?.[1]).map((item) => ({ synonym: item?.[0] })),
            })),
        };
    }
    if (!data || typeof data !== 'object') throw new Error('Google 返回了无法识别的数据。');

    const translation = list(data.sentences).map((item) => typeof item?.trans === 'string' ? item.trans : '').join('').trim();
    const result = { pronunciations: [], explanations: [], associations: [], sentence: [] };
    const seenExplanations = new Set();
    const seenSentences = new Set();
    function addExplanation(trait, values) {
        const explains = unique(values.map(plain));
        if (!explains.length) return;
        const key = JSON.stringify([trait, explains]);
        if (seenExplanations.has(key)) return;
        seenExplanations.add(key);
        result.explanations.push({ trait, explains });
    }
    function addSentence(value) {
        const source = plain(value);
        if (!source || seenSentences.has(source)) return;
        seenSentences.add(source);
        result.sentence.push({ source: html(source) });
    }
    for (const group of list(data.dict)) {
        const entries = list(group?.entry);
        // terms can be present even when detailed entries are omitted.
        const terms = entries.map((entry) => {
            const word = plain(entry?.word);
            if (!word) return '';
            const reverse = unique(list(entry?.reverse_translation).map(plain));
            return word + (reverse.length ? `（${reverse.join(', ')}）` : '');
        }).filter(Boolean);
        const seenWords = new Set(entries.map((entry) => plain(entry?.word)).filter(Boolean));
        terms.push(...list(group?.terms).map(plain).filter((word) => !seenWords.has(word)));
        addExplanation(plain(group?.pos), terms);
    }
    for (const group of list(data.definitions)) {
        for (const entry of list(group?.entry)) {
            addExplanation(`原文释义${plain(group?.pos) ? ' · ' + plain(group.pos) : ''}`, [entry?.gloss]);
            addSentence(entry?.example);
        }
    }
    // Metadata alone should not turn ordinary sentence translation into a dictionary.
    if (!result.explanations.length) {
        if (translation) return translation;
        throw new Error('Google 没有返回译文或词典释义。');
    }
    if (translation) result.explanations.unshift({ trait: '翻译', explains: [translation] });
    for (const symbol of unique(list(data.sentences).map((item) => plain(item?.src_translit)))) {
        result.pronunciations.push({ region: '', symbol, voice: '' });
    }
    for (const group of list(data.synsets)) {
        const words = unique(list(group?.entry).flatMap((entry) => list(entry?.synonym)).map(plain));
        if (words.length) result.associations.push(`近义词${plain(group?.pos) ? ' · ' + plain(group.pos) : ''}：${words.join(', ')}`);
    }
    result.associations = unique(result.associations);
    for (const entry of list(data.examples?.example)) addSentence(entry?.text);

    // Text mode retains all dictionary content and supports Pot's copy button.
    if (config.outputFormat === 'text') {
        return [
            ...result.pronunciations.map((item) => `[${item.symbol}]`),
            ...result.explanations.map((item) => `${item.trait ? '【' + item.trait + '】' : ''}\n${item.explains.join('；')}`.trim()),
            ...result.associations,
            ...result.sentence.map((item, index) => `${index + 1}. ${plain(item.source)}`),
        ].join('\n\n');
    }
    return result;
}
