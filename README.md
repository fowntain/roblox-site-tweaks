# Roblox Site Tweaks
<img height="300" alt="Demo" src="https://github.com/user-attachments/assets/3e500b01-746f-4f96-9a8a-57998d832779" />

Chrome extension that shrinks Roblox sidebars along with more various site tweaks (coming soon).

## What it does
Various Roblox DOM changes and visual tweaks
- Sidebar shrinking
    - Supports two layout modes:
      - Icon-only
      - Compact regular (keeps labels, trims spacing, and prevents label truncation)
    - Provides sidebar-hide toggles for all non-Home sidebar buttons, including:
- Navbar renaming
    - Automatically renames "Charts" back to "Games" and "Marketplace" to "Catalog"
    - Allows you to change and customize what it renames elements to

## Installation (Chrome/Edge)
1. Go to the <a href="https://github.com/fowntain/roblox-site-tweaks/releases/latest">Releases</a> page and download the latest ZIP file
2. Extract the ZIP's contents
3. Open the extensions page.
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
4. Enable **Developer mode**.
5. Click **Load unpacked**.
6. Select the folder with the extracted ZIP contents

## Usage
- Visit Roblox while logged in.
- Click the extension toolbar icon to open Sidebar Settings.
- Turn compact mode on or off.
- Switch between Icon-only and Compact regular.
- Toggle any non-Home sidebar button on or off.
- Badge reads `ON` when compact mode is enabled and `OFF` when disabled.

## Notes
- Compact CSS runs only at desktop width (`min-width: 1141px`) to avoid mobile layout conflicts.
- Roblox ships frequent UI updates, so the extension may become out of date or stop working often. If this happens, new versions will be posted here.
