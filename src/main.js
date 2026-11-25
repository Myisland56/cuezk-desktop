/*
 * CueZK for Windows, Mac and Linux.
 *
 * A small, locked-down window around CueZK on the web (https://cuezk.com), with what a desktop app adds:
 * a tray icon, the unread count on the taskbar / dock, start with the computer, screen sharing in calls,
 * notifications, an offline screen, and automatic updates. Messages stay end-to-end encrypted exactly as on
 * the web: the keys are made and kept in this app's own storage on this computer.
 */
'use strict';
const { app, BrowserWindow, Tray, Menu, shell, session, nativeImage, desktopCapturer, ipcMain, Notification } = require('electron');
const path = require('path');
const fs = require('fs');

// CUEZK_DEV_URL is only for testing from the source code (npm start); the installed app ignores it
const DEV = !require('electron').app.isPackaged && process.env.CUEZK_DEV_URL ? process.env.CUEZK_DEV_URL : '';
const HOME = DEV || 'https://cuezk.com/';
const BACKUP = 'https://cuezk.app/';                            // OnCue's backup address, for networks that block the main ones
const OWN = ['cuezk.com', 'cuezk.app', 'oncue.info', 'www.oncue.info'];
const SIGNIN = ['accounts.google.com', 'nichey.net', 'www.nichey.net'];   // "Sign in with Google / Nichey" stay in the window
const APP_ID = 'app.cuezk.desktop';

let win = null, tray = null, quitting = false, unread = 0;
const prefsFile = () => path.join(app.getPath('userData'), 'cuezk-desktop.json');
function prefs() { try { return JSON.parse(fs.readFileSync(prefsFile(), 'utf8')); } catch (e) { return {}; } }
function savePrefs(p) { try { fs.writeFileSync(prefsFile(), JSON.stringify(Object.assign(prefs(), p))); } catch (e) {} }
function hostOf(u) { try { return new URL(u).hostname.toLowerCase(); } catch (e) { return ''; } }
function isOwn(u) { const h = hostOf(u); return (u.startsWith('https://') && OWN.includes(h)) || (DEV !== '' && u.startsWith(DEV)); }
function isSignin(u) { const h = hostOf(u); return u.startsWith('https://') && SIGNIN.includes(h); }

/* one CueZK at a time: opening it again brings the window forward */
if (!app.requestSingleInstanceLock()) { app.quit(); }
app.on('second-instance', () => show());
if (process.platform === 'win32') app.setAppUserModelId(APP_ID);

function icon(name) { return nativeImage.createFromPath(path.join(__dirname, name)); }

