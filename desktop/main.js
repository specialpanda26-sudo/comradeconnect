// Comrade Connect desktop app (Windows, Mac, Linux). Opens the live website, so it is always the newest version,
// and falls back to a copy saved inside the app when there is no internet.
const { app, BrowserWindow, shell, ipcMain, session } = require('electron');
const path = require('path');

const SITE = 'https://comradeconnect.co.ke/';
const SCHEME = 'ke.co.comradeconnect.app';          // the Google sign-in page hands the result back through this link
let win = null, pendingUrl = null;

if (process.defaultApp && process.argv.length >= 2) app.setAsDefaultProtocolClient(SCHEME, process.execPath, [path.resolve(process.argv[1])]);
else app.setAsDefaultProtocolClient(SCHEME);

const isSite = (u) => { try { const h = new URL(u).hostname; return h === 'comradeconnect.co.ke' || h.endsWith('.comradeconnect.co.ke'); } catch (e) { return false; } };
const external = (u) => { if (/^https?:\/\//i.test(u)) shell.openExternal(u); };
const handoff = (u) => { if (!String(u).startsWith(SCHEME + '://')) return; if (win && !win.webContents.isLoading()) win.webContents.send('app-url', u); else pendingUrl = u; };

function create() {
  win = new BrowserWindow({
    width: 1240, height: 820, minWidth: 380, minHeight: 560, backgroundColor: '#000000', title: 'Comrade Connect', autoHideMenuBar: true,
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true, nodeIntegration: false, spellcheck: true }
  });
  win.loadURL(SITE);
  win.webContents.on('did-fail-load', (e, code, desc, url, isMain) => {      // no internet: open the copy inside the app
    if (isMain && code !== -3) win.loadFile(path.join(__dirname, 'site', 'index.html'));
  });
  win.webContents.on('did-finish-load', () => { if (pendingUrl) { win.webContents.send('app-url', pendingUrl); pendingUrl = null; } });
  win.webContents.setWindowOpenHandler(({ url }) => { external(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!isSite(url) && !url.startsWith('file:')) { e.preventDefault(); external(url); } });
  win.on('closed', () => { win = null; });
}

// location (Wi-Fi map), camera and microphone (live) are allowed for our own site only
app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((wc, permission, cb, details) => {
    const ok = ['geolocation', 'media', 'notifications', 'clipboard-sanitized-write', 'fullscreen'].includes(permission);
    cb(ok && (isSite(details.requestingUrl || '') || String(details.requestingUrl || '').startsWith('file:')));
  });
  create();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) create(); });
});

ipcMain.handle('open-external', (e, u) => { external(String(u || '')); });
ipcMain.handle('quit', () => app.quit());

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', (e, argv) => {                                   // Windows and Linux: the sign-in link arrives here
    if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
    handoff(argv.find((a) => a.startsWith(SCHEME + '://')));
  });
  app.on('open-url', (e, u) => { e.preventDefault(); handoff(u); });         // Mac
}
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
