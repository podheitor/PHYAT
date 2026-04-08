// PHYBRV - PodHeitor YouTube Bulk Related Video
// Modal UI Component (Session-based, no OAuth2 required)
// Author: Heitor Faria | License: GPL v3

class PHYBRVModal {
  constructor() {
    this.overlay = null;
    this.videos = [];
    this.nextPageToken = null;
    this.totalResults = 0;
    this.selectedVideo = null;
    this.isLoading = false;
    this.searchTimeout = null;
    this.currentQuery = '';
    this.onConfirm = null;
    this._requestCounter = 0;
  }

  /**
   * Send a message to the page bridge and wait for response
   */
  _bridgeRequest(action, data = {}) {
    return new Promise((resolve, reject) => {
      const requestId = `phybrv-${++this._requestCounter}-${Date.now()}`;

      const handler = (event) => {
        if (event.source !== window) return;
        if (!event.data || event.data.source !== 'phybrv-bridge') return;
        if (event.data.requestId !== requestId) return;

        window.removeEventListener('message', handler);

        if (event.data.error) {
          reject(new Error(event.data.error));
        } else {
          resolve(event.data.data);
        }
      };

      window.addEventListener('message', handler);

      // Timeout after 15 seconds
      setTimeout(() => {
        window.removeEventListener('message', handler);
        reject(new Error('Bridge request timed out. Make sure you are on YouTube Studio.'));
      }, 15000);

      window.postMessage({
        source: 'phybrv-content',
        action,
        requestId,
        ...data
      }, '*');
    });
  }

  /**
   * Open the modal and start loading videos
   */
  async open(onConfirm) {
    this.onConfirm = onConfirm;
    this.selectedVideo = null;
    this.videos = [];
    this.nextPageToken = null;
    this.currentQuery = '';

    this.createOverlay();
    await this.loadVideos();
  }

