// PHYAT Feature: Automatic Live Chat Messages
// Sends pre-configured messages in YouTube live chat with custom intervals
// Author: Heitor Faria | License: GPL v3

(function () {
  'use strict';

  const { waitForElement, sleep, showToast, escapeHtml, onUrlChange } = window.PHYAT;

  const STORAGE_KEY = 'phyat_livechat_config';
  let fabButton = null;
  let configPanel = null;
  let isRunning = false;
  let abortController = null;
  let currentMessageIndex = 0;

  // ---- Default config ----

  const DEFAULT_CONFIG = {
    messages: [],
    intervalSeconds: 60,
    recurring: true,
    randomOrder: false
  };

  // ---- Initialize ----

  function init() {
    console.log('[PHYAT:LiveChat] Initializing...');
    watchForLive();
  }

  function watchForLive() {
    const check = () => {
      if (isOnLivePage()) {
        setTimeout(() => {
          if (detectLiveChat()) {
            injectFAB();
          } else {
            removeFAB();
          }
        }, 2000);
      } else {
        removeFAB();
        stopAutomation();
      }
    };

    onUrlChange(check);

    // Observe DOM for live chat appearing
    const observer = new MutationObserver(() => {
      if (isOnLivePage() && detectLiveChat() && !document.getElementById('phyat-livechat-fab')) {
        injectFAB();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Initial check (delayed for page load)
    setTimeout(check, 3000);
  }

  function isOnLivePage() {
    return location.hostname === 'www.youtube.com' && location.pathname === '/watch';
  }

  function detectLiveChat() {
    // Live chat indicators
    return !!(
      document.querySelector('#chat-frame') ||
      document.querySelector('yt-live-chat-renderer') ||
      document.querySelector('iframe[src*="live_chat"]') ||
      document.querySelector('#chat') ||
      document.querySelector('yt-live-chat-header-renderer')
    );
  }

  // ---- FAB Button ----

  function injectFAB() {
    if (document.getElementById('phyat-livechat-fab')) return;

    fabButton = document.createElement('div');
    fabButton.id = 'phyat-livechat-fab';
    fabButton.className = 'phyat-fab phyat-fab-left';
    fabButton.innerHTML = `
      <button class="phyat-fab-button phyat-fab-button-chat" id="phyat-livechat-fab-btn" title="PHYAT - Auto Live Chat Messages">
        <div class="phyat-fab-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z" fill="currentColor"/>
          </svg>
        </div>
        <span class="phyat-fab-label">Auto Chat</span>
      </button>
    `;

    document.body.appendChild(fabButton);
    requestAnimationFrame(() => fabButton.classList.add('phyat-fab-visible'));

    document.getElementById('phyat-livechat-fab-btn').addEventListener('click', toggleConfigPanel);
  }

  function removeFAB() {
    const fab = document.getElementById('phyat-livechat-fab');
    if (fab) {
      fab.classList.remove('phyat-fab-visible');
      setTimeout(() => fab.remove(), 300);
      fabButton = null;
    }
    closeConfigPanel();
  }

  // ---- Config Panel ----

  async function toggleConfigPanel() {
    if (configPanel) {
      closeConfigPanel();
    } else {
      await openConfigPanel();
    }
  }

  async function openConfigPanel() {
    closeConfigPanel();

    const config = await loadConfig();
    configPanel = document.createElement('div');
    configPanel.id = 'phyat-livechat-panel';
    configPanel.className = 'phyat-panel';

    configPanel.innerHTML = `
      <div class="phyat-panel-container">
        <div class="phyat-panel-header">
          <div class="phyat-panel-title-row">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="#FF0000">
              <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
            </svg>
            <h2>Auto Live Chat</h2>
            <button class="phyat-panel-close" id="phyat-livechat-close" title="Close">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </button>
          </div>
          <p class="phyat-panel-subtitle">Configure messages to automatically send in live chat</p>
        </div>

        <div class="phyat-panel-body">
          <div class="phyat-field">
            <label class="phyat-label">Messages</label>
            <p class="phyat-hint">One message per line. They will be sent in order (or randomly).</p>
            <textarea id="phyat-livechat-messages" class="phyat-textarea" rows="6" placeholder="Type your messages here, one per line...&#10;Example: Thanks for watching!&#10;Don't forget to subscribe!">${config.messages.join('\n')}</textarea>
          </div>

          <div class="phyat-field-row">
            <div class="phyat-field">
              <label class="phyat-label">Interval (seconds)</label>
              <input type="number" id="phyat-livechat-interval" class="phyat-input" min="10" max="3600" value="${config.intervalSeconds}" />
            </div>
          </div>

          <div class="phyat-field">
            <label class="phyat-checkbox-label">
              <input type="checkbox" id="phyat-livechat-recurring" ${config.recurring ? 'checked' : ''} />
              <span>Recurring (loop messages)</span>
            </label>
          </div>

          <div class="phyat-field">
            <label class="phyat-checkbox-label">
              <input type="checkbox" id="phyat-livechat-random" ${config.randomOrder ? 'checked' : ''} />
              <span>Random order</span>
            </label>
          </div>

          <div class="phyat-status-bar" id="phyat-livechat-status" style="display:none">
            <div class="phyat-status-indicator"></div>
            <span class="phyat-status-text"></span>
          </div>
        </div>

        <div class="phyat-panel-footer">
          <button class="phyat-btn phyat-btn-secondary" id="phyat-livechat-save">Save Config</button>
          <button class="phyat-btn phyat-btn-primary" id="phyat-livechat-toggle">
            ${isRunning ? '⏹ Stop' : '▶ Start'}
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(configPanel);
    requestAnimationFrame(() => configPanel.classList.add('phyat-panel-active'));

    // Bind events
    document.getElementById('phyat-livechat-close').addEventListener('click', closeConfigPanel);
    document.getElementById('phyat-livechat-save').addEventListener('click', saveConfigFromPanel);
    document.getElementById('phyat-livechat-toggle').addEventListener('click', toggleAutomation);

    if (isRunning) updateStatusUI();
  }

  function closeConfigPanel() {
    if (configPanel) {
      configPanel.classList.remove('phyat-panel-active');
      setTimeout(() => {
        configPanel?.remove();
        configPanel = null;
      }, 300);
    }
  }

  // ---- Config persistence ----

  function loadConfig() {
    return new Promise(resolve => {
      chrome.storage.local.get(STORAGE_KEY, data => {
        resolve({ ...DEFAULT_CONFIG, ...(data[STORAGE_KEY] || {}) });
      });
    });
  }

  function saveConfig(config) {
    return chrome.storage.local.set({ [STORAGE_KEY]: config });
  }

  async function saveConfigFromPanel() {
    const config = getConfigFromPanel();
    await saveConfig(config);
    showToast('✅ Live chat config saved!', 'success');
  }

  function getConfigFromPanel() {
    const messagesRaw = document.getElementById('phyat-livechat-messages')?.value || '';
    const messages = messagesRaw.split('\n').map(m => m.trim()).filter(m => m.length > 0);
    const intervalSeconds = Math.max(10, parseInt(document.getElementById('phyat-livechat-interval')?.value) || 60);
    const recurring = document.getElementById('phyat-livechat-recurring')?.checked ?? true;
    const randomOrder = document.getElementById('phyat-livechat-random')?.checked ?? false;

    return { messages, intervalSeconds, recurring, randomOrder };
  }

  // ---- Automation engine ----

  async function toggleAutomation() {
    if (isRunning) {
      stopAutomation();
    } else {
      await startAutomation();
    }
  }

  async function startAutomation() {
    const config = getConfigFromPanel();
    await saveConfig(config);

    if (config.messages.length === 0) {
      showToast('⚠️ Please add at least one message.', 'warning');
      return;
    }

    isRunning = true;
    currentMessageIndex = 0;
    abortController = new AbortController();

    updateToggleButton();
    updateStatusUI();
    showToast('▶ Auto chat started!', 'success');

    runMessageLoop(config, abortController.signal);
  }

  function stopAutomation() {
    if (!isRunning) return;
    isRunning = false;
    abortController?.abort();
    abortController = null;

    updateToggleButton();
    hideStatusUI();
    showToast('⏹ Auto chat stopped.', 'info');
  }

  async function runMessageLoop(config, signal) {
    const { messages, intervalSeconds, recurring, randomOrder } = config;
    let indices = randomOrder
      ? shuffleArray([...Array(messages.length).keys()])
      : [...Array(messages.length).keys()];

    while (!signal.aborted) {
      for (const idx of indices) {
        if (signal.aborted) return;

        currentMessageIndex = idx;
        const message = messages[idx];

        updateStatusUI(`Sending: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`);

        const success = await sendChatMessage(message);
        if (!success) {
          showToast('❌ Failed to send chat message. Chat may not be available.', 'error');
          stopAutomation();
          return;
        }

        updateStatusUI(`Waiting ${intervalSeconds}s before next message...`);

        // Wait with abort support
        try {
          await abortableSleep(intervalSeconds * 1000, signal);
        } catch {
          return; // Aborted
        }
      }

      if (!recurring) {
        showToast('✅ All messages sent (non-recurring mode).', 'success');
        stopAutomation();
        return;
      }

      // Reshuffle for next loop if random
      if (randomOrder) {
        indices = shuffleArray([...Array(messages.length).keys()]);
      }
    }
  }

  // ---- Send message to live chat ----

  async function sendChatMessage(message) {
    try {
      // Try sending via the main page's chat input
      let chatInput = document.querySelector('#chat-frame')?.contentDocument?.querySelector('#input[contenteditable]');

      // Fallback: try direct chat input (when chat is embedded)
      if (!chatInput) {
        chatInput = document.querySelector('yt-live-chat-text-input-field-renderer #input');
      }
      if (!chatInput) {
        chatInput = document.querySelector('#chat #input[contenteditable="true"]');
      }

      // Approach: use postMessage to page context for chat interaction
      // Since live chat may be in an iframe, we use a dedicated approach
      return await sendChatViaDOM(message);
    } catch (err) {
      console.error('[PHYAT:LiveChat] Send error:', err);
      return false;
    }
  }

  async function sendChatViaDOM(message) {
    // Chat iframe approach
    const chatFrame = document.querySelector('#chat-frame, iframe[src*="live_chat"]');

    if (chatFrame) {
      try {
        const chatDoc = chatFrame.contentDocument || chatFrame.contentWindow?.document;
        if (chatDoc) {
          return await sendInChatDocument(chatDoc, message);
        }
      } catch {
        // Cross-origin iframe — use postMessage
        console.log('[PHYAT:LiveChat] Chat iframe is cross-origin, trying direct approach');
      }
    }

    // Direct approach (chat embedded in page)
    return await sendInChatDocument(document, message);
  }

  async function sendInChatDocument(doc, message) {
    // Find the chat input
    const input = doc.querySelector('#input[contenteditable="true"]') ||
                  doc.querySelector('div#input.yt-live-chat-text-input-field-renderer') ||
                  doc.querySelector('yt-live-chat-text-input-field-renderer #input');

    if (!input) {
      console.error('[PHYAT:LiveChat] Chat input not found');
      return false;
    }

    // Focus and set text
    input.focus();
    input.textContent = message;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(300);

    // Find and click send button
    const sendBtn = doc.querySelector('#send-button button') ||
                    doc.querySelector('yt-button-renderer#send-button button') ||
                    doc.querySelector('#send-button yt-icon-button button');

    if (!sendBtn) {
      // Fallback: press Enter
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
    } else {
      sendBtn.click();
    }

    await sleep(500);
    console.log(`[PHYAT:LiveChat] Sent: "${message}"`);
    return true;
  }

  // ---- UI helpers ----

  function updateToggleButton() {
    const btn = document.getElementById('phyat-livechat-toggle');
    if (btn) btn.textContent = isRunning ? '⏹ Stop' : '▶ Start';

    // Update FAB appearance
    const fabBtn = document.getElementById('phyat-livechat-fab-btn');
    if (fabBtn) {
      fabBtn.classList.toggle('phyat-fab-button-active', isRunning);
    }
  }

  function updateStatusUI(text) {
    const statusBar = document.getElementById('phyat-livechat-status');
    if (!statusBar) return;
    statusBar.style.display = 'flex';
    statusBar.querySelector('.phyat-status-indicator').className = 'phyat-status-indicator phyat-status-active';
    statusBar.querySelector('.phyat-status-text').textContent = text || 'Running...';
  }

  function hideStatusUI() {
    const statusBar = document.getElementById('phyat-livechat-status');
    if (statusBar) statusBar.style.display = 'none';
  }

  // ---- Utility ----

  function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  function abortableSleep(ms, signal) {
    return new Promise((resolve, reject) => {
      if (signal.aborted) return reject(new DOMException('Aborted', 'AbortError'));
      const timer = setTimeout(resolve, ms);
      signal.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      }, { once: true });
    });
  }

  // Register with PHYAT
  window.PHYAT.features = window.PHYAT.features || {};
  window.PHYAT.features.liveChat = { init };

  // Auto-init if on youtube.com
  if (location.hostname === 'www.youtube.com') {
    init();
  }
})();
