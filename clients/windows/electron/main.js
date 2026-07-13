const { app, BrowserWindow, ipcMain, Menu, dialog, shell } = require('electron');
const path = require('path');
const Store = require('electron-store');

const store = new Store({
  defaults: {
    windowBounds: { width: 1200, height: 800 },
    cacheSize: 0,
    startOnBoot: false,
    autoUpdate: true,
    lastCleanTime: null,
  },
});

let mainWindow = null;

function createWindow() {
  const { width, height } = store.get('windowBounds');

  mainWindow = new BrowserWindow({
    width,
    height,
    minWidth: 800,
    minHeight: 600,
    title: 'SkyXing',
    icon: path.join(__dirname, '../public/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
    show: false,
    backgroundColor: '#f9fafb',
    frame: true,
    titleBarStyle: 'default',
  });

  // 开发环境加载 Vite 开发服务器，生产环境加载构建文件
  const isDev = process.env.NODE_ENV !== 'production' || process.argv.includes('--dev');
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('resize', () => {
    const [width, height] = mainWindow.getSize();
    store.set('windowBounds', { width, height });
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 构建应用菜单栏
function buildMenu() {
  const template = [
    {
      label: '文件',
      submenu: [
        { label: '新建窗口', accelerator: 'CmdOrCtrl+N', click: createWindow },
        { type: 'separator' },
        { label: '退出', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() },
      ],
    },
    {
      label: '编辑',
      submenu: [
        { label: '撤销', role: 'undo' },
        { label: '重做', role: 'redo' },
        { type: 'separator' },
        { label: '剪切', role: 'cut' },
        { label: '复制', role: 'copy' },
        { label: '粘贴', role: 'paste' },
        { label: '全选', role: 'selectAll' },
      ],
    },
    {
      label: '视图',
      submenu: [
        { label: '刷新', role: 'reload' },
        { label: '强制刷新', role: 'forceReload' },
        { label: '开发者工具', role: 'toggleDevTools' },
        { type: 'separator' },
        { label: '放大', role: 'zoomIn' },
        { label: '缩小', role: 'zoomOut' },
        { label: '重置缩放', role: 'resetZoom' },
      ],
    },
    {
      label: '设置',
      submenu: [
        {
          label: '软件设置',
          click: () => mainWindow?.webContents.send('open-settings'),
        },
        { type: 'separator' },
        {
          label: '清除缓存',
          click: async () => {
            try {
              await mainWindow?.webContents.session.clearCache();
              await mainWindow?.webContents.session.clearStorageData();
              store.set('lastCleanTime', new Date().toISOString());
              mainWindow?.webContents.send('cache-cleared');
            } catch { /* ignore */ }
          },
        },
      ],
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '关于 SkyXing',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: '关于 SkyXing',
              message: 'SkyXing 桌面客户端',
              detail: `版本: 1.0.0\n一个自由创作的博客平台`,
            });
          },
        },
        {
          label: '访问网站',
          click: () => shell.openExternal('https://skyxing.dpdns.org'),
        },
      ],
    },
  ];

  // macOS 特定菜单
  if (process.platform === 'darwin') {
    template.unshift({
      label: app.getName(),
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// IPC 处理器
ipcMain.handle('get-settings', () => store.store);

ipcMain.handle('set-setting', (_, key, value) => {
  store.set(key, value);
  return true;
});

ipcMain.handle('clear-cache', async () => {
  try {
    await mainWindow?.webContents.session.clearCache();
    await mainWindow?.webContents.session.clearStorageData({
      storages: ['cookies', 'localstorage', 'indexdb', 'serviceworkers'],
    });
    store.set('lastCleanTime', new Date().toISOString());
    store.set('cacheSize', 0);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('get-cache-info', () => {
  const lastClean = store.get('lastCleanTime');
  const cacheSize = store.get('cacheSize');
  return { cacheSize, lastCleanTime: lastClean };
});

ipcMain.handle('get-startup-config', () => {
  return { startOnBoot: store.get('startOnBoot') };
});

ipcMain.handle('set-startup', (_, enable) => {
  app.setLoginItemSettings({
    openAtLogin: enable,
    path: app.getPath('exe'),
  });
  store.set('startOnBoot', enable);
  return true;
});

app.whenReady().then(() => {
  buildMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
