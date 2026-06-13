/* i18n.js — motor de traducción compartido */
(function () {
    'use strict';

    var LANGS = [
        { code: 'es',  name: 'Español',  short: 'ES'  },
        { code: 'eu',  name: 'Euskera',  short: 'EU'  },
        { code: 'ca',  name: 'Català',   short: 'CA'  },
        { code: 'gl',  name: 'Galego',   short: 'GL'  },
        { code: 'val', name: 'Valencià', short: 'VAL' },
        { code: 'oc',  name: 'Aranés',   short: 'OC'  },
    ];

    window._i18n = {};
    window._i18nLang = 'es';

    window.t = function (key, fallback) {
        var v = window._i18n[key];
        return v !== undefined ? v : (fallback !== undefined ? fallback : key);
    };

    function applyTranslations() {
        document.querySelectorAll('[data-i18n]').forEach(function (el) {
            var v = window._i18n[el.getAttribute('data-i18n')];
            if (v !== undefined) el.textContent = v;
        });
        document.querySelectorAll('[data-i18n-html]').forEach(function (el) {
            var v = window._i18n[el.getAttribute('data-i18n-html')];
            if (v !== undefined) el.innerHTML = v;
        });
        document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
            var v = window._i18n[el.getAttribute('data-i18n-placeholder')];
            if (v !== undefined) el.placeholder = v;
        });
        var pt = window._i18n['page.title'];
        if (pt) document.title = pt;
        document.documentElement.lang = window._i18nLang || 'es';
    }

    /* Base path derived from this script's own URL so it works on any subpath (GitHub Pages, etc.) */
    var _i18nBase = (function () {
        var s = document.currentScript && document.currentScript.src;
        if (!s) {
            var tags = document.getElementsByTagName('script');
            for (var i = tags.length - 1; i >= 0; i--) {
                if (tags[i].src && tags[i].src.indexOf('i18n.js') !== -1) { s = tags[i].src; break; }
            }
        }
        return s ? s.substring(0, s.lastIndexOf('/') + 1) : '/';
    })();

    function loadLang(code) {
        fetch(_i18nBase + 'i18n/' + code + '.json')
            .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
            .then(function (data) {
                window._i18n = data;
                window._i18nLang = code;
                localStorage.setItem('lang', code);
                applyTranslations();
                updateSwitcher(code);
            })
            .catch(function () {
                if (code !== 'es') loadLang('es');
            });
    }

    function getLang() {
        var saved = localStorage.getItem('lang');
        if (saved && LANGS.some(function (l) { return l.code === saved; })) return saved;
        var nav = (navigator.language || '').toLowerCase();
        if (nav.startsWith('eu')) return 'eu';
        if (nav.startsWith('ca')) return 'ca';
        if (nav.startsWith('gl')) return 'gl';
        if (nav.startsWith('oc')) return 'oc';
        return 'es';
    }

    function updateSwitcher(code) {
        var sw = document.getElementById('langSwitcher');
        if (!sw) return;
        sw.querySelectorAll('.i18n-opt').forEach(function (btn) {
            btn.classList.toggle('active', btn.dataset.code === code);
        });
        var cur = LANGS.find(function (l) { return l.code === code; });
        var label = sw.querySelector('.i18n-cur');
        if (label && cur) label.textContent = cur.short;
    }

    function buildSwitcher() {
        var cur = getLang();
        var curL = LANGS.find(function (l) { return l.code === cur; }) || LANGS[0];

        var style = document.createElement('style');
        style.textContent = [
            '#langSwitcher{position:fixed;top:.75rem;right:.75rem;z-index:9999;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}',
            '.i18n-toggle{background:rgba(30,58,95,.9);color:#fff;border:none;border-radius:8px;padding:.32rem .7rem;font-size:.76rem;font-weight:700;cursor:pointer;letter-spacing:.03em;display:flex;align-items:center;gap:.25em;box-shadow:0 2px 8px rgba(0,0,0,.18)}',
            '.i18n-toggle:hover{background:rgba(30,58,95,1)}',
            '.i18n-menu{display:none;position:absolute;top:calc(100% + .35rem);right:0;background:#fff;border:1px solid #e2e8f0;border-radius:10px;box-shadow:0 4px 20px rgba(0,0,0,.14);min-width:120px;overflow:hidden}',
            '#langSwitcher.open .i18n-menu{display:block}',
            '.i18n-opt{display:block;width:100%;text-align:left;padding:.45rem .85rem;font-size:.8rem;background:none;border:none;cursor:pointer;color:#1e293b;white-space:nowrap}',
            '.i18n-opt:hover{background:#f1f5f9}',
            '.i18n-opt.active{color:#1e3a5f;font-weight:700;background:#eff6ff}',
        ].join('');
        document.head.appendChild(style);

        var sw = document.createElement('div');
        sw.id = 'langSwitcher';
        sw.innerHTML = '<button class="i18n-toggle" onclick="document.getElementById(\'langSwitcher\').classList.toggle(\'open\')" aria-label="Cambiar idioma">' +
            '<span class="i18n-cur">' + curL.short + '</span> ▾</button>' +
            '<div class="i18n-menu">' +
            LANGS.map(function (l) {
                return '<button class="i18n-opt' + (l.code === cur ? ' active' : '') + '" data-code="' + l.code + '" onclick="window.switchLang(\'' + l.code + '\')">' + l.name + '</button>';
            }).join('') +
            '</div>';
        document.body.appendChild(sw);

        document.addEventListener('click', function (e) {
            var sw2 = document.getElementById('langSwitcher');
            if (sw2 && !sw2.contains(e.target)) sw2.classList.remove('open');
        });
    }

    window.switchLang = function (code) {
        var sw = document.getElementById('langSwitcher');
        if (sw) sw.classList.remove('open');
        loadLang(code);
    };

    document.addEventListener('DOMContentLoaded', function () {
        buildSwitcher();
        loadLang(getLang());
    });
})();
