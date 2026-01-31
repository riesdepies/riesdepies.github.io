// ==UserScript==
// @name         Remote Test Script
// @version      1.0
// @description  Test of de remote injectie van TV App Builder v8.5 werkt
// @match        *://*/*
// @grant        none
// ==UserScript==

(function() {
    'use strict';

    // Maak een zichtbare indicator aan
    const testBanner = document.createElement('div');
    testBanner.id = 'remote-test-banner';
    testBanner.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #10b981;
        color: white;
        padding: 10px 20px;
        font-family: sans-serif;
        font-weight: bold;
        border-radius: 8px;
        z-index: 999999;
        box-shadow: 0 4px 15px rgba(0,0,0,0.5);
        border: 2px solid white;
        pointer-events: none;
    `;
    testBanner.innerText = '✅ REMOTE SCRIPT ACTIVE (v8.5)';

    // Voeg toe aan de pagina
    document.body.appendChild(testBanner);

    // Log naar console voor debuggen
    console.log('TV App Builder: Remote script succesvol geladen.');
})();