  /**
   * Create the modal overlay DOM
   */
  createOverlay() {
    // Remove existing overlay if any
    const existing = document.getElementById('phybrv-modal-overlay');
    if (existing) existing.remove();

    this.overlay = document.createElement('div');
    this.overlay.id = 'phybrv-modal-overlay';
    this.overlay.innerHTML = `
      <div class="phybrv-modal">
        <div class="phybrv-modal-header">
          <div class="phybrv-modal-title-row">
            <div class="phybrv-modal-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M10 8l6 4-6 4V8z" fill="#FF0000"/>
                <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0C.488 3.45.029 5.804 0 12c.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0C23.512 20.55 23.971 18.196 24 12c-.029-6.185-.484-8.549-4.385-8.816z" fill="none" stroke="#FF0000" stroke-width="1.5"/>
              </svg>
            </div>
            <h2>Select Related Video</h2>
            <button class="phybrv-modal-close" id="phybrv-close-btn" title="Close">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </button>
          </div>
          <p class="phybrv-modal-subtitle">Browse your channel's videos and select one to set as the Related Video for the selected videos.</p>
          <div class="phybrv-search-container">
            <svg class="phybrv-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
            </svg>
            <input type="text" id="phybrv-search-input" placeholder="Search your videos..." autocomplete="off" />
            <button class="phybrv-search-clear" id="phybrv-search-clear" title="Clear search" style="display:none">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </button>
          </div>
        </div>

        <div class="phybrv-modal-body" id="phybrv-video-grid">
          <div class="phybrv-loading-container">
            <div class="phybrv-spinner"></div>
            <p>Loading your videos...</p>
          </div>
        </div>

        <div class="phybrv-modal-footer">
          <div class="phybrv-selected-info" id="phybrv-selected-info">
            <span class="phybrv-no-selection">No video selected</span>
          </div>
          <div class="phybrv-modal-actions">
            <button class="phybrv-btn phybrv-btn-cancel" id="phybrv-cancel-btn">Cancel</button>
            <button class="phybrv-btn phybrv-btn-confirm" id="phybrv-confirm-btn" disabled>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="margin-right:6px">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
              </svg>
              Apply Related Video
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(this.overlay);

    // Force reflow then add active class for animation
    requestAnimationFrame(() => {
      this.overlay.classList.add('phybrv-active');
    });

    this.bindEvents();
  }

  /**
   * Bind modal events
   */
  bindEvents() {
    document.getElementById('phybrv-close-btn').addEventListener('click', () => this.close());
    document.getElementById('phybrv-cancel-btn').addEventListener('click', () => this.close());

    document.getElementById('phybrv-confirm-btn').addEventListener('click', () => {
      if (this.selectedVideo && this.onConfirm) {
        this.onConfirm(this.selectedVideo);
        this.close();
      }
    });

    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close();
    });

    const searchInput = document.getElementById('phybrv-search-input');
    const searchClear = document.getElementById('phybrv-search-clear');

    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.trim();
      searchClear.style.display = query ? 'flex' : 'none';

      clearTimeout(this.searchTimeout);
      this.searchTimeout = setTimeout(() => {
        this.currentQuery = query;
        this.videos = [];
        this.nextPageToken = null;
        this.loadVideos();
      }, 400);
    });

    searchClear.addEventListener('click', () => {
      searchInput.value = '';
      searchClear.style.display = 'none';
      this.currentQuery = '';
      this.videos = [];
      this.nextPageToken = null;
      this.loadVideos();
    });

    document.addEventListener('keydown', this._escHandler = (e) => {
      if (e.key === 'Escape') this.close();
    });
  }

  /**
   * Load videos via the page bridge (uses YouTube session)
   */
  async loadVideos() {
    if (this.isLoading) return;
    this.isLoading = true;

    const grid = document.getElementById('phybrv-video-grid');

    if (this.videos.length === 0) {
      grid.innerHTML = `
        <div class="phybrv-loading-container">
          <div class="phybrv-spinner"></div>
          <p>Loading your videos...</p>
        </div>
      `;
    }

    try {
      let response;

      if (this.currentQuery) {
        response = await this._bridgeRequest('searchVideos', {
          query: this.currentQuery,
          pageToken: this.nextPageToken
        });
      } else {
        response = await this._bridgeRequest('fetchVideos', {
          pageToken: this.nextPageToken
        });
      }

      this.videos = [...this.videos, ...response.videos];
      this.nextPageToken = response.nextPageToken;
      this.totalResults = response.totalResults;

      this.renderVideos();
    } catch (err) {
      this.showError(`Failed to load videos: ${err.message}`);
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Render the video grid
   */
  renderVideos() {
    const grid = document.getElementById('phybrv-video-grid');

    if (this.videos.length === 0) {
      grid.innerHTML = `
        <div class="phybrv-empty-state">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="#666">
            <path d="M18 3v2h-2V3H8v2H6V3H4v18h16V3h-2zM6 19V7h12v12H6zm8-10H10v2h4V9zm-4 4h4v2h-4v-2z"/>
          </svg>
          <p>No videos found</p>
          <span>Try a different search term</span>
        </div>
      `;
      return;
    }

    let html = '<div class="phybrv-video-list">';

    this.videos.forEach((video, index) => {
      const isSelected = this.selectedVideo && this.selectedVideo.videoId === video.videoId;
      const publishDate = video.publishedAt
        ? new Date(video.publishedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
        : '';

      html += `
        <div class="phybrv-video-card ${isSelected ? 'phybrv-selected' : ''}"
             data-video-index="${index}"
             data-video-id="${video.videoId}">
          <div class="phybrv-video-thumbnail-wrapper">
            <img class="phybrv-video-thumbnail" src="${video.thumbnail}" alt="${this.escapeHtml(video.title)}" loading="lazy" />
            ${video.duration ? `<span class="phybrv-video-duration">${video.duration}</span>` : ''}
            <div class="phybrv-video-overlay">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
              </svg>
            </div>
          </div>
          <div class="phybrv-video-info">
            <h3 class="phybrv-video-title" title="${this.escapeHtml(video.title)}">${this.escapeHtml(video.title)}</h3>
            ${publishDate ? `<div class="phybrv-video-meta"><span>${publishDate}</span></div>` : ''}
          </div>
        </div>
      `;
    });

    html += '</div>';

    if (this.nextPageToken) {
      html += `
        <div class="phybrv-load-more-container">
          <button class="phybrv-btn phybrv-btn-load-more" id="phybrv-load-more-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="margin-right:6px">
              <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
            </svg>
            Load More Videos
          </button>
        </div>
      `;
    }

    grid.innerHTML = html;

    grid.querySelectorAll('.phybrv-video-card').forEach(card => {
      card.addEventListener('click', () => {
        const index = parseInt(card.dataset.videoIndex);
        this.selectVideo(index);
      });
    });

    const loadMoreBtn = document.getElementById('phybrv-load-more-btn');
    if (loadMoreBtn) {
      loadMoreBtn.addEventListener('click', () => this.loadVideos());
    }
  }

  /**
   * Select a video
   */
  selectVideo(index) {
    const video = this.videos[index];
    if (!video) return;

    this.selectedVideo = video;

    document.querySelectorAll('.phybrv-video-card').forEach(card => {
      card.classList.remove('phybrv-selected');
    });
    const selectedCard = document.querySelector(`[data-video-index="${index}"]`);
    if (selectedCard) selectedCard.classList.add('phybrv-selected');

    const infoEl = document.getElementById('phybrv-selected-info');
    infoEl.innerHTML = `
      <div class="phybrv-selected-preview">
        <img src="${video.thumbnail}" alt="" />
        <span class="phybrv-selected-title">${this.escapeHtml(video.title)}</span>
      </div>
    `;

    document.getElementById('phybrv-confirm-btn').disabled = false;
  }

  /**
   * Show error message in the modal
   */
  showError(message) {
    const grid = document.getElementById('phybrv-video-grid');
    if (grid) {
      grid.innerHTML = `
        <div class="phybrv-error-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="#f44336">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
          </svg>
          <p>${this.escapeHtml(message)}</p>
        </div>
      `;
    }
  }

  /**
   * Close the modal
   */
  close() {
    if (this.overlay) {
      this.overlay.classList.remove('phybrv-active');
      setTimeout(() => {
        this.overlay.remove();
        this.overlay = null;
      }, 300);
    }
    if (this._escHandler) {
      document.removeEventListener('keydown', this._escHandler);
    }
  }

  formatViewCount(count) {
    const num = parseInt(count);
    if (isNaN(num)) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

window.PHYBRVModal = PHYBRVModal;
