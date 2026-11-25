/* CueZK desktop: the only things the web page can ask of the app. Nothing else from the computer is reachable. */
'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('cuezkDesktop', {
  version: '1.0.0',
  badge: (n) => ipcRenderer.send('cuezk:badge', Number(n) || 0),          // the unread count on the taskbar / dock
  retry: (backup) => ipcRenderer.send('cuezk:retry', !!backup),          // the offline page's buttons
  sources: () => ipcRenderer.invoke('cuezk:sources'),                     // the screen-sharing picker
  pick: (id) => ipcRenderer.send('cuezk:picked', id || null),
});
