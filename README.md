# CueZK for Windows, Mac and Linux

The CueZK desktop app: CueZK on the web (https://cuezk.com) in its own window, with what a desktop app adds:

- 🔔 Notifications, and the unread count on the taskbar (Windows) or dock (Mac)
- 🖥 Screen sharing in calls (choose a screen or one window)
- 📌 A tray icon: CueZK keeps running when you close the window, so you still get messages and calls
- 🚀 "Start CueZK when I sign in to this computer" (in the tray menu)
- 📡 An offline screen with **Try again** and **Use the backup address** (for networks that block CueZK)
- ⬆ Automatic updates (Windows and Linux; Mac once the app is signed)
- 🔒 Locked down: only CueZK and OnCue pages open inside it (plus Google/Nichey sign-in). Other links open in your normal browser. The page can't reach anything on the computer except the unread count, the offline buttons and the screen picker.

Messages stay end-to-end encrypted exactly as on the web. This app is a new "device": link it with a code (CueZK → Settings → Link a new device) to see older messages.

## How the installers get built (no tools needed on your computer)

1. On GitHub, create a new repository named **cuezk-desktop** under Myisland56.
   Make it **Public** so people can download the installers and installed copies can find updates.
   (It has no passwords or keys in it.)
2. Upload everything in this folder **except** `node_modules` and `dist` (there are none in the zip).
   Make sure the hidden `.github` folder is included: it holds the build instructions.
3. Open the **Actions** tab. A run called "Build CueZK desktop" starts by itself and takes about 10 minutes.
   When it's green, open it: under **Artifacts** are the Windows, Mac and Linux installers to try.
4. To release it for everyone: **Actions → Build CueZK desktop → Run workflow**, tick **Make a release**, press **Run workflow**.
   When it finishes, go to **Releases**: there's a draft "v1.0.0" with the installers. Press **Edit → Publish release**.
5. Put the download links in **Admin → Messages → CueZK download links** on OnCue. The cuezk.com welcome page then shows them:
   - Windows: `https://github.com/Myisland56/cuezk-desktop/releases/latest/download/CueZK-Setup-1.0.0-x64.exe`
   - Mac: `https://github.com/Myisland56/cuezk-desktop/releases/latest/download/CueZK-1.0.0-mac.dmg`
   - or simply the releases page: `https://github.com/Myisland56/cuezk-desktop/releases/latest`

For a new version later: change `"version"` in package.json (for example to 1.0.1), upload it, and repeat step 4.

## Warnings people may see the first time (until the app is signed)

- **Windows**: "Windows protected your PC" → **More info → Run anyway**. Signing removes this; the cheapest route is
  Microsoft's *Azure Trusted Signing* (about $10/month).
- **Mac**: "CueZK can't be opened because Apple cannot check it" → right-click CueZK in Applications → **Open** → **Open**.
  You already have an Apple Developer account (Team 4374GF3XY2), so the app can be signed and notarized later by adding
  a Developer ID certificate to the repository's secrets (CSC_LINK, CSC_KEY_PASSWORD, APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID).
  Never paste these anywhere else.

## Trying it from the source code (optional)

```
npm install
npm start
```
