const { autoUpdater } = require('electron-updater');
const { ipcMain } = require('electron');

// ─── НАСТРОЙКИ (заполни под свой репозиторий) ────────────────────────────────
const UPDATE_CONFIG = {
  provider: 'github',
  owner: process.env.GH_OWNER || 'powerpless',
  repo: process.env.GH_REPO || 'bruno-main'
};
// ─────────────────────────────────────────────────────────────────────────────

const setupAutoUpdater = (mainWindow) => {
  autoUpdater.setFeedURL(UPDATE_CONFIG);
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  // Enable file logging for electron-updater so users can share logs when troubleshooting.
  try {
    const log = require('electron-log');
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
  } catch {
    // electron-log is a transitive dep of electron-updater; if missing, continue without file logs
  }

  const send = (channel, data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(channel, data);
    }
  };

  autoUpdater.on('update-available', (info) => {
    send('main:update-available', { version: info.version, releaseNotes: info.releaseNotes });
  });

  autoUpdater.on('update-not-available', () => {
    // silent
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
    console.error('[auto-updater] error:', err && err.stack || err);
    send('main:update-error', { message: (err && err.message) || String(err) });
  });

  ipcMain.handle('renderer:download-update', async () => {
    try {
      const result = await autoUpdater.downloadUpdate();
      return { ok: true, result };
    } catch (err) {
      send('main:update-error', { message: err?.message || 'Download failed' });
      return Promise.reject(err);
    }
  });

  ipcMain.handle('renderer:install-update', () => {
    try {
      autoUpdater.quitAndInstall(false, true);
      return { ok: true };
    } catch (err) {
      send('main:update-error', { message: err?.message || 'Install failed' });
      return Promise.reject(err);
    }
  });

  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      console.error('[auto-updater] check failed:', err.message);
      send('main:update-error', { message: `Check failed: ${err.message || err}` });
    });
  }, 8000);
};

module.exports = { setupAutoUpdater };
