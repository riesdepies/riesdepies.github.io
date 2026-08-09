// ==UserScript==
// @name         Schatkamer Android TV Interface
// @namespace    http://tampermonkey.net/
// @version      2.6
// @description  Fullscreen TV Grid UI met D-Pad navigatie voor Schatkamer Beeld & Geluid (met mobiele portrait ondersteuning)
// @match        https://schatkamer.beeldengeluid.nl/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // CSS om originele pagina te verbergen wanneer overlay actief is
    const hideStyle = document.createElement('style');
    hideStyle.id = 'tv-hide-style';
    hideStyle.textContent = `
        html, body {
            background-color: #121212 !important;
            overflow: hidden !important;
        }
        body > *:not(#tv-ui-host):not(#tv-fab-btn) {
            display: none !important;
        }
    `;
    (document.head || document.documentElement).appendChild(hideStyle);

    // State management & sessionStorage uitlezen
    const savedSort = sessionStorage.getItem('tv_ui_sort');
    let state = {
        query: '',
        sort: savedSort || 'relevance',
        playable: true,
        offset: 0,
        limit: 24,
        items: [],
        total: 0,
        isLoading: false,
        focusZone: 'grid', // 'nav' of 'grid'
        navFocusIndex: 0,
        gridFocusIndex: 0,
        logs: [],
        overlayVisible: true
    };

    function addLog(msg) {
        const timestamp = new Date().toISOString().substring(11, 19);
        const logLine = `[${timestamp}] ${msg}`;
        state.logs.push(logLine);
        console.log('[TV-UI Debug]', msg);
        
        const logContainer = shadow.getElementById('tv-debug-console');
        if (logContainer) {
            logContainer.textContent = state.logs.join('\n');
            logContainer.scrollTop = logContainer.scrollHeight;
        }
    }

    // Maak host container voor Shadow DOM
    const host = document.createElement('div');
    host.id = 'tv-ui-host';
    host.style.cssText = 'position: fixed !important; top: 0 !important; left: 0 !important; width: 100vw !important; height: 100dvh !important; z-index: 2147483646 !important; background-color: #121212 !important; display: block !important;';
    
    const shadow = host.attachShadow({ mode: 'open' });

    // CSS styling binnen Shadow DOM
    const style = document.createElement('style');
    style.textContent = `
        * {
            box-sizing: border-box;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            margin: 0;
            padding: 0;
        }

        #tv-ui-root {
            width: 100%;
            height: 100dvh;
            background-color: #121212;
            color: #ffffff;
            display: flex;
            flex-direction: column;
            padding: 24px 40px;
            padding-bottom: max(24px, env(safe-area-inset-bottom, 24px));
            overflow: hidden;
            user-select: none;
            -webkit-user-select: none;
        }

        .tv-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 20px;
            margin-bottom: 16px;
            background: #1e1e1e;
            padding: 16px 24px;
            border-radius: 12px;
            flex-shrink: 0;
        }

        .tv-nav-group {
            display: flex;
            align-items: center;
            gap: 16px;
            flex-wrap: wrap;
            flex: 1;
        }

        .tv-input, .tv-button, .tv-select {
            background: #2a2a2a;
            color: #fff;
            border: 2px solid #333;
            padding: 12px 20px;
            border-radius: 8px;
            font-size: 18px;
            font-weight: 600;
            outline: none;
            cursor: pointer;
            touch-action: manipulation;
            user-select: text;
            -webkit-user-select: text;
        }

        .tv-button, .tv-select {
            user-select: none;
            -webkit-user-select: none;
        }

        .tv-button:active, .tv-button:hover {
            background-color: #3a3a3a;
        }

        .tv-focusable.tv-focused {
            border-color: #05C8F0 !important;
            background-color: #3a3a3a !important;
            transform: scale(1.02);
            box-shadow: 0 0 15px rgba(5, 200, 240, 0.6);
            transition: transform 0.15s ease, border-color 0.15s ease;
        }

        .tv-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 24px;
            overflow-y: auto;
            padding: 12px 4px;
            flex: 1;
            -webkit-overflow-scrolling: touch;
        }

        .tv-card {
            background: #1e1e1e;
            border-radius: 10px;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            border: 3px solid transparent;
            cursor: pointer;
            touch-action: manipulation;
            min-height: 240px;
            width: 100%;
        }

        .tv-card-thumb {
            width: 100%;
            aspect-ratio: 16 / 9;
            height: auto;
            min-height: 140px;
            background-color: #000;
            object-fit: cover;
            display: block;
        }

        .tv-card-body {
            padding: 14px;
            display: flex;
            flex-direction: column;
            gap: 6px;
            flex: 1;
        }

        .tv-card-title {
            font-size: 16px;
            font-weight: bold;
            white-space: normal;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
            margin: 0;
            color: #fff;
            line-height: 1.3;
        }

        .tv-card-meta {
            font-size: 13px;
            color: #aaa;
            display: flex;
            justify-content: space-between;
            margin-top: auto;
            padding-top: 8px;
        }

        .tv-badge {
            background: #FF00BC;
            color: #fff;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: bold;
            text-transform: uppercase;
            align-self: flex-start;
        }

        .tv-counter {
            font-size: 18px;
            color: #888;
            font-weight: bold;
            white-space: nowrap;
        }

        .tv-status-msg {
            grid-column: 1 / -1;
            text-align: center;
            padding: 20px;
            font-size: 18px;
            color: #aaa;
        }

        /* Debug Panel */
        .tv-debug-panel {
            background: #000;
            border: 1px solid #444;
            border-radius: 8px;
            padding: 10px;
            margin-top: 8px;
            height: 110px;
            display: flex;
            flex-direction: column;
            gap: 6px;
            flex-shrink: 0;
        }

        .tv-debug-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .tv-debug-title {
            font-size: 12px;
            color: #05C8F0;
            font-weight: bold;
        }

        .tv-debug-console {
            font-family: monospace;
            font-size: 11px;
            color: #00ff00;
            white-space: pre-wrap;
            word-break: break-all;
            overflow-y: auto;
            flex: 1;
            background: #080808;
            padding: 6px;
            border-radius: 4px;
        }

        /* Responsive Mobiel / Portrait Modus */
        @media (max-width: 768px), (orientation: portrait) {
            #tv-ui-root {
                padding: 12px;
                padding-bottom: max(12px, env(safe-area-inset-bottom, 12px));
            }

            .tv-header {
                flex-direction: column;
                align-items: stretch;
                gap: 12px;
                padding: 12px;
                margin-bottom: 12px;
            }

            .tv-nav-group {
                gap: 8px;
            }

            .tv-input, .tv-button, .tv-select {
                font-size: 14px;
                padding: 10px 12px;
                flex: 1 1 auto;
            }

            .tv-grid {
                grid-template-columns: repeat(1, 1fr);
                gap: 16px;
            }

            .tv-card {
                min-height: 260px;
            }

            .tv-counter {
                font-size: 14px;
                text-align: right;
            }
        }
    `;

    const root = document.createElement('div');
    root.id = 'tv-ui-root';
    root.innerHTML = `
        <div class="tv-header">
            <div class="tv-nav-group">
                <input type="text" id="tv-search" class="tv-input tv-focusable" placeholder="Zoek op titel of persoon..." value="" />
                <button type="button" id="tv-btn-search" class="tv-button tv-focusable">Zoeken</button>
                <select id="tv-sort" class="tv-select tv-focusable">
                    <option value="relevance" ${state.sort === 'relevance' ? 'selected' : ''}>Relevantie</option>
                    <option value="date-oldest" ${state.sort === 'date-oldest' ? 'selected' : ''}>Oudste eerst</option>
                    <option value="date-newest" ${state.sort === 'date-newest' ? 'selected' : ''}>Nieuwste eerst</option>
                </select>
                <button type="button" id="tv-btn-playable" class="tv-button tv-focusable">Afspeelbaar: JA</button>
            </div>
            <div class="tv-counter" id="tv-counter">Laden...</div>
        </div>
        <div class="tv-grid" id="tv-grid">
            <div class="tv-status-msg">Resultaten worden geladen...</div>
        </div>
        <div class="tv-debug-panel">
            <div class="tv-debug-header">
                <span class="tv-debug-title">DEBUG LOGS &amp; HTML DUMP</span>
                <button type="button" id="tv-btn-copy-logs" class="tv-button" style="padding:4px 12px; font-size:12px;">Kopieer Logs &amp; HTML</button>
            </div>
            <div class="tv-debug-console" id="tv-debug-console">Initialiseren...</div>
        </div>
    `;

    shadow.appendChild(style);
    shadow.appendChild(root);

    // Maak zwevende actieknop (FAB) voor UI inschakelen/uitschakelen
    const fab = document.createElement('button');
    fab.id = 'tv-fab-btn';
    fab.textContent = 'TV UI';
    fab.style.cssText = 'position: fixed !important; bottom: max(20px, env(safe-area-inset-bottom, 20px)) !important; right: 20px !important; z-index: 2147483647 !important; background: #FF00BC !important; color: #ffffff !important; border: 2px solid #ffffff !important; border-radius: 28px !important; padding: 10px 18px !important; font-weight: bold !important; font-size: 14px !important; box-shadow: 0 4px 12px rgba(0,0,0,0.6) !important; cursor: pointer !important; outline: none !important; user-select: none !important; -webkit-user-select: none !important;';

    function toggleOverlay(show) {
        state.overlayVisible = typeof show === 'boolean' ? show : !state.overlayVisible;
        if (state.overlayVisible) {
            host.style.display = 'block';
            hideStyle.disabled = false;
            fab.style.background = '#FF00BC';
            fab.textContent = 'TV UI';
        } else {
            host.style.display = 'none';
            hideStyle.disabled = true;
            fab.style.background = '#2a2a2a';
            fab.textContent = 'Open TV UI';
        }
    }

    fab.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleOverlay();
    });

    function mountUI() {
        const parent = document.documentElement || document.body;
        if (parent) {
            if (!parent.contains(host)) parent.appendChild(host);
            if (!parent.contains(fab)) parent.appendChild(fab);
        }
    }

    mountUI();

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mountUI);
    }

    const observer = new MutationObserver(mountUI);
    observer.observe(document.documentElement, { childList: true, subtree: true });

    function getImageUrl(item) {
        if (!item || !item.image) return '';
        if (typeof item.image === 'string') return item.image;
        if (item.image.url) return item.image.url;
        return '';
    }

    // API Data ophalen met doorgestuurde zoekfilter en optioneel willekeurige pagina bij lege zoekopdracht
    async function loadData() {
        state.isLoading = true;
        const grid = shadow.getElementById('tv-grid');
        const counter = shadow.getElementById('tv-counter');

        if (grid) grid.innerHTML = '<div class="tv-status-msg">Bezig met zoeken...</div>';
        if (counter) counter.textContent = 'Laden...';

        const baseUrl = window.__CONFIG__?.CLIENT_API_URL || 'https://schatkamer.beeldengeluid.nl/api/media/bff';

        function buildUrl(offsetToUse) {
            const filtersObj = {
                playable: state.playable ? 'true' : 'false',
                sort: state.sort
            };

            if (state.query) {
                filtersObj.q = state.query;
                filtersObj.query = state.query;
            }

            const params = new URLSearchParams();
            if (state.query) {
                params.append('q', state.query);
                params.append('query', state.query);
            }
            params.append('sort', state.sort);
            params.append('playable', state.playable ? 'true' : 'false');
            params.append('limit', state.limit.toString());
            params.append('offset', offsetToUse.toString());
            params.append('filters', JSON.stringify(filtersObj));

            return `${baseUrl}/search?${params.toString()}`;
        }

        try {
            let targetOffset = state.offset;

            // Bij een lege zoekopdracht op de eerste pagina: bepaal eerst een willekeurige pagina
            if (!state.query && state.offset === 0) {
                const initUrl = buildUrl(0);
                addLog(`Fetching initial count for random page selection...`);
                const initRes = await fetch(initUrl, { headers: { 'Accept': 'application/json' } });
                
                if (initRes.ok) {
                    const initData = await initRes.json();
                    const totalItems = typeof initData.total === 'number' ? initData.total : (initData.data?.total || 0);
                    if (totalItems > 0) {
                        const totalPages = Math.ceil(totalItems / state.limit);
                        const randomPage = Math.floor(Math.random() * totalPages);
                        targetOffset = randomPage * state.limit;
                        addLog(`Random page selected: ${randomPage + 1} of ${totalPages} (offset: ${targetOffset})`);

                        if (targetOffset === 0) {
                            const results = initData.results || initData.data?.results || [];
                            state.items = results;
                            state.total = totalItems;
                            renderGrid();
                            return;
                        }
                    }
                }
            }

            const fetchUrl = buildUrl(targetOffset);
            addLog(`Fetching API: ${fetchUrl}`);

            const res = await fetch(fetchUrl, {
                headers: { 'Accept': 'application/json' }
            });

            addLog(`HTTP Status: ${res.status} ${res.statusText}`);

            if (!res.ok) {
                const errText = await res.text();
                addLog(`HTTP Err Body: ${errText.substring(0, 150)}`);
                throw new Error(`HTTP ${res.status}`);
            }

            const data = await res.json();
            const results = data.results || data.data?.results || [];
            const total = typeof data.total === 'number' ? data.total : (data.data?.total || 0);

            addLog(`API Response parsed. Total: ${total}, Results: ${results.length}`);

            state.items = results;
            state.total = total;
            state.offset = targetOffset;
            renderGrid();
        } catch (err) {
            addLog(`Fetch Fout: ${err.message}`);
            if (grid) grid.innerHTML = `<div class="tv-status-msg">Fout bij laden van gegevens (${err.message})</div>`;
            if (counter) counter.textContent = 'Fout';
        } finally {
            state.isLoading = false;
        }
    }

    function getGridColumns() {
        if (window.innerWidth <= 768 || window.innerHeight > window.innerWidth) {
            return 1;
        }
        return 4;
    }

    function renderGrid() {
        const grid = shadow.getElementById('tv-grid');
        const counter = shadow.getElementById('tv-counter');
        if (!grid || !counter) return;

        grid.innerHTML = '';
        counter.textContent = `${state.total.toLocaleString('nl-NL')} resultaten`;

        if (state.items.length === 0) {
            grid.innerHTML = '<div class="tv-status-msg">Geen resultaten gevonden.</div>';
            return;
        }

        state.items.forEach((item, index) => {
            const card = document.createElement('div');
            card.className = 'tv-card tv-focusable';
            card.dataset.index = index;

            const imgUrl = getImageUrl(item);

            card.innerHTML = `
                ${imgUrl 
                    ? `<img class="tv-card-thumb" src="${imgUrl}" alt="" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" /><div class="tv-card-thumb" style="display:none;align-items:center;justify-content:center;color:#555;">AFBEELDING MISLUKT</div>` 
                    : `<div class="tv-card-thumb" style="display:flex;align-items:center;justify-content:center;color:#555;">GEEN AFBEELDING</div>`}
                <div class="tv-card-body">
                    <span class="tv-badge">${item.mediaType || 'Media'}</span>
                    <h3 class="tv-card-title">${item.title || 'Zonder titel'}</h3>
                    <div class="tv-card-meta">
                        <span>${item.date ? new Date(item.date).toLocaleDateString('nl-NL') : ''}</span>
                        <span>${item.broadcaster || ''}</span>
                    </div>
                </div>
            `;

            const handleCardClick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                state.focusZone = 'grid';
                state.gridFocusIndex = index;
                updateFocus();
                if (item.url) window.location.href = item.url;
            };

            card.addEventListener('click', handleCardClick);
            grid.appendChild(card);
        });

        updateFocus();
    }

    function updateFocus() {
        shadow.querySelectorAll('.tv-focusable').forEach(el => el.classList.remove('tv-focused'));

        if (state.focusZone === 'nav') {
            const navElements = [
                shadow.getElementById('tv-search'),
                shadow.getElementById('tv-btn-search'),
                shadow.getElementById('tv-sort'),
                shadow.getElementById('tv-btn-playable')
            ];
            const target = navElements[state.navFocusIndex];
            if (target) {
                target.classList.add('tv-focused');
                target.focus();
            }
        } else if (state.focusZone === 'grid') {
            const cards = shadow.querySelectorAll('.tv-grid .tv-card');
            if (cards.length > 0) {
                if (state.gridFocusIndex >= cards.length) state.gridFocusIndex = cards.length - 1;
                if (state.gridFocusIndex < 0) state.gridFocusIndex = 0;
                const target = cards[state.gridFocusIndex];
                if (target) {
                    target.classList.add('tv-focused');
                    target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            }
        }
    }

    function executeSearch() {
        const searchInput = shadow.getElementById('tv-search');
        if (searchInput) {
            state.query = searchInput.value.trim();
            addLog(`executeSearch() aangeroepen met query: "${state.query}"`);
            searchInput.blur();
        }
        state.offset = 0;
        loadData();
    }

    // D-Pad Event Listener
    window.addEventListener('keydown', (e) => {
        if (!state.overlayVisible) return;

        const activeEl = shadow.activeElement;
        const isSearchInputFocused = activeEl && activeEl.id === 'tv-search';

        if (isSearchInputFocused && ['ArrowLeft', 'ArrowRight', 'Backspace'].includes(e.key) && e.key !== 'Enter') {
            return;
        }

        const cols = getGridColumns();

        switch (e.key) {
            case 'ArrowLeft':
                if (state.focusZone === 'nav') {
                    if (state.navFocusIndex > 0) state.navFocusIndex--;
                } else if (state.focusZone === 'grid') {
                    if (state.gridFocusIndex % cols !== 0) state.gridFocusIndex--;
                }
                updateFocus();
                break;

            case 'ArrowRight':
                if (state.focusZone === 'nav') {
                    if (state.navFocusIndex < 3) state.navFocusIndex++;
                } else if (state.focusZone === 'grid') {
                    if ((state.gridFocusIndex + 1) % cols !== 0 && state.gridFocusIndex < state.items.length - 1) {
                        state.gridFocusIndex++;
                    }
                }
                updateFocus();
                break;

            case 'ArrowUp':
                if (state.focusZone === 'grid') {
                    if (state.gridFocusIndex < cols) {
                        state.focusZone = 'nav';
                    } else {
                        state.gridFocusIndex -= cols;
                    }
                }
                updateFocus();
                break;

            case 'ArrowDown':
                if (state.focusZone === 'nav') {
                    if (state.items.length > 0) state.focusZone = 'grid';
                } else if (state.focusZone === 'grid') {
                    if (state.gridFocusIndex + cols < state.items.length) {
                        state.gridFocusIndex += cols;
                    }
                }
                updateFocus();
                break;

            case 'Enter':
                if (state.focusZone === 'nav') {
                    if (state.navFocusIndex === 0 || state.navFocusIndex === 1) {
                        executeSearch();
                    } else if (state.navFocusIndex === 3) {
                        state.playable = !state.playable;
                        shadow.getElementById('tv-btn-playable').textContent = `Afspeelbaar: ${state.playable ? 'JA' : 'NEE'}`;
                        state.offset = 0;
                        loadData();
                    }
                } else if (state.focusZone === 'grid') {
                    const item = state.items[state.gridFocusIndex];
                    if (item && item.url) window.location.href = item.url;
                }
                break;

            case 'Escape':
            case 'Back':
            case 'GoBack':
                if (state.focusZone === 'grid') {
                    state.focusZone = 'nav';
                    updateFocus();
                } else if (state.focusZone === 'nav') {
                    toggleOverlay(false);
                }
                break;
        }
    });

    // Koppel event listeners
    const btnSearch = shadow.getElementById('tv-btn-search');
    const btnPlayable = shadow.getElementById('tv-btn-playable');
    const selectSort = shadow.getElementById('tv-sort');
    const inputSearch = shadow.getElementById('tv-search');
    const btnCopyLogs = shadow.getElementById('tv-btn-copy-logs');

    if (btnCopyLogs) {
        btnCopyLogs.addEventListener('click', () => {
            const logsText = state.logs.join('\n');
            const htmlDump = shadow.innerHTML;
            const fullOutput = `=== DEBUG LOGS ===\n${logsText}\n\n=== OVERLAY HTML DUMP ===\n${htmlDump}`;

            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(fullOutput).then(() => {
                    alert('Logs & HTML succesvol gekopieerd naar klembord!');
                }).catch(err => {
                    alert(fullOutput);
                });
            } else {
                alert(fullOutput);
            }
        });
    }

    if (btnSearch) {
        btnSearch.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            executeSearch();
        });
    }

    if (inputSearch) {
        inputSearch.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                executeSearch();
            }
        });
    }

    if (btnPlayable) {
        btnPlayable.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            state.playable = !state.playable;
            btnPlayable.textContent = `Afspeelbaar: ${state.playable ? 'JA' : 'NEE'}`;
            state.offset = 0;
            loadData();
        });
    }

    if (selectSort) {
        selectSort.addEventListener('change', (e) => {
            e.stopPropagation();
            state.sort = e.target.value;
            sessionStorage.setItem('tv_ui_sort', state.sort);
            state.offset = 0;
            loadData();
        });
    }

    addLog(`Userscript V2.6 gestart (Sort: ${state.sort})`);
    loadData();
})();
// ==/UserScript==