# ZEN MODE — Focus Timer & Topic Blocker

A Manifest V3 Chrome extension to help you focus with a lightweight timer, a topic-based blocker powered by Google Gemini, and a custom blocklist.

## What's included
- Popup with timer, topic input, and blocklist manager
- Options page to save your Gemini API key
- Background service worker that blocks pages by blocklist or when content is irrelevant to your chosen topic
- Badge feedback (BLK/IRR) on the extension icon instead of notifications
- Temporary 5-minute allowlist per domain (click "Allow 5 min" on the overlay)

## Load the extension (Chrome)
1. Go to chrome://extensions
2. Enable Developer mode (top-right)
3. Click "Load unpacked" and select this folder

## Setup
- Optional: Open the options page (right-click the extension icon > Options) and paste your Google Gemini API key.
 - Optional: Open the options page (right-click the extension icon > Options) or click the ⚙️ button in the popup and paste your Google Gemini API key.
- In the popup:
  - Set a focus topic
  - Edit the blocklist (one domain per line)
  - Toggle Break Mode to temporarily pause blocking

## Notes
- This project uses the MV3 `chrome.scripting` and `chrome.webNavigation` APIs.
- Notifications were replaced with badge pings to avoid missing icon errors. If you want desktop notifications, add 16/48/128 px PNG icons under `icons/` and re-add the `notifications` permission and API calls.
- A content script (`content.js`) is injected on all pages to relay the "Allow 5 min" button click from the overlay to the background.

## Privacy
- The page title and meta description are sent to Google Gemini only when a focus topic is set, to decide relevance. No other data is collected.

## Troubleshooting
- If blocking does not occur, ensure the extension has Host access to target sites in `chrome://extensions` > this extension > Details.
- Badge codes:
  - BLK = Blocklist blocked
  - IRR = Irrelevant to topic
