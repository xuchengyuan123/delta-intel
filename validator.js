const fs = require('fs');
const path = require('path');
const vm = require('vm');

const BASE = process.argv[2] || path.resolve(__dirname, 'docs');
const dataPath = path.join(BASE, 'data.json');
const indexPath = path.join(BASE, 'index.html');

let DATA;
try { DATA = JSON.parse(fs.readFileSync(dataPath, 'utf8')); } catch (e) { console.error('data.json parse error:', e.message); process.exit(1); }

function makeEl(tag) {
  return {
    tagName: tag || 'DIV',
    style: {},
    _attrs: {},
    innerHTML: '',
    textContent: '',
    value: '',
    checked: false,
    className: '',
    children: [],
    getAttribute(k) { return this._attrs[k] != null ? this._attrs[k] : null; },
    setAttribute(k, v) { this._attrs[k] = String(v); },
    addEventListener() {},
    appendChild(c) { this.children.push(c); return c; },
    querySelector() { return makeEl(); },
    querySelectorAll() { return []; },
    closest() { return null; },
    remove() {},
    classList: { add() {}, remove() {}, toggle() { return false; }, contains() { return false; } }
  };
}

const documentStub = {
  readyState: 'complete',
  body: makeEl('BODY'),
  documentElement: makeEl('HTML'),
  head: makeEl('HEAD'),
  _els: {},
  getElementById(id) {
    if (!this._els[id]) this._els[id] = makeEl();
    return this._els[id];
  },
  querySelector() { return makeEl(); },
  querySelectorAll() { return []; },
  createElement(tag) { return makeEl(tag); },
  addEventListener() {}
};

const ls = (() => {
  const m = {};
  return {
    getItem(k) { return k in m ? m[k] : null; },
    setItem(k, v) { m[k] = String(v); },
    removeItem(k) { delete m[k]; }
  };
})();

function fetchStub(url) {
  const u = String(url || '');
  if (u.indexOf('data.json') > -1) {
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(DATA), text: () => Promise.resolve(JSON.stringify(DATA)) });
  }
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]), text: () => Promise.resolve('') });
}

const sandbox = {
  window: null,
  document: documentStub,
  localStorage: ls,
  navigator: { clipboard: { writeText: () => Promise.resolve() }, serviceWorker: { register: () => Promise.resolve() } },
  console,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  Math,
  JSON,
  Date,
  encodeURIComponent,
  decodeURIComponent,
  URL,
  URLSearchParams,
  Array,
  Object,
  String,
  Number,
  Boolean,
  RegExp,
  Error,
  Promise,
  fetch: fetchStub,
  addEventListener() {},
  removeEventListener() {}
};
sandbox.window = sandbox;
sandbox.window.__df_plugins = [];

vm.createContext(sandbox);

const html = fs.readFileSync(indexPath, 'utf8');
const scripts = [];
html.replace(/<script[^>]*src="([^"]+)"[^>]*>/g, function(m, src) { scripts.push(src); return m; });

const errors = [];
for (const src of scripts) {
  if (/^https?:\/\//.test(src)) { continue; } // skip CDN / external scripts
  const p = path.join(BASE, src.split('?')[0]);
  if (!fs.existsSync(p)) { errors.push('MISSING: ' + src); continue; }
  const code = fs.readFileSync(p, 'utf8');
  try {
    vm.runInContext(code, sandbox, { filename: src });
  } catch (e) {
    errors.push('RUNTIME in ' + src + ': ' + e.message + '\n  ' + (e.stack || '').split('\n').slice(0, 3).join('\n  '));
  }
}

// Wait for async fetch
setTimeout(function() {
  // Run all views
  const DF = sandbox.DF;
  if (!DF) { errors.push('No window.DF registered'); }
  else {
    const VIEWS = DF.VIEWS || {};
    const keys = Object.keys(VIEWS);
    for (const k of keys) {
      try {
        const v = VIEWS[k];
        if (v && v.html) v.html();
        if (v && v.init) v.init();
      } catch (e) {
        errors.push('VIEW ' + k + ': ' + e.message + ' | ' + (e.stack || '').split('\n')[0]);
      }
    }
    console.log('Views checked:', keys.length);
  }
  console.log('Errors:', errors.length ? errors : 'NONE');
  process.exit(errors.length ? 1 : 0);
}, 100);
