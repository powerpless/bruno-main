const simpleGit = require('simple-git');
const {
  getCollectionGitRootPath,
  fetchRemotes,
  fetchChanges,
  getBehindCount,
  getCurrentGitBranch,
  pullGitChanges
} = require('../utils/git');
const { acquireGitLock, readBrunoConfig } = require('../utils/auto-git');
const { uuid } = require('../utils/common');
const collectionWatcher = require('./collection-watcher');

const notifiedGitRoots = new Map();

class GitAutoSync {
  constructor() {
    this.intervalId = null;
    this.isRunning = false;
  }

  start(win, intervalMs = 120000) {
    if (this.isRunning) return;
    this.isRunning = true;
    this.win = win;
    this.intervalMs = intervalMs;
    // Delay the first check so collections are fully mounted; then schedule recurring.
    this.intervalId = setTimeout(async () => {
      await this.checkAllCollections(win);
      this.scheduleNextCheck(win, intervalMs);
    }, 15000);
  }

  stop() {
    if (this.intervalId) {
      clearTimeout(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
  }

  scheduleNextCheck(win, intervalMs) {
    if (!this.isRunning) return;

    this.intervalId = setTimeout(async () => {
      await this.checkAllCollections(win);
      this.scheduleNextCheck(win, intervalMs);
    }, intervalMs);
  }

  async checkAllCollections(win) {
    if (!win || win.isDestroyed()) return;

    const collectionPaths = collectionWatcher.getAllWatcherPaths();
    const processedGitRoots = new Set();

    for (const collectionPath of collectionPaths) {
      try {
        const gitRootPath = getCollectionGitRootPath(collectionPath);
        if (!gitRootPath || processedGitRoots.has(gitRootPath)) continue;
        processedGitRoots.add(gitRootPath);

        const remotes = await fetchRemotes(gitRootPath);
        if (!remotes || remotes.length === 0) continue;

        try {
          await fetchChanges(gitRootPath, 'origin');
        } catch (err) {
          // offline or auth issue — skip this cycle silently
          continue;
        }

        const behindStatus = await getBehindCount(gitRootPath).catch(() => ({ behind: 0, commits: [] }));
        if (behindStatus.behind === 0) {
          notifiedGitRoots.delete(gitRootPath);
          continue;
        }

        const currentBranch = await getCurrentGitBranch(gitRootPath);

        // Emit notification so UI can show a "N commits behind → Update" banner.
        // De-dupe: only re-notify if behind count changed.
        const lastNotified = notifiedGitRoots.get(gitRootPath);
        if (lastNotified !== behindStatus.behind) {
          win.webContents.send('main:auto-git-status', {
            type: 'remote-changes-available',
            collectionPath,
            gitRootPath,
            branch: currentBranch,
            behind: behindStatus.behind,
            commits: behindStatus.commits || []
          });
          notifiedGitRoots.set(gitRootPath, behindStatus.behind);
        }

        // Decide whether to auto-pull
        const brunoConfig = readBrunoConfig(collectionPath);
        if (!brunoConfig?.git?.autoPull) continue;

        // Check for uncommitted changes — if present, do not auto-pull (user will be prompted via UI)
        const git = simpleGit(gitRootPath);
        const status = await git.status();
        if (status.files.length > 0) {
          win.webContents.send('main:auto-git-status', {
            type: 'auto-pull-blocked',
            collectionPath,
            gitRootPath,
            branch: currentBranch,
            message: 'Uncommitted local changes — pull manually or commit first'
          });
          continue;
        }

        let release;
        try {
          release = await acquireGitLock(gitRootPath);
          const processUid = uuid();
          await pullGitChanges(win, {
            gitRootPath,
            processUid,
            remote: 'origin',
            remoteBranch: currentBranch,
            strategy: '--ff-only'
          });
          notifiedGitRoots.delete(gitRootPath);
          win.webContents.send('main:auto-git-status', {
            type: 'auto-pulled',
            collectionPath,
            gitRootPath,
            branch: currentBranch,
            behind: behindStatus.behind
          });
        } catch (error) {
          const msg = error.message || '';
          const isDiverged = /fast-forward|diverged/i.test(msg);
          win.webContents.send('main:auto-git-status', {
            type: isDiverged ? 'pull-conflict' : 'error',
            collectionPath,
            gitRootPath,
            branch: currentBranch,
            message: isDiverged
              ? 'Branches diverged — manual pull (Rebase) required'
              : `Auto-pull failed: ${msg}`
          });
        } finally {
          if (release) release();
        }
      } catch (error) {
        console.error(`Auto-sync check failed for ${collectionPath}:`, error.message);
      }
    }
  }
}

module.exports = GitAutoSync;
