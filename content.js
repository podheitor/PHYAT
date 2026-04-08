// PHYBRV - PodHeitor YouTube Bulk Related Video
// Content Script - Injected into YouTube Studio
// Author: Heitor Faria | License: GPL v3

(function () {
  'use strict';

  // Prevent double initialization
  if (window.__phybrv_initialized) return;
  window.__phybrv_initialized = true;

  const PHYBRV_VERSION = '1.2.0';
  const TASK_KEY = 'phybrv_task';
  const RESULT_KEY = 'phybrv_result';
  let fabButton = null;
  let progressOverlay = null;
  let modal = null;
  let bridgeReady = false;

  /**
   * Inject the page bridge script into the page context
   * This gives us access to ytcfg and YouTube's internal APIs
   */
  function injectPageBridge() {
    if (document.getElementById('phybrv-bridge-script')) return;

    const script = document.createElement('script');
    script.id = 'phybrv-bridge-script';
    script.src = chrome.runtime.getURL('page_bridge.js');
    script.onload = () => {
      console.log('[PHYBRV] Page bridge injected');
    };
    (document.head || document.documentElement).appendChild(script);

    // Listen for bridge ready signal
    window.addEventListener('message', (event) => {
      if (event.data?.source === 'phybrv-bridge' && event.data?.action === 'ready') {
        bridgeReady = true;
        console.log('[PHYBRV] Page bridge ready');
      }
    });
  }

  /**
   * Initialize the extension
   */
  function init() {
    console.log(`[PHYBRV v${PHYBRV_VERSION}] Initializing...`);
    injectPageBridge();
    checkPendingResults();

    if (isEditPage()) {
      // On edit page — check for pending automation after page loads
      setTimeout(() => checkPendingTask(), 4000);
    }

    waitForStudioPage();
  }

  /**
   * Wait for the YouTube Studio videos page to load
   */
  function waitForStudioPage() {
    const observer = new MutationObserver(() => {
      if (isVideosPage()) {
        injectFAB();
      } else {
        removeFAB();
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Also check immediately
    if (isVideosPage()) {
      injectFAB();
    }

    // Listen for navigation changes (YouTube Studio uses SPA routing)
    let lastUrl = location.href;
    new MutationObserver(() => {
      const url = location.href;
      if (url !== lastUrl) {
        lastUrl = url;
        setTimeout(() => {
          if (isVideosPage()) {
            injectFAB();
          } else {
            removeFAB();
          }
        }, 1000);
      }
    }).observe(document, { subtree: true, childList: true });
  }

  /**
   * Check if we're on the Videos content page
   */
  function isVideosPage() {
    return location.href.includes('/channel/') && location.href.includes('/videos');
  }

  function isEditPage() {
    return location.href.includes('/video/') && location.href.includes('/edit');
  }

  function extractVideoIdFromUrl() {
    const match = location.href.match(/\/video\/([^/]+)/);
    return match ? match[1] : null;
  }

  /**
   * Inject the floating action button
   */
  function injectFAB() {
    if (document.getElementById('phybrv-fab')) return;

    fabButton = document.createElement('div');
    fabButton.id = 'phybrv-fab';
    fabButton.innerHTML = `
      <button class="phybrv-fab-button" id="phybrv-fab-btn" title="PHYBRV - Set Related Video for Selected Videos">
        <div class="phybrv-fab-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z" fill="currentColor"/>
          </svg>
        </div>
        <span class="phybrv-fab-label">Set Related Video</span>
        <span class="phybrv-fab-badge" id="phybrv-fab-badge" style="display:none">0</span>
      </button>
    `;

    document.body.appendChild(fabButton);

    // Animate in
    requestAnimationFrame(() => {
      fabButton.classList.add('phybrv-fab-visible');
    });

    // Bind click
    document.getElementById('phybrv-fab-btn').addEventListener('click', handleFABClick);

    // Start monitoring checkbox selections
    monitorSelections();
  }

  /**
   * Remove the FAB
   */
  function removeFAB() {
    const fab = document.getElementById('phybrv-fab');
    if (fab) {
      fab.classList.remove('phybrv-fab-visible');
      setTimeout(() => fab.remove(), 300);
      fabButton = null;
    }
  }

  /**
   * Monitor video checkbox selections in YouTube Studio
   */
  function monitorSelections() {
    // YouTube Studio uses checkboxes to select videos
    // We'll periodically check for selected checkboxes
    setInterval(updateSelectionCount, 500);
  }

  /**
   * Get currently selected video IDs from the YouTube Studio video list
   */
  function getSelectedVideoIds() {
    const selected = [];

    // YouTube Studio uses iron-checkbox or paper-checkbox or ytcp-checkbox-lit
    // The video rows are in a table-like structure
    const rows = document.querySelectorAll('ytcp-video-row');

    rows.forEach(row => {
      const checkbox = row.querySelector('#checkbox') ||
                       row.querySelector('ytcp-checkbox-lit') ||
                       row.querySelector('#checkbox-container');

      if (checkbox) {
        const isChecked = checkbox.hasAttribute('checked') ||
                          checkbox.getAttribute('aria-checked') === 'true' ||
                          checkbox.classList.contains('checked');

        if (isChecked) {
          // Try to get the video ID from the row
          const link = row.querySelector('a[href*="/video/"]');
          if (link) {
            const match = link.href.match(/\/video\/([^/]+)/);
            if (match) {
              const title = row.querySelector('#video-title')?.textContent?.trim() || '';
              selected.push({ videoId: match[1], title });
            }
          }
        }
      }
    });

    return selected;
  }

  /**
   * Alternative method: get selected videos from Studio's selection bar
   */
  function getSelectedVideoIdsAlternative() {
    const selected = [];

    // Check if the bulk action bar is visible (appears when videos are selected)
    const selectionBar = document.querySelector('#select-bar') ||
                         document.querySelector('ytcp-table-select-bar');

    if (!selectionBar) return selected;

    // When videos are selected, the rows get a 'selected' attribute/class
    const rows = document.querySelectorAll('ytcp-video-row[selected], ytcp-video-row.selected, tr[selected]');

    rows.forEach(row => {
      const link = row.querySelector('a[href*="/video/"]');
      if (link) {
        const match = link.href.match(/\/video\/([^/]+)/);
        if (match) {
          const title = row.querySelector('#video-title')?.textContent?.trim() ||
                        row.querySelector('.video-title-text')?.textContent?.trim() || '';
          selected.push({ videoId: match[1], title });
        }
      }
    });

    return selected;
  }

  /**
   * Get all selected videos (tries multiple detection methods)
   */
  function getAllSelectedVideos() {
    let videos = getSelectedVideoIds();
    if (videos.length === 0) {
      videos = getSelectedVideoIdsAlternative();
    }
    return videos;
  }

  /**
   * Update the selection count badge
   */
  function updateSelectionCount() {
    const badge = document.getElementById('phybrv-fab-badge');
    if (!badge) return;

    const selected = getAllSelectedVideos();
    const count = selected.length;

    if (count > 0) {
      badge.textContent = count;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  }

  /**
   * Handle FAB button click
   */
  function handleFABClick() {
    const selectedVideos = getAllSelectedVideos();

    if (selectedVideos.length === 0) {
      showToast('⚠️ Please select at least one video using the checkboxes first.', 'warning');
      return;
    }

    console.log(`[PHYBRV] Opening modal for ${selectedVideos.length} selected videos`);

    // Create modal instance
    if (!modal) {
      modal = new PHYBRVModal();
    }

    modal.open((relatedVideo) => {
      console.log(`[PHYBRV] User selected related video: ${relatedVideo.title} (${relatedVideo.videoId})`);
      applyRelatedVideo(selectedVideos, relatedVideo);
    });
  }

  // ============================================================
  //  Task Queue (chrome.storage.local)
  // ============================================================

  function getTask() {
    return new Promise(resolve => {
      chrome.storage.local.get(TASK_KEY, d => resolve(d[TASK_KEY] || null));
    });
  }

  function setTask(task) {
    return chrome.storage.local.set({ [TASK_KEY]: task });
  }

  function clearTask() {
    return chrome.storage.local.remove(TASK_KEY);
  }

  // ============================================================
  //  Apply Related Video — stores task + navigates to edit page
  // ============================================================

  async function applyRelatedVideo(targetVideos, relatedVideo) {
    const task = {
      targetVideos,
      relatedVideo,
      returnUrl: window.location.href,
      currentIndex: 0,
      results: [],
      status: 'running'
    };
    await setTask(task);

    showProgress(0, targetVideos.length, 'Navigating to first video...');
    const firstId = targetVideos[0].videoId;
    window.location.href = `https://studio.youtube.com/video/${firstId}/edit`;
  }

  // ============================================================
  //  Pending task check — runs on edit page load
  // ============================================================

  async function checkPendingTask() {
    if (!isEditPage()) return;

    const task = await getTask();
    if (!task || task.status !== 'running') return;

    const currentId = extractVideoIdFromUrl();
    const expected = task.targetVideos[task.currentIndex];
    if (!expected || currentId !== expected.videoId) {
      console.log('[PHYBRV] Edit page does not match pending task video');
      return;
    }

    console.log(`[PHYBRV] Running automation for ${currentId} (${task.currentIndex + 1}/${task.targetVideos.length})`);
    await runEditPageAutomation(task);
  }

  // ============================================================
  //  Pending results — show toast when returning to videos list
  // ============================================================

  async function checkPendingResults() {
    const data = await new Promise(r => chrome.storage.local.get(RESULT_KEY, r));
    const result = data[RESULT_KEY];
    if (!result) return;

    chrome.storage.local.remove(RESULT_KEY);
    if (result.errorCount === 0) {
      showToast(`✅ Successfully set related video for ${result.successCount} video(s)!`, 'success');
    } else {
      showToast(`⚠️ ${result.successCount} succeeded, ${result.errorCount} failed. Check console (F12).`, 'warning');
      if (result.errors?.length) console.error('[PHYBRV] Failed:', result.errors);
    }
  }

  // ============================================================
  //  DOM automation on the video edit page
  // ============================================================

  async function runEditPageAutomation(task) {
    const video = task.targetVideos[task.currentIndex];
    showProgress(task.currentIndex, task.targetVideos.length, `Processing: ${video.title || video.videoId}`);

    try {
      // 1. Wait for the related-video picker to render
      const picker = await waitForElement('ytcp-shorts-content-links-picker', 25000);
      picker.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await sleep(800);

      // 2. Click dropdown trigger to open video-pick dialog
      const trigger = picker.querySelector('#linked-video-editor-link') ||
                      picker.querySelector('ytcp-text-dropdown-trigger');
      if (!trigger) throw new Error('Related-video dropdown trigger not found');

      const clickTarget = trigger.querySelector('ytcp-dropdown-trigger') || trigger;
      clickTarget.click();
      console.log('[PHYBRV] Opened related-video picker');

      // 3. Wait for the video-pick dialog
      const dialog = await waitForElement('ytcp-video-pick-dialog', 10000);
      await sleep(800);

      // 4. Search for the related video
      const searchInput = dialog.querySelector('#search-yours') ||
                          await waitForElement('#search-yours', 5000);
      searchInput.focus();
      searchInput.value = '';
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      await sleep(300);

      const searchTerm = (task.relatedVideo.title || '').substring(0, 60);
      searchInput.value = searchTerm;
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      searchInput.dispatchEvent(new Event('change', { bubbles: true }));
      searchInput.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }));
      console.log(`[PHYBRV] Searching for: ${searchTerm}`);
      await sleep(3000);

      // 5. Find and click the best-matching video card
      const cards = dialog.querySelectorAll('ytcp-entity-card');
      let bestCard = null;
      const targetTitle = (task.relatedVideo.title || '').toLowerCase();

      for (const card of cards) {
        const t = (card.querySelector('.title')?.textContent?.trim() || '').toLowerCase();
        if (t === targetTitle) { bestCard = card; break; }
        if (!bestCard && (t.includes(targetTitle) || targetTitle.includes(t))) bestCard = card;
      }
      if (!bestCard && cards.length > 0) bestCard = cards[0];
      if (!bestCard) throw new Error('No matching video found in picker');

      const cardContent = bestCard.querySelector('#content') || bestCard;
      cardContent.click();
      console.log('[PHYBRV] Selected video card');
      await sleep(1500);

      // 6. Close dialog if needed (done / select button)
      const stillOpen = document.querySelector('ytcp-video-pick-dialog');
      if (stillOpen) {
        const doneBtn = stillOpen.querySelector('#done-button, #select-button, ytcp-button[id*="done"], ytcp-button[id*="select"]');
        if (doneBtn) {
          (doneBtn.querySelector('button') || doneBtn).click();
          await sleep(1000);
        }
      }

      // 7. Click Save
      const saveEl = document.querySelector('ytcp-button#save, #save');
      if (!saveEl) throw new Error('Save button not found');

      const saveBtn = saveEl.querySelector('button') || saveEl;
      if (saveEl.getAttribute('aria-disabled') === 'true') {
        console.warn('[PHYBRV] Save button disabled — change may not have registered');
        await sleep(1000);
      }
      saveBtn.click();
      console.log('[PHYBRV] Clicked Save');

      // 8. Wait for save to complete
      await waitForSaveComplete();

      task.results.push({ videoId: video.videoId, success: true });
      console.log(`[PHYBRV] ✓ Done: ${video.videoId}`);
    } catch (err) {
      console.error(`[PHYBRV] ✗ Failed: ${video.videoId}`, err);
      task.results.push({ videoId: video.videoId, success: false, error: err.message });
    }

    // Advance to next video or finish
    task.currentIndex++;

    if (task.currentIndex >= task.targetVideos.length) {
      task.status = 'completed';
      await setTask(task);

      const ok = task.results.filter(r => r.success).length;
      const fail = task.results.filter(r => !r.success).length;
      await chrome.storage.local.set({
        [RESULT_KEY]: { successCount: ok, errorCount: fail, total: task.targetVideos.length, errors: task.results.filter(r => !r.success) }
      });

      hideProgress();
      await clearTask();
      await sleep(1500);
      window.location.href = task.returnUrl || 'https://studio.youtube.com';
    } else {
      await setTask(task);
      const next = task.targetVideos[task.currentIndex];
      showProgress(task.currentIndex, task.targetVideos.length, `Navigating to: ${next.title || next.videoId}`);
      await sleep(1500);
      window.location.href = `https://studio.youtube.com/video/${next.videoId}/edit`;
    }
  }

  // ============================================================
  //  DOM helpers
  // ============================================================

  function waitForElement(selector, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const el = document.querySelector(selector);
      if (el) return resolve(el);

      const obs = new MutationObserver(() => {
        const el = document.querySelector(selector);
        if (el) { obs.disconnect(); resolve(el); }
      });
      obs.observe(document.body, { childList: true, subtree: true });

      setTimeout(() => { obs.disconnect(); reject(new Error(`${selector} not found (${timeout}ms)`)); }, timeout);
    });
  }

  function waitForSaveComplete() {
    return new Promise(resolve => {
      const t0 = Date.now();
      let saving = false;
      const iv = setInterval(() => {
        const btn = document.querySelector('#save');
        const disabled = btn?.getAttribute('aria-disabled') === 'true';
        if (disabled) saving = true;
        if (saving && !disabled) { clearInterval(iv); resolve(); return; }
        if (Date.now() - t0 > 15000) { clearInterval(iv); resolve(); }
      }, 300);
    });
  }

  /**
   * Show progress overlay
   */
  function showProgress(current, total, message) {
    if (!progressOverlay) {
      progressOverlay = document.createElement('div');
      progressOverlay.id = 'phybrv-progress-overlay';
      document.body.appendChild(progressOverlay);
    }

    const percent = total > 0 ? Math.round((current / total) * 100) : 0;

    progressOverlay.innerHTML = `
      <div class="phybrv-progress-container">
        <div class="phybrv-progress-header">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z" fill="#FF0000"/>
          </svg>
          <h3>Setting Related Videos</h3>
        </div>
        <div class="phybrv-progress-info">
          <span>${current + 1} of ${total}</span>
          <span>${percent}%</span>
        </div>
        <div class="phybrv-progress-bar">
          <div class="phybrv-progress-fill" style="width: ${percent}%"></div>
        </div>
        <p class="phybrv-progress-message">${message}</p>
      </div>
    `;

    progressOverlay.style.display = 'flex';
  }

  /**
   * Hide progress overlay
   */
  function hideProgress() {
    if (progressOverlay) {
      progressOverlay.style.display = 'none';
    }
  }

  /**
   * Show a toast notification
   */
  function showToast(message, type = 'info') {
    const existing = document.getElementById('phybrv-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'phybrv-toast';
    toast.className = `phybrv-toast phybrv-toast-${type}`;
    toast.innerHTML = `
      <span class="phybrv-toast-message">${message}</span>
      <button class="phybrv-toast-close" onclick="this.parentElement.remove()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>
      </button>
    `;

    document.body.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add('phybrv-toast-visible');
    });

    // Auto dismiss after 6 seconds
    setTimeout(() => {
      toast.classList.remove('phybrv-toast-visible');
      setTimeout(() => toast.remove(), 300);
    }, 6000);
  }

  /**
   * Sleep utility
   */
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
