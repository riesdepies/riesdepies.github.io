// ==UserScript==
// @name Custom UI for 111movies.com
// @namespace http://tampermonkey.net/
// @version 3.5
// @description Custom UI met prioriteit voor NL/EN, herstelde iconen, mobile scrubbing en een betrouwbare Play/Pause overlay.
// @author Assistent
// @match *://111movies.com/*
// @grant none
// ==/UserScript==

(function() {
'use strict';

const hideStyles = `
.fluid_controls_container, 
.fluid_controls_timeline_syncer,
.fluid_html_on_pause, 
.css-9sg0ji, 
.css-1uq4pbw, 
#player-controls,
.css-rauu36, 
.css-1wp7y37, 
.css-pfqu4m, 
.css-6ajy59, 
.fluid_initial_play, 
.hide_button,
.fluid_subtitles_container, 
.fluid_tooltip, 
.tooltiptext, 
.tooltip,
.subtitles_menu,
.MuiPaper-root,
.MuiTooltip-popper {
    position: fixed !important;
    left: -9999px !important;
    top: -9999px !important;
    display: block !important; 
    visibility: hidden !important;
    opacity: 0 !important;
    pointer-events: none !important;
}

#custom-click-overlay {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    z-index: 2147483645;
    background: transparent;
}

#custom-subtitles-overlay {
    position: fixed;
    bottom: 15%;
    left: 0;
    right: 0;
    pointer-events: none;
    text-align: center;
    z-index: 2147483646;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
}

.custom-sub-text {
    background: none !important; 
    color: #ffffff;
    padding: 0.2em 0.6em;
    font-family: sans-serif;
    font-weight: 600;
    text-shadow: 
        -1.5px -1.5px 0 #000,  
         1.5px -1.5px 0 #000,
        -1.5px  1.5px 0 #000,
         1.5px  1.5px 0 #000,
         0px 0px 5px rgba(0,0,0,0.8);
    margin-bottom: 0.2em;
    max-width: 90%;
    line-height: 1.2;
    white-space: pre-wrap;
    font-size: 22px;
}

@media screen and (max-width: 600px) and (orientation: portrait) {
    .custom-sub-text { font-size: 16px; max-width: 95%; }
}

#custom-player-wrapper {
    position: fixed;
    bottom: 0; left: 0; right: 0;
    padding: 40px 20px 20px 20px;
    background: linear-gradient(transparent, rgba(0,0,0,0.85));
    z-index: 2147483647;
    font-family: sans-serif;
    transition: opacity 0.4s ease, transform 0.4s ease;
    opacity: 0;
    transform: translateY(10px);
    user-select: none;
    pointer-events: auto;
}

#custom-player-wrapper.visible { opacity: 1; transform: translateY(0); }

.controls-main-row { 
    display: flex; 
    align-items: center; 
    justify-content: space-between; 
    height: 50px; 
    position: relative; 
}

.controls-left, .controls-right { display: flex; align-items: center; gap: 15px; }

.control-btn {
    background: none; border: none; color: white; padding: 8px;
    cursor: pointer; display: flex;
    align-items: center; justify-content: center;
}

.control-btn svg { width: 32px; height: 32px; fill: white; }

.time-display { 
    color: white; 
    font-size: 14px; 
    font-family: monospace; 
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    white-space: nowrap;
}

.progress-container {
    width: 100%; height: 20px; background: transparent;
    margin-bottom: 5px; border-radius: 10px; cursor: pointer;
    position: relative;
    display: flex;
    align-items: center;
    touch-action: none;
}

.progress-track {
    width: 100%; height: 6px; background: rgba(255,255,255,0.2);
    border-radius: 10px; position: relative;
}

.progress-bar-fill { height: 100%; background: #0057B8; width: 0%; border-radius: 10px; pointer-events: none; }

.progress-knob {
    position: absolute; left: 0%; top: 50%; width: 16px; height: 16px;
    background: white; border-radius: 50%; transform: translate(-50%, -50%);
    box-shadow: 0 0 5px rgba(0,0,0,0.5); pointer-events: none;
}

#cust-cc-menu {
    position: absolute; bottom: 110%; right: 0;
    background: rgba(10, 10, 10, 0.95);
    border: 1px solid #444; border-radius: 8px;
    display: none; flex-direction: column; min-width: 100px; overflow: hidden;
    box-shadow: 0 4px 15px rgba(0,0,0,0.5);
}
.cc-menu-item {
    padding: 12px 24px; color: white; cursor: pointer; text-align: center;
    font-weight: bold; border-bottom: 1px solid #333; font-size: 14px;
}
.cc-menu-item:hover { background: rgba(255,255,255,0.1); }
.cc-menu-item.active { color: #0057B8; }
`;

const styleElement = document.createElement("style");
styleElement.innerHTML = hideStyles;
document.head.appendChild(styleElement);

const icons = {
    play: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>',
    pause: '<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>',
    cc_on: `<svg viewBox="0 0 24 24"><path d="M19,4H5C3.9,4,3,4.9,3,6v12c0,1.1,0.9,2,2,2h14c1.1,0,2-0.9,2-2V6C21,4.9,20.1,4,19,4z M11,14c0,0.5-0.4,1-1,1H7 c-0.5,0-1-0.4-1-1v-4c0-0.5,0.4-1,1-1h3c0.5,0,1,0.4,1,1v1H9.5v-.5h-2v3h2V13H11V14z M18,14c0,0.5-0.4,1-1,1h-3c-0.5,0-1-0.4-1-1v-4 c0-0.5,0.4-1,1-1h3c0.5,0,1,0.4,1,1v1H16.5v-.5h-2v3h2V13H18V14z" fill="white"/></svg>`,
    cc_off: `<svg viewBox="0 0 24 24"><path d="M19,4H5C3.9,4,3,4.9,3,6v12c0,1.1,0.9,2,2,2h14c1.1,0,2-0.9,2-2V6C21,4.9,20.1,4,19,4z M20,18c0,0.5-0.5,1-1,1H5 c-0.5,0-1-0.5-1-1V6c0-0.5,0.5-1,1-1h14c0.5,0,1,0.4,1,1V18z M7,15h3c0.5,0,1-0.4,1-1v-1H9.5v0.5h-2v-3h2v0.5H11v-1 c0-0.5-0.4-1-1-1H7c-0.5,0-1,0.4-1,1v4C6,14.6,6.4,15,7,15z M14,15h3c0.5,0,1-0.4,1-1v-1h-1.5v0.5h-2v-3h2v0.5H18v-1 c0-0.5-0.4-1-1-1h-3c-0.5,0-1-0.4-1,1v4C13,14.6,13.4,15,14,15z" fill="white" fill-opacity="0.9"/></svg>`
};

let ccActive = false;
let currentLang = 'off'; 
let autoSearchActive = false;
let isDragging = false;
let ccMenuOpen = false;

function isDutch(label) {
    const l = (label || "").toLowerCase();
    return l.includes('dutch') || l.includes('nederlands');
}

function isEnglish(label) {
    const l = (label || "").toLowerCase();
    return l.includes('english');
}

function formatTime(seconds) {
    if (isNaN(seconds)) return "00:00";
    const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60), s = Math.floor(seconds % 60);
    return (h > 0 ? h + ":" : "") + m.toString().padStart(2, '0') + ":" + s.toString().padStart(2, '0');
}

function humanClick(el) {
    if (!el) return;
    el.removeAttribute('title');
    const events = ['mouseover', 'mousedown', 'mouseup', 'click'];
    events.forEach(type => {
        el.dispatchEvent(new MouseEvent(type, { view: window, bubbles: true, cancelable: true, buttons: 1 }));
    });
}

function autoSelectSubtitles(video) {
    if (autoSearchActive) return;
    autoSearchActive = true;
    const tryClickLanguage = (langs) => {
        const menuItems = document.querySelectorAll('.MuiMenuItem-root, .subtitle-menu-option, .subtitles_list div');
        for (let lang of langs) {
            for (let item of menuItems) {
                const text = item.textContent.trim().toLowerCase();
                if (text === lang || text.includes(`${lang} (`)) {
                    humanClick(item);
                    ccActive = true;
                    currentLang = (lang === 'english') ? 'en' : 'nl';
                    return true;
                }
            }
        }
        return false;
    };
    const subBtn = document.querySelector('button[aria-label="Subtitles"]') || document.querySelector('.fluid_control_subtitles') || document.querySelector('[data-tool="subtitles"]');
    if (subBtn) {
        humanClick(subBtn);
        let attempts = 0;
        const interval = setInterval(() => {
            if (tryClickLanguage(['dutch', 'nederlands', 'english']) || attempts > 25) {
                clearInterval(interval);
                autoSearchActive = false;
            }
            attempts++;
        }, 200);
    } else { autoSearchActive = false; }
}

function renderManualSubtitles(video) {
    const overlay = document.getElementById('custom-subtitles-overlay');
    if (!overlay || !ccActive || currentLang === 'off') {
        if (overlay) overlay.innerHTML = '';
        return;
    }
    const tracks = Array.from(video.textTracks);
    const activeTrack = tracks.find(t => (currentLang === 'nl' && isDutch(t.label)) || (currentLang === 'en' && isEnglish(t.label)));

    if (activeTrack) {
        if (activeTrack.mode !== 'hidden') activeTrack.mode = 'hidden'; 

        if (activeTrack.activeCues && activeTrack.activeCues.length > 0) {
            let html = '';
            for (let j = 0; j < activeTrack.activeCues.length; j++) {
                const text = activeTrack.activeCues[j].text.replace(/<[^>]*>/g, '');
                html += `<div class="custom-sub-text">${text}</div>`;
            }
            overlay.innerHTML = html;
        } else {
            overlay.innerHTML = '';
        }
    }
}

function updateTrackModes(video) {
    const tracks = Array.from(video.textTracks);
    tracks.forEach(t => {
        const isTarget = (currentLang === 'nl' && isDutch(t.label)) || (currentLang === 'en' && isEnglish(t.label));
        if (ccActive && isTarget) {
            t.mode = 'hidden';
        } else {
            t.mode = 'disabled';
        }
    });

    // Icoon update voor de hoofdknop
    const ccBtn = document.getElementById('cust-cc-btn');
    if (ccBtn) {
        ccBtn.innerHTML = ccActive ? icons.cc_on : icons.cc_off;
    }
}

function buildCCMenu(video) {
    const menu = document.getElementById('cust-cc-menu');
    if (!menu) return;
    const tracks = Array.from(video.textTracks);
    const hasNL = tracks.some(t => isDutch(t.label));
    const hasEN = tracks.some(t => isEnglish(t.label));
    
    let langs = ['OFF'];
    if (hasEN) langs.unshift('EN');
    if (hasNL) langs.unshift('NL');

    menu.innerHTML = '';
    langs.forEach(l => {
        const item = document.createElement('div');
        item.className = 'cc-menu-item';
        const val = l.toLowerCase();
        if (currentLang === val) item.classList.add('active');
        item.innerText = l;
        item.onclick = (e) => {
            e.stopPropagation();
            if (val === 'off') {
                ccActive = false;
                currentLang = 'off';
            } else {
                ccActive = true;
                currentLang = val;
            }
            updateTrackModes(video);
            menu.style.display = 'none';
            ccMenuOpen = false;
        };
        menu.appendChild(item);
    });

    const ccBtn = document.getElementById('cust-cc-btn');
    if (ccBtn) ccBtn.style.display = (langs.length > 1) ? 'flex' : 'none';
}

function createUI(video) {
    if (document.getElementById('custom-player-wrapper')) return;

    const clickOverlay = document.createElement('div');
    clickOverlay.id = 'custom-click-overlay';
    document.body.appendChild(clickOverlay);
    clickOverlay.onclick = () => { video.paused ? video.play() : video.pause(); };

    const subOverlay = document.createElement('div');
    subOverlay.id = 'custom-subtitles-overlay';
    document.body.appendChild(subOverlay);

    const wrapper = document.createElement('div');
    wrapper.id = 'custom-player-wrapper';
    wrapper.innerHTML = `
    <div class="progress-container" id="cust-p-cont">
        <div class="progress-track">
            <div class="progress-bar-fill" id="cust-p-fill"></div>
            <div class="progress-knob" id="cust-p-knob"></div>
        </div>
    </div>
    <div class="controls-main-row">
        <div class="controls-left"><button class="control-btn" id="cust-play-btn">${icons.play}</button></div>
        <div class="time-display"><span id="cust-curr">00:00</span> / <span id="cust-tot">00:00</span></div>
        <div class="controls-right" style="position:relative;">
            <div id="cust-cc-menu"></div>
            <button class="control-btn" id="cust-cc-btn" style="display:none;">${icons.cc_off}</button>
        </div>
    </div>`;

    document.body.appendChild(wrapper);

    const playBtn = document.getElementById('cust-play-btn'),
    ccBtn = document.getElementById('cust-cc-btn'),
    ccMenu = document.getElementById('cust-cc-menu'),
    pCont = document.getElementById('cust-p-cont'),
    pFill = document.getElementById('cust-p-fill'),
    pKnob = document.getElementById('cust-p-knob'),
    cTime = document.getElementById('cust-curr'),
    tTime = document.getElementById('cust-tot');

    playBtn.onclick = (e) => { e.stopPropagation(); video.paused ? video.play() : video.pause(); };
    ccBtn.onclick = (e) => { 
        e.stopPropagation(); 
        ccMenuOpen = !ccMenuOpen;
        if (ccMenuOpen) buildCCMenu(video);
        ccMenu.style.display = ccMenuOpen ? 'flex' : 'none';
    };

    const updateProgressUI = (perc) => {
        pFill.style.width = perc + '%';
        pKnob.style.left = perc + '%';
    };

    video.addEventListener('timeupdate', () => {
        if (video.duration && !isDragging) {
            const perc = (video.currentTime / video.duration * 100);
            updateProgressUI(perc);
            cTime.innerText = formatTime(video.currentTime);
            tTime.innerText = formatTime(video.duration);
        }
    });

    const getScrubPerc = (clientX) => {
        const rect = pCont.getBoundingClientRect();
        return Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    };

    const handleScrub = (e) => {
        const x = e.pageX || (e.touches ? e.touches[0].pageX : 0);
        const perc = getScrubPerc(x);
        updateProgressUI(perc);
        if (!isDragging) isDragging = true;
        if (e.type === 'mouseup' || e.type === 'touchend') {
            video.currentTime = (perc / 100) * video.duration;
            isDragging = false;
        }
    };

    pCont.addEventListener('mousedown', () => isDragging = true);
    window.addEventListener('mousemove', (e) => isDragging && handleScrub(e));
    window.addEventListener('mouseup', (e) => isDragging && handleScrub(e));
    pCont.addEventListener('touchstart', (e) => { isDragging = true; handleScrub(e); }, {passive: false});
    window.addEventListener('touchmove', (e) => isDragging && handleScrub(e), {passive: false});
    window.addEventListener('touchend', (e) => isDragging && handleScrub(e));

    video.addEventListener('play', () => playBtn.innerHTML = icons.pause);
    video.addEventListener('pause', () => playBtn.innerHTML = icons.play);

    let idleTimer, hasStarted = false;
    const showUI = () => {
        wrapper.classList.add('visible');
        clearTimeout(idleTimer);
        if (!video.paused && !ccMenuOpen) idleTimer = setTimeout(() => wrapper.classList.remove('visible'), 3000);
    };

    video.addEventListener('playing', () => {
        if (!hasStarted) { 
            hasStarted = true; 
            setTimeout(() => autoSelectSubtitles(video), 2000);
        }
        showUI();
    });

    window.addEventListener('mousemove', showUI);
    window.addEventListener('touchstart', showUI);
    video.addEventListener('pause', showUI);

    setInterval(() => renderManualSubtitles(video), 100);
    setInterval(() => { if (!ccMenuOpen) buildCCMenu(video); updateTrackModes(video); }, 2000);
}

setInterval(() => { const v = document.querySelector('video'); if (v) createUI(v); }, 1000);

})();
