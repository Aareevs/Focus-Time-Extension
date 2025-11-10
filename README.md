# Focus Time — Screen Time Tracker & Topic Blocker

A modern Manifest Microsoft Edge extension to help you stay focused with screen time tracking, topic-based blocking powered by Google Gemini, and a custom blocklist with recommended sites.

**Credits To Sirwagya Shekhar(@Sirwagya) for providing layout and baseline**

## Features
- **Modern Dark UI** with glass-morphism effects and vibrant gradients
- **Screen Time Tracker** with real-time monitoring and daily statistics
- **Topic-Based Blocking** powered by Google Gemini AI
- **Recommended Sites to Block** including YouTube, Instagram, NetMirror, Facebook, Twitter, and TikTok
- **Custom Blocklist Manager** with easy add/remove functionality
- **Temporary Allowlist** with 5-minute per-domain access
- **Visual Feedback** through extension icon badges (BLK/IRR)

## Installation (Edge)
1. Go to `edge://extensions`
2. Enable Developer mode (top-right toggle)
3. Click "Load unpacked" and select this folder
4. The extension icon will appear in your Edge toolbar

## Setup
1. **Optional AI Setup**: Open the options page (right-click extension icon > Options) and paste your Google Gemini API key for intelligent topic-based blocking
2. **Configure Blocking**:
   - Use the "Recommended Sites" section to quickly block popular distracting sites
   - Add custom sites to your blocklist
   - Set a focus topic for AI-powered relevance checking
3. **Screen Time**: Track your daily website usage automatically

## How It Works
- **Real-time Monitoring**: Tracks time spent on websites automatically
- **Smart Blocking**: Combines blocklist filtering with AI-powered relevance checking
- **Temporary Access**: Click "Allow 5 min" on blocked pages for temporary access
- **Visual Indicators**: Extension badge shows blocking status (BLK = Blocklist, IRR = Irrelevant)

## Technical Details
- Built with Manifest V3 for modern Chrome compatibility
- Uses `edge.scripting` and `edge.webNavigation` APIs
- Content script injection for overlay functionality
- Local storage for settings and blocklist management
- No external data collection beyond Gemini API calls

## Privacy
- Website titles and meta descriptions are only sent to Google Gemini when a focus topic is set
- All data remains local except for optional Gemini API calls
- No tracking or analytics implemented

## Troubleshooting
- **Blocking not working?** Check extension permissions in `edge://extensions` > Details > Site access
- **Badge codes**: BLK = Blocked by list, IRR = Irrelevant to topic
- **Extension not loading?** Ensure all files are present and manifest.json is valid
