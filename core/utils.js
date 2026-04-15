// PHYAT Core Utilities
// Shared helpers for all features
// Author: Heitor Faria | License: GPL v3

window.PHYAT = window.PHYAT || {};

(function () {
  'use strict';

  const PHYAT_VERSION = '2.0.0';

  // ---- DOM helpers ----

  function waitForElement(selector, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const el = document.querySelector(selector);
      if (el) return resolve(el);

      const obs = new MutationObserver(() => {
        const el = document.querySelector(selector);
        if (el) { obs.disconnect(); resolve(el); }
      });
      obs.observe(document.body, { childList: true, subtree: true });

      setTimeout(() => {
        obs.disconnect();
        reject(new Error(`${selector} not found (${timeout}ms)`));
      }, timeout);
    });
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ---- Toast notifications ----

  function showToast(message, type = 'info') {
    const existing = document.getElementById('phyat-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'phyat-toast';
    toast.className = `phyat-toast phyat-toast-${type}`;
    toast.innerHTML = `
      <span class="phyat-toast-message">${escapeHtml(message)}</span>
      <button class="phyat-toast-close" aria-label="Close">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>
      </button>
    `;

    toast.querySelector('.phyat-toast-close').addEventListener('click', () => toast.remove());
    document.body.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add('phyat-toast-visible');
    });

    setTimeout(() => {
      toast.classList.remove('phyat-toast-visible');
      setTimeout(() => toast.remove(), 300);
    }, 6000);
  }

  // ---- Progress overlay ----

  let progressOverlay = null;

  function showProgress(current, total, message, title = 'Processing...') {
    if (!progressOverlay) {
      progressOverlay = document.createElement('div');
      progressOverlay.id = 'phyat-progress-overlay';
      document.body.appendChild(progressOverlay);
    }

    const percent = total > 0 ? Math.round((current / total) * 100) : 0;

    progressOverlay.innerHTML = `
      <div class="phyat-progress-container">
        <div class="phyat-progress-header">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="#FF0000"/>
          </svg>
          <h3>${escapeHtml(title)}</h3>
        </div>
        <div class="phyat-progress-info">
          <span>${current + 1} of ${total}</span>
          <span>${percent}%</span>
        </div>
        <div class="phyat-progress-bar">
          <div class="phyat-progress-fill" style="width: ${percent}%"></div>
        </div>
        <p class="phyat-progress-message">${escapeHtml(message)}</p>
      </div>
    `;

    progressOverlay.style.display = 'flex';
  }

  function hideProgress() {
    if (progressOverlay) {
      progressOverlay.style.display = 'none';
    }
  }

  // ---- Escape HTML ----

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ---- URL detection helpers ----

  function isStudioVideosPage() {
    return location.href.includes('studio.youtube.com') &&
           location.href.includes('/channel/') &&
           location.href.includes('/videos');
  }

  function isStudioEditPage() {
    return location.href.includes('studio.youtube.com') &&
           location.href.includes('/video/') &&
           location.href.includes('/edit');
  }

  function isYouTubeLivePage() {
    const url = location.href;
    if (!url.includes('youtube.com/watch')) return false;
    // Detect live by checking for live chat iframe or live badge
    return !!document.querySelector('yt-live-chat-renderer, #chat-frame, iframe[src*="live_chat"]');
  }

  function isYouTubeHomePage() {
    return location.hostname === 'www.youtube.com' &&
           (location.pathname === '/' || location.pathname === '');
  }

  function isYouTubeWatchPage() {
    return location.hostname === 'www.youtube.com' &&
           location.pathname === '/watch';
  }

  function extractVideoIdFromUrl() {
    // Studio: /video/VIDEO_ID/edit
    const studioMatch = location.href.match(/\/video\/([^/]+)/);
    if (studioMatch) return studioMatch[1];
    // YouTube: /watch?v=VIDEO_ID
    const params = new URLSearchParams(location.search);
    return params.get('v') || null;
  }

  // ---- SPA navigation observer ----

  function onUrlChange(callback) {
    let lastUrl = location.href;
    const observer = new MutationObserver(() => {
      const url = location.href;
      if (url !== lastUrl) {
        lastUrl = url;
        callback(url);
      }
    });
    observer.observe(document, { subtree: true, childList: true });
    return observer;
  }

  // Export to global namespace
  Object.assign(window.PHYAT, {
    VERSION: PHYAT_VERSION,
    waitForElement,
    sleep,
    showToast,
    showProgress,
    hideProgress,
    escapeHtml,
    isStudioVideosPage,
    isStudioEditPage,
    isYouTubeLivePage,
    isYouTubeHomePage,
    isYouTubeWatchPage,
    extractVideoIdFromUrl,
    onUrlChange
  });
})();
