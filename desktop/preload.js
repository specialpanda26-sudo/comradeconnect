// Lets the website's existing app code (written for the Android app) work here: it opens Google sign-in in the
// computer's own browser and receives the result through the ke.co.comradeconnect.app:// link.
const { contextBridge, ipcRenderer } = require('electron');
const listeners = [];
ipcRenderer.on('app-url', (e, url) => { listeners.forEach((cb) => { try { cb({ url }); } catch (x) {} }); });
contextBridge.exposeInMainWorld('Capacitor', {
  isNativePlatform: () => true,
  getPlatform: () => 'electron',
  Plugins: {
    Browser: { open: (o) => ipcRenderer.invoke('open-external', o && o.url), close: () => Promise.resolve(), addListener: () => ({ remove() {} }) },
    App: { addListener: (ev, cb) => { if (ev === 'appUrlOpen') listeners.push(cb); return Promise.resolve({ remove() {} }); }, exitApp: () => ipcRenderer.invoke('quit') }
  }
});
