# PHYAT - PodHeitor YouTube Automation Tools

A Chrome/Brave browser extension with multiple YouTube automation tools for creators.

**No API keys or Google Cloud setup needed!** The extension uses your existing YouTube session.

## Features

### 🔗 Bulk Related Video
Set the "Related Video" field on multiple YouTube Studio videos simultaneously.

- **Where:** YouTube Studio → Content → Videos
- Select multiple videos using checkboxes
- Click the red "Set Related Video" FAB button
- Browse and select the related video
- Applied to all selected videos automatically

### 💬 Auto Live Chat Messages
Send pre-configured messages in YouTube live chat with custom intervals.

- **Where:** YouTube → Live stream watch page
- Configure messages (one per line)
- Set interval between messages (seconds)
- Toggle recurring (loop) or one-time
- Sequential or random order
- Start/stop at any time
- Button appears **only on live streams**

### 📝 Auto Comments
Automatically add comments to your channel's videos.

- **Where:** YouTube → Home page
- Selectable categories: Videos, Lives, Shorts
- Option to only comment on videos without your comment
- Configurable delay between comments
- Activity log with real-time progress
- Rate limiting to avoid spam detection

## Installation

1. Clone or download this repository
2. Open `chrome://extensions` in Chrome or Brave
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked** and select this extension's directory
5. Navigate to **YouTube** or **YouTube Studio**
6. That's it! Features activate based on the page you're on.

## Project Structure

```
PHYAT/
├── manifest.json           # Extension config (Manifest V3)
├── background.js           # Service worker
├── popup.html / popup.css  # Extension popup (feature hub)
├── modal.js                # Video picker modal (Related Video)
├── page_bridge.js          # YouTube Studio internal API bridge
├── styles.css              # All content script styles
├── core/
│   └── utils.js            # Shared utilities (toast, progress, DOM helpers)
├── features/
│   ├── related-video/
│   │   └── related-video.js  # Bulk Related Video feature
│   ├── live-chat/
│   │   └── live-chat.js      # Auto Live Chat Messages feature
│   └── auto-comments/
│       └── auto-comments.js  # Auto Comments feature
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## Author

**Heitor Faria**

## License

This project is licensed under the GNU General Public License v3.0 — see the [LICENSE](LICENSE) file for details.