function createWindow() {
  const p = prefs(), b = p.bounds || {};
  win = new BrowserWindow({
    width: b.width || 1280, height: b.height || 820, x: b.x, y: b.y, minWidth: 380, minHeight: 520,
    title: 'CueZK', icon: icon('icon256.png'), backgroundColor: '#0b1220', show: false, autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: true, partition: 'persist:cuezk' },
  });
  if (p.max) win.maximize();
  // look like a normal browser to websites (some sign-in pages refuse apps)
  win.webContents.setUserAgent(win.webContents.getUserAgent().replace(/\s(cuezk-desktop|CueZK|Electron)\/\S+/gi, ''));
  win.once('ready-to-show', () => { if (!process.argv.includes('--hidden')) win.show(); });
  win.loadURL(p.useBackup ? BACKUP : HOME);

  // links: CueZK / OnCue and sign-in pages stay here; everything else opens in the normal browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isOwn(url) && !/\/(privacy|terms)\.php/.test(url)) { win.loadURL(url); return { action: 'deny' }; }
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => { if (!isOwn(url) && !isSignin(url)) { e.preventDefault(); if (/^https?:\/\//.test(url)) shell.openExternal(url); } });
  win.webContents.on('will-redirect', (e, url) => { if (!isOwn(url) && !isSignin(url)) { e.preventDefault(); if (/^https?:\/\//.test(url)) shell.openExternal(url); } });

  // no connection (or a network that blocks CueZK): a friendly page with Try again / Use the backup address
  win.webContents.on('did-fail-load', (e, code, desc, url, isMain) => {
    if (!isMain || code === -3) return;                         // -3: cancelled on purpose
    win.loadFile(path.join(__dirname, 'offline.html'), { query: { code: String(code), url: url || HOME } });
  });

  const keep = () => { if (!win || win.isDestroyed()) return; savePrefs({ bounds: win.isMaximized() ? (prefs().bounds || {}) : win.getBounds(), max: win.isMaximized() }); };
  win.on('resize', keep); win.on('move', keep);
  win.on('close', (e) => {
    keep();
    if (!quitting && prefs().tray !== false && process.platform !== 'darwin') { e.preventDefault(); win.hide(); trayTip(); }
    else if (!quitting && process.platform === 'darwin') { e.preventDefault(); win.hide(); }
  });
  win.on('focus', () => win.flashFrame(false));
}
let tipShown = false;
function trayTip() {
  if (tipShown || !tray || process.platform !== 'win32') return; tipShown = true;
  try { tray.displayBalloon({ title: 'CueZK is still running', content: 'You\'ll still get messages and calls. Right-click the CueZK icon to quit.', iconType: 'info' }); } catch (e) {}
}
function show() { if (!win) createWindow(); if (win.isMinimized()) win.restore(); win.show(); win.focus(); }

function buildTray() {
  tray = new Tray(icon(process.platform === 'darwin' ? 'tray.png' : 'tray@2x.png').resize({ width: 16, height: 16 }));
  tray.setToolTip('CueZK');
  tray.on('click', () => (win && win.isVisible() && win.isFocused() ? win.hide() : show()));
  refreshTray();
}
function refreshTray() {
  if (!tray) return;
  const login = app.getLoginItemSettings().openAtLogin, p = prefs();
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: unread ? `Open CueZK (${unread} unread)` : 'Open CueZK', click: show },
    { type: 'separator' },
    { label: 'Start CueZK when I sign in to this computer', type: 'checkbox', checked: login, click: (m) => { app.setLoginItemSettings({ openAtLogin: m.checked, args: ['--hidden'] }); refreshTray(); } },
    ...(process.platform !== 'darwin' ? [{ label: 'Keep running in the tray when I close the window', type: 'checkbox', checked: p.tray !== false, click: (m) => { savePrefs({ tray: m.checked }); } }] : []),
    { label: 'Use the backup address (if CueZK won\'t load)', type: 'checkbox', checked: !!p.useBackup, click: (m) => { savePrefs({ useBackup: m.checked }); if (win) win.loadURL(m.checked ? BACKUP : HOME); } },
    { type: 'separator' },
    { label: 'Help & FAQ', click: () => shell.openExternal('https://cuezk.com/faq.php') },
    { label: 'Quit CueZK', click: () => { quitting = true; app.quit(); } },
  ]));
}

/* the unread count from the page (preload.js passes it on) */
ipcMain.on('cuezk:badge', (e, n) => {
  n = Math.max(0, Math.min(999, parseInt(n, 10) || 0)); if (DEV) console.log('[cuezk] badge ' + n);
  const more = n > unread; unread = n;
  if (process.platform === 'darwin') app.dock.setBadge(n ? String(n) : '');
  else if (process.platform === 'win32' && win) win.setOverlayIcon(n ? icon('badge.png') : null, n ? `${n} unread` : '');
  else app.setBadgeCount(n);
  if (tray) { tray.setToolTip(n ? `CueZK: ${n} unread` : 'CueZK'); refreshTray(); }
  if (more && win && !win.isFocused()) win.flashFrame(true);
});
ipcMain.on('cuezk:retry', (e, backup) => { if (backup) savePrefs({ useBackup: true }); if (win) win.loadURL(backup ? BACKUP : (prefs().useBackup ? BACKUP : HOME)); });

/* screen sharing in calls: choose a screen or window */
let pickerResolve = null;
ipcMain.handle('cuezk:sources', async () => {
  const src = await desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 320, height: 200 } });
  return src.map((s) => ({ id: s.id, name: s.name, thumb: s.thumbnail.toDataURL() }));
});
ipcMain.on('cuezk:picked', (e, id) => { if (pickerResolve) { pickerResolve(id); pickerResolve = null; } });
function pickSource() {
  return new Promise((resolve) => {
    pickerResolve = resolve;
    const pk = new BrowserWindow({ parent: win, modal: true, width: 760, height: 560, title: 'Share your screen', backgroundColor: '#0b1220', autoHideMenuBar: true,
      webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true } });
    pk.loadFile(path.join(__dirname, 'picker.html'));
    pk.on('closed', () => { if (pickerResolve) { pickerResolve(null); pickerResolve = null; } });
  });
}

app.whenReady().then(() => {
  const ses = session.fromPartition('persist:cuezk');
  // only CueZK / OnCue may use the camera, microphone, notifications and screen sharing
  ses.setPermissionRequestHandler((wc, perm, cb, details) => {
    const ok = isOwn(details.requestingUrl || wc.getURL()) && ['media', 'notifications', 'clipboard-sanitized-write', 'fullscreen', 'display-capture', 'speaker-selection'].includes(perm);
    cb(ok);
  });
  ses.setPermissionCheckHandler((wc, perm, origin) => isOwn(origin || '') && ['media', 'notifications', 'clipboard-sanitized-write', 'fullscreen', 'display-capture'].includes(perm));
  ses.setDisplayMediaRequestHandler(async (req, cb) => {
    if (!isOwn(req.frame ? req.frame.url : (win ? win.webContents.getURL() : ''))) { cb({}); return; }
    const id = await pickSource();
    if (!id) { cb({}); return; }
    const src = (await desktopCapturer.getSources({ types: ['screen', 'window'] })).find((s) => s.id === id);
    cb(src ? { video: src } : {});
  });
  createWindow();
  buildTray();
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
    { label: 'CueZK', submenu: [{ label: 'Reload', accelerator: 'CmdOrCtrl+R', click: () => win && win.reload() }, { type: 'separator' }, { label: 'Quit', accelerator: 'CmdOrCtrl+Q', click: () => { quitting = true; app.quit(); } }] },
    { role: 'editMenu' },
    { label: 'View', submenu: [{ role: 'zoomIn' }, { role: 'zoomOut' }, { role: 'resetZoom' }, { type: 'separator' }, { role: 'togglefullscreen' }] },
    { role: 'windowMenu' },
  ]));
  // updates: new versions download in the background and install when CueZK restarts (Windows and Linux; Mac once the app is signed)
  try {
    const { autoUpdater } = require('electron-updater');
    autoUpdater.autoDownload = true;
    autoUpdater.on('update-downloaded', () => { try { new Notification({ title: 'CueZK update ready', body: 'The new version installs the next time CueZK restarts.' }).show(); } catch (e) {} });
    autoUpdater.checkForUpdates().catch(() => {});
    setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), 6 * 3600 * 1000);
  } catch (e) {}
});
app.on('activate', show);
app.on('before-quit', () => { quitting = true; });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
// nothing else may be opened inside CueZK (extra safety: no other windows, no webviews)
app.on('web-contents-created', (e, wc) => { wc.on('will-attach-webview', (ev) => ev.preventDefault()); });
