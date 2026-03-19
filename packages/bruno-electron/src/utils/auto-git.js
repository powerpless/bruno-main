const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const simpleGit = require('simple-git');
const {
  getCollectionGitRootPath,
  fetchRemotes,
  getChangedFilesInCollectionGit,
  stageChanges,
  commitChanges,
  getCurrentGitBranch,
  pushGitChanges
} = require('./git');
const { uuid } = require('./common');

const isPushRejected = (error) => {
  const msg = error?.message || '';
  return (
    msg.includes('rejected')
    || msg.includes('non-fast-forward')
    || msg.includes('fetch first')
    || msg.includes('Updates were rejected')
  );
};

// Per-gitRootPath mutex to serialize git operations (shared with git-auto-sync)
const activeLocks = new Map();

const acquireGitLock = (gitRootPath) => {
  const current = activeLocks.get(gitRootPath) || Promise.resolve();
  let release;
  const next = new Promise((resolve) => {
    release = resolve;
  });
  activeLocks.set(gitRootPath, current.then(() => next));
  return current.then(() => release);
};

// Per-gitRootPath debounce timers
const debounceTimers = new Map();

const readBrunoConfig = (collectionPath) => {
  // BRU format: bruno.json
  try {
    const jsonPath = path.join(collectionPath, 'bruno.json');
    if (fs.existsSync(jsonPath)) {
      return JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    }
  } catch (err) {
    // ignore
  }

  // YML format: opencollection.yml — git config lives under extensions.bruno.git
  try {
    const ymlPath = path.join(collectionPath, 'opencollection.yml');
    if (fs.existsSync(ymlPath)) {
      const doc = yaml.load(fs.readFileSync(ymlPath, 'utf8'));
      const git = doc?.extensions?.bruno?.git;
      return git ? { git } : null;
    }
  } catch (err) {
    // ignore
  }

  return null;
};

const autoCommitAndPush = (win, collectionPath) => {
  if (!win || !collectionPath) return;

  const gitRootPath = getCollectionGitRootPath(collectionPath);
  if (!gitRootPath) return;

  const brunoConfig = readBrunoConfig(collectionPath);
  if (!brunoConfig?.git?.autoCommitPush) return;

  // Debounce: clear previous timer for this gitRootPath, set new 2-second timer
  const existingTimer = debounceTimers.get(gitRootPath);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  const timer = setTimeout(() => {
    debounceTimers.delete(gitRootPath);
    _executeCommitAndPush(win, gitRootPath, collectionPath);
  }, 2000);

  debounceTimers.set(gitRootPath, timer);
};

const _executeCommitAndPush = async (win, gitRootPath, collectionPath) => {
  let release;
  try {
    // Check for remotes
    const remotes = await fetchRemotes(gitRootPath);
    if (!remotes || remotes.length === 0) return;

    // Acquire mutex
    release = await acquireGitLock(gitRootPath);

    // Get changed files
    const changes = await getChangedFilesInCollectionGit(gitRootPath, collectionPath);
    const allFiles = [...(changes.staged || []), ...(changes.unstaged || [])];
    if (allFiles.length === 0) {
      release();
      return;
    }

    // Stage all changed files (use absolute paths)
    const filePaths = allFiles.map((file) => path.join(gitRootPath, file.path));
    await stageChanges(gitRootPath, filePaths);

    // Commit
    const timestamp = new Date().toISOString();
    await commitChanges(gitRootPath, `[Bruno] auto-save: ${timestamp}`);

    // Get current branch and push
    const currentBranch = await getCurrentGitBranch(gitRootPath);
    const processUid = uuid();

    try {
      await pushGitChanges(win, { gitRootPath, processUid, remote: 'origin', remoteBranch: currentBranch });
    } catch (pushError) {
      if (isPushRejected(pushError)) {
        // Remote is ahead — try rebase and retry push
        const git = simpleGit(gitRootPath);
        await git.pull('origin', currentBranch, ['--rebase']);
        await pushGitChanges(win, { gitRootPath, processUid: uuid(), remote: 'origin', remoteBranch: currentBranch });
        if (win && !win.isDestroyed()) {
          win.webContents.send('main:auto-git-status', { type: 'info', message: 'Rebased and pushed successfully' });
        }
      } else {
        throw pushError;
      }
    }

    release();
  } catch (error) {
    if (release) release();
    console.error('Auto git commit+push failed:', error.message);
    if (win && !win.isDestroyed()) {
      const isConflict = error.message?.includes('conflict') || error.message?.includes('CONFLICT');
      win.webContents.send('main:auto-git-status', {
        type: isConflict ? 'pull-conflict' : 'error',
        message: isConflict ? 'Merge conflict after rebase — manual resolution required' : (error.message || 'Git auto-sync failed')
      });
    }
  }
};

module.exports = {
  autoCommitAndPush,
  acquireGitLock,
  readBrunoConfig
};
