const { autoUpdater } = require('electron-updater');
const { ipcMain } = require('electron');

// ─── НАСТРОЙКИ (заполни под свой репозиторий) ────────────────────────────────
const UPDATE_CONFIG = {
  provider: 'github',
  owner: process.env.GH_OWNER || 'ТВОЙ_GITHUB_USERNAME',
  repo: process.env.GH_REPO || 'НАЗВАНИЕ_РЕПОЗИТОРИЯ',
  // Токен с правом read:Contents на этот репо (Settings → Developer settings → Fine-grained tokens)
  token: process.env.GH_TOKEN || 'ТВОЙ_GITHUB_TOKEN',
  private: true
};
// ─────────────────────────────────────────────────────────────────────────────

const setupAutoUpdater = (mainWindow) => {
  autoUpdater.setFeedURL(UPDATE_CONFIG);
  autoUpdater.autoDownload = false; // пользователь сам нажимает Download
  autoUpdater.autoInstallOnAppQuit = true;

  const send = (channel, data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(channel, data);
    }
  };

  autoUpdater.on('update-available', (info) => {
    send('main:update-available', { version: info.version, releaseNotes: info.releaseNotes });
  });

  autoUpdater.on('update-not-available', () => {
    // тихо, не показываем ничего
  });

  autoUpdater.on('download-progress', (progress) => {
    send('main:update-progress', {
      percent: Math.round(progress.percent),
      transferred: progress.transferred,
      total: progress.total
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    send('main:update-downloaded', { version: info.version });
  });

  autoUpdater.on('error', (err) => {
    console.error('[auto-updater] error:', err.message);
  });

  // IPC от renderer
  ipcMain.handle('renderer:download-update', () => autoUpdater.downloadUpdate());
  ipcMain.handle('renderer:install-update', () => autoUpdater.quitAndInstall(false, true));

  // Проверяем обновления через 8 секунд после старта (чтобы не тормозить запуск)
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      console.error('[auto-updater] check failed:', err.message);
    });
  }, 8000);
};

module.exports = { setupAutoUpdater };
