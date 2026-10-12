import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { Script } from 'node:vm';

test('website translations are present', () => {
    for (const locale of ['USen', 'CNzh', 'JPja']) {
        const language = JSON.parse(readFileSync(`resources/i18n/${locale}.json`, 'utf8'));
        assert.ok(Object.keys(language).length > 100, locale);
    }
});

test('model resource names can be installed on Windows', () => {
    const check = folder => {
        for (const entry of readdirSync(folder, {withFileTypes: true})) {
            assert.doesNotMatch(entry.name, /[<>:"\\|?*]|[. ]$/, `${folder}/${entry.name}`);
            if (entry.isDirectory()) check(resolve(folder, entry.name));
        }
    };
    check('resources');
});

test('resource translations initialize on a plain static host and in offline builds', async () => {
    for (const offline of [undefined, false, true]) {
        const requests = [];
        const elements = new Map();
        const element = id => {
            if (!elements.has(id)) elements.set(id, {
                value: '', textContent: '', setAttribute() {}, addEventListener() {}, dispatchEvent() {},
                querySelector: () => element('addon-link'), replaceChildren() {},
            });
            return elements.get(id);
        };
        const context = {
            document: { documentElement: {}, getElementById: element, createTextNode: text => text },
            navigator: { languages: ['en-US'] },
            window: { localStorage: { getItem: () => 'USen', setItem() {} }, dispatchEvent() {}, addEventListener() {} },
            Event, CustomEvent,
            fetch: async url => { requests.push(url); return { ok: true, json: async () => ({}) }; },
            console,
        };
        if (offline !== undefined) context.__DESKTOP_OFFLINE__ = offline;
        new Script(readFileSync('resources/i18n.js', 'utf8')).runInNewContext(context);
        await Promise.resolve();
        assert.equal(element('resource-language').value, 'USen');
        assert.equal(context.document.documentElement.lang, 'en');
        assert.equal(requests[0], './resources/i18n/USen.json');
    }
});

test('shared navigation follows resource locale in either script load order', () => {
    for (const resourceFirst of [false, true]) {
        const bus = new EventTarget();
        const select = Object.assign(new EventTarget(), { value: 'USen' });
        const backHome = { dataset: { uiText: 'backHome' }, closest: () => null };
        const context = {
            window: {
                addEventListener: bus.addEventListener.bind(bus),
                localStorage: { getItem: () => 'CNzh' },
                ...(resourceFirst ? { resourceI18n: { getLocale: () => 'USen' } } : {}),
            },
            document: {
                querySelector: selector => selector === '#resource-language' ? select : null,
                querySelectorAll: () => [backHome],
            },
            localStorage: { getItem: () => 'CNzh' }, navigator: { languages: ['zh-CN'] }, Event,
        };
        new Script(readFileSync('ui-i18n.js', 'utf8').replace(/^import[^\n]+\n/gm, '')).runInNewContext(context);
        assert.equal(backHome.textContent, 'Back to Home');
        bus.dispatchEvent(new CustomEvent('resource-locale-change', { detail: 'CNzh' }));
        assert.equal(backHome.textContent, '返回首页');
        assert.equal(context.window.partialUiI18n.text('updatingPreview'), '正在更新预览…');
        bus.dispatchEvent(new CustomEvent('resource-locale-change', { detail: 'USen' }));
        assert.equal(backHome.textContent, 'Back to Home');
        assert.equal(context.window.partialUiI18n.text('updatingPreview'), 'Updating preview…');
    }
});

test('language picker preserves Safari taps that blur before clicking an option', () => {
    class Element extends EventTarget {
        children = [];
        dataset = {};
        attributes = {};
        append(...children) { this.children.push(...children); }
        setAttribute(name, value) { this.attributes[name] = value; }
        getAttribute(name) { return this.attributes[name] || null; }
        contains(element) { return this === element || this.children.some(child => child.contains(element)); }
        focus() { document.activeElement = this; }
        after(element) { this.picker = element; }
        get selectedOptions() { return this.options.filter(option => option.value === this.value); }
    }
    const select = Object.assign(new Element(), {
        id: 'resource-language', value: 'USen',
        options: [{value: 'USen', textContent: 'English'}, {value: 'CNzh', textContent: '简体中文'}],
    });
    const document = Object.assign(new EventTarget(), {
        querySelectorAll: () => [select], createElement: () => new Element(),
    });
    new Script(readFileSync('language-picker.js', 'utf8')).runInNewContext({
        document, Event, MutationObserver: class { observe() {} },
    });
    const [trigger, menu] = select.picker.children;
    let changes = 0;
    select.addEventListener('change', () => changes++);
    trigger.dispatchEvent(new Event('click'));
    assert.equal(menu.hidden, false);
    // iOS Safari leaves relatedTarget null rather than focusing the tapped button.
    const blur = new Event('focusout');
    Object.defineProperty(blur, 'relatedTarget', {value: null});
    select.picker.dispatchEvent(blur);
    assert.equal(menu.hidden, false, 'the option must still be visible when click arrives');
    menu.children[1].dispatchEvent(new Event('click'));
    assert.equal(select.value, 'CNzh');
    assert.equal(changes, 1);
    assert.equal(menu.hidden, true);
    assert.equal(document.activeElement, trigger);
    // Actual outside focus (keyboard navigation) and outside taps still dismiss.
    for (const eventType of ['focusin', 'pointerdown']) {
        trigger.dispatchEvent(new Event('click'));
        document.dispatchEvent(new Event(eventType));
        assert.equal(menu.hidden, true, eventType);
    }
});

test('ink navigation becomes visible only with the saved language applied', () => {
    for (const locale of ['CNzh', 'USen']) {
        const select = Object.assign(new EventTarget(), { value: 'USen' });
        let ready = false;
        const backHome = { dataset: { uiText: 'backHome' }, closest: () => ({
            setAttribute: () => { ready = true; },
        }) };
        const context = {
            window: { addEventListener() {} }, localStorage: { getItem: () => locale },
            navigator: { languages: ['en-US'] }, Event,
            document: {
                querySelector: selector => selector === '#ui-language' ? select : null,
                querySelectorAll: () => [backHome],
            },
        };
        new Script(readFileSync('ui-i18n.js', 'utf8').replace(/^import[^\n]+\n/gm, '')).runInNewContext(context);
        assert.equal(select.value, locale);
        assert.equal(backHome.textContent, locale === 'CNzh' ? '返回首页' : 'Back to Home');
        assert.equal(ready, true);
    }
});

test('returning home reveals the restored position without waiting for 3D or DOMContentLoaded', () => {
    const listeners = new Map();
    const storage = new Map([['splatoon-home-scroll', '850']]);
    const calls = [];
    let hidden = true;
    const window = {
        scrollY: 850, location: {hash: ''},
        addEventListener: (name, listener) => listeners.set(name, listener),
        scrollTo: options => calls.push(options.top),
    };
    const document = { readyState: 'loading', documentElement: { classList: {remove: () => {hidden = false;}} },
        addEventListener: () => assert.fail('restoration must not wait for module loading'),
    };
    new Script(readFileSync('home-scroll.js', 'utf8')).runInNewContext({
        window, document, history: {},
        sessionStorage: {getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value)},
    });
    assert.deepEqual(calls, [850]);
    assert.equal(hidden, false);
    window.scrollY = 1250;
    listeners.get('pagehide')();
    listeners.get('pageshow')({persisted: true});
    assert.deepEqual(calls, [850, 1250], 'cached pages restore their most recently saved position');
    const html = readFileSync('dist/index.html', 'utf8');
    assert.match(html, /<script src="\.\/home-scroll.js"><\/script>/);
    assert.equal(readFileSync('dist/home-scroll.js', 'utf8'), readFileSync('home-scroll.js', 'utf8'));
});
