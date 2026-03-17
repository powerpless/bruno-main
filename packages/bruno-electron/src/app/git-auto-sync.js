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

class GitAutoSync {
  constructor() {
    this.intervalId = null;
    this.isRunning = false;
  }

  start(win, intervalMs = 120000) {
    if (this.isRunning) return;
    this.isRunning = true;
    this.win = win;
    this.scheduleNextPull(win, intervalMs);
  }

  stop() {
    if (this.intervalId) {
      clearTimeout(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
  }

  scheduleNextPull(win, intervalMs) {
    if (!this.isRunning) return;

    this.intervalId = setTimeout(async () => {
      await this.pullAllCollections(win);
      this.scheduleNextPull(win, intervalMs);
    }, intervalMs);
  }

  async pullAllCollections(win) {
    if (!win || win.isDestroyed()) return;

    const collectionPaths = collectionWatcher.getAllWatcherPaths();
    const processedGitRoots = new Set();

    for (const collectionPath of collectionPaths) {
      let release;
      try {
        // Check config
        const brunoConfig = readBrunoConfig(collectionPath);
        if (!brunoConfig?.git?.autoPull) continue;

        // Find git root
        const gitRootPath = getCollectionGitRootPath(collectionPath);
        if (!gitRootPath) continue;

        // Deduplicate: skip if we already processed this git root
        if (processedGitRoots.has(gitRootPath)) continue;
        processedGitRoots.add(gitRootPath);

        // Check for remotes
        const remotes = await fetchRemotes(gitRootPath);
        if (!remotes || remotes.length === 0) continue;

        // Fetch from origin
        await fetchChanges(gitRootPath, 'origin');

        // Check if behind
        const behindStatus = await getBehindCount(gitRootPath);
        if (behindStatus.behind === 0) continue;

        // Acquire mutex (shared with autoCommitAndPush)
        release = await acquireGitLock(gitRootPath);

        // Get current branch and pull
        const currentBranch = await getCurrentGitBranch(gitRootPath);
        const processUid = uuid();
        await pullGitChanges(win, {
          gitRootPath,
          processUid,
          remote: 'origin',
          remoteBranch: currentBranch,
          strategy: '--ff-only'
        });

        release();
      } catch (error) {
        if (release) release();

        if (error.message && error.message.includes('Not possible to fast-forward')) {
          if (win && !win.isDestroyed()) {
            win.webContents.send('main:auto-git-status', {
              type: 'pull-conflict',
              collectionPath,
              message: 'Remote has diverged. Manual merge required.'
            });
          }
        } else {
          console.error(`Auto-pull failed for ${collectionPath}:`, error.message);
        }
      }
    }
  }
}

module.exports = GitAutoSync;
