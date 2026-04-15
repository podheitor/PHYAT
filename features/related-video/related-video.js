// PHYAT Feature: Bulk Related Video
// Sets related video on multiple YouTube Studio videos simultaneously
// Author: Heitor Faria | License: GPL v3

(function () {
  'use strict';

  const { waitForElement, sleep, showToast, showProgress, hideProgress, escapeHtml,
         isStudioVideosPage, isStudioEditPage, extractVideoIdFromUrl, onUrlChange } = window.PHYAT;

  const TASK_KEY = 'phyat_related_video_task';
  const RESULT_KEY = 'phyat_related_video_result';
  let fabButton = null;
  let modal = null;

  // ---- Initialize ----

  function init() {
    console.log('[PHYAT:RelatedVideo] Initializing...');
    checkPendingResults();

    if (isStudioEditPage()) {
      setTimeout(() => checkPendingTask(), 4000);
    }

    watchNavigation();
  }

  function watchNavigation() {
    const check = () => {
      if (isStudioVideosPage()) {
        injectFAB();
      } else {
        removeFAB();
      }
    };

    const observer = new MutationObserver(check);
    observer.observe(document.body, { childList: true, subtree: true });

    onUrlChange(() => setTimeout(check, 1000));
    check();
  }

  // ---- FAB Button ----

  function injectFAB() {
    if (document.getElementById('phyat-related-fab')) return;

    fabButton = document.createElement('div');
    fabButton.id = 'phyat-related-fab';
    fabButton.className = 'phyat-fab';
    fabButton.innerHTML = `
      <button class="phyat-fab-button" id="phyat-related-fab-btn" title="Set Related Video for Selected Videos">
        <div class="phyat-fab-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z" fill="currentColor"/>
          </svg>
        </div>
        <span class="phyat-fab-label">Set Related Video</span>
        <span class="phyat-fab-badge" id="phyat-related-fab-badge" style="display:none">0</span>
      </button>
    `;

    document.body.appendChild(fabButton);
    requestAnimationFrame(() => fabButton.classList.add('phyat-fab-visible'));

    document.getElementById('phyat-related-fab-btn').addEventListener('click', handleFABClick);
    monitorSelections();
  }

  function removeFAB() {
    const fab = document.getElementById('phyat-related-fab');
    if (fab) {
      fab.classList.remove('phyat-fab-visible');
      setTimeout(() => fab.remove(), 300);
      fabButton = null;
    }
  }

  // ---- Video selection monitoring ----

  function monitorSelections() {
    setInterval(updateSelectionCount, 500);
  }

  function getSelectedVideoIds() {
    const selected = [];
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

  function getSelectedVideoIdsAlternative() {
    const selected = [];
    const selectionBar = document.querySelector('#select-bar') ||
                         document.querySelector('ytcp-table-select-bar');
    if (!selectionBar) return selected;

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

  function getAllSelectedVideos() {
    let videos = getSelectedVideoIds();
    if (videos.length === 0) videos = getSelectedVideoIdsAlternative();
    return videos;
  }

  function updateSelectionCount() {
    const badge = document.getElementById('phyat-related-fab-badge');
    if (!badge) return;

    const count = getAllSelectedVideos().length;
    if (count > 0) {
      badge.textContent = count;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  }

  // ---- FAB click handler ----

  function handleFABClick() {
    const selectedVideos = getAllSelectedVideos();

    if (selectedVideos.length === 0) {
      showToast('⚠️ Please select at least one video using the checkboxes first.', 'warning');
      return;
    }

    console.log(`[PHYAT:RelatedVideo] Opening modal for ${selectedVideos.length} selected videos`);

    if (!modal) {
      modal = new PHYATModal();
    }

    modal.open((relatedVideo) => {
      console.log(`[PHYAT:RelatedVideo] Selected related video: ${relatedVideo.title} (${relatedVideo.videoId})`);
      applyRelatedVideo(selectedVideos, relatedVideo);
    });
  }

  // ---- Task queue (chrome.storage.local) ----

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

  // ---- Apply related video automation ----

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

    showProgress(0, targetVideos.length, 'Navigating to first video...', 'Setting Related Videos');
    const firstId = targetVideos[0].videoId;
    window.location.href = `https://studio.youtube.com/video/${firstId}/edit`;
  }

  async function checkPendingTask() {
    if (!isStudioEditPage()) return;

    const task = await getTask();
    if (!task || task.status !== 'running') return;

    const currentId = extractVideoIdFromUrl();
    const expected = task.targetVideos[task.currentIndex];
    if (!expected || currentId !== expected.videoId) {
      console.log('[PHYAT:RelatedVideo] Edit page does not match pending task video');
      return;
    }

    console.log(`[PHYAT:RelatedVideo] Running automation for ${currentId} (${task.currentIndex + 1}/${task.targetVideos.length})`);
    await runEditPageAutomation(task);
  }

  async function checkPendingResults() {
    const data = await new Promise(r => chrome.storage.local.get(RESULT_KEY, r));
    const result = data[RESULT_KEY];
    if (!result) return;

    chrome.storage.local.remove(RESULT_KEY);
    if (result.errorCount === 0) {
      showToast(`✅ Successfully set related video for ${result.successCount} video(s)!`, 'success');
    } else {
      showToast(`⚠️ ${result.successCount} succeeded, ${result.errorCount} failed. Check console (F12).`, 'warning');
      if (result.errors?.length) console.error('[PHYAT:RelatedVideo] Failed:', result.errors);
    }
  }

  // ---- DOM automation on edit page ----

  async function runEditPageAutomation(task) {
    const video = task.targetVideos[task.currentIndex];
    showProgress(task.currentIndex, task.targetVideos.length, `Processing: ${video.title || video.videoId}`, 'Setting Related Videos');

    try {
      const picker = await waitForElement('ytcp-shorts-content-links-picker', 25000);
      picker.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await sleep(800);

      const trigger = picker.querySelector('#linked-video-editor-link') ||
                      picker.querySelector('ytcp-text-dropdown-trigger');
      if (!trigger) throw new Error('Related-video dropdown trigger not found');

      const clickTarget = trigger.querySelector('ytcp-dropdown-trigger') || trigger;
      clickTarget.click();
      console.log('[PHYAT:RelatedVideo] Opened related-video picker');

      const dialog = await waitForElement('ytcp-video-pick-dialog', 10000);
      await sleep(800);

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
      console.log(`[PHYAT:RelatedVideo] Searching for: ${searchTerm}`);
      await sleep(3000);

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
      console.log('[PHYAT:RelatedVideo] Selected video card');
      await sleep(1500);

      const stillOpen = document.querySelector('ytcp-video-pick-dialog');
      if (stillOpen) {
        const doneBtn = stillOpen.querySelector('#done-button, #select-button, ytcp-button[id*="done"], ytcp-button[id*="select"]');
        if (doneBtn) {
          (doneBtn.querySelector('button') || doneBtn).click();
          await sleep(1000);
        }
      }

      const saveEl = document.querySelector('ytcp-button#save, #save');
      if (!saveEl) throw new Error('Save button not found');

      const saveBtn = saveEl.querySelector('button') || saveEl;
      if (saveEl.getAttribute('aria-disabled') === 'true') {
        console.warn('[PHYAT:RelatedVideo] Save button disabled — change may not have registered');
        await sleep(1000);
      }
      saveBtn.click();
      console.log('[PHYAT:RelatedVideo] Clicked Save');

      await waitForSaveComplete();

      task.results.push({ videoId: video.videoId, success: true });
      console.log(`[PHYAT:RelatedVideo] ✓ Done: ${video.videoId}`);
    } catch (err) {
      console.error(`[PHYAT:RelatedVideo] ✗ Failed: ${video.videoId}`, err);
      task.results.push({ videoId: video.videoId, success: false, error: err.message });
    }

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
      showProgress(task.currentIndex, task.targetVideos.length, `Navigating to: ${next.title || next.videoId}`, 'Setting Related Videos');
      await sleep(1500);
      window.location.href = `https://studio.youtube.com/video/${next.videoId}/edit`;
    }
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

  // Register with PHYAT
  window.PHYAT.features = window.PHYAT.features || {};
  window.PHYAT.features.relatedVideo = { init };

  // Auto-init if on studio
  if (location.hostname === 'studio.youtube.com') {
    init();
  }
})();
