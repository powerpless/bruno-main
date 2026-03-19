const { ipcMain } = require('electron');
const fs = require('fs');
const { exec } = require('child_process');
const { cloneGitRepository, cloneSparseCollection, getCollectionGitRootPath, getCollectionGitRepoUrl, fetchRemotes, addRemote, getChangedFilesInCollectionGit, stageChanges, commitChanges, getCurrentGitBranch, pushGitChanges, getUnstagedFileDiff, getStagedFileDiff, discardChanges } = require('../utils/git');
const path = require('path');
const { uuid } = require('../utils/common');
const { createDirectory, removeDirectory } = require('../utils/filesystem');
const simpleGit = require('simple-git');

const isPushRejected = (error) => {
  const msg = error?.message || '';
  return (
    msg.includes('rejected')
    || msg.includes('non-fast-forward')
    || msg.includes('fetch first')
    || msg.includes('Updates were rejected')
  );
};

const registerGitIpc = (mainWindow) => {
  ipcMain.handle('renderer:clone-git-repository', async (event, { url, path, processUid, collectionPath }) => {
    let directoryCreated = false;
    try {
      await createDirectory(path);
      directoryCreated = true;
      if (collectionPath && collectionPath.trim()) {
        await cloneSparseCollection(mainWindow, { url, path, collectionPath: collectionPath.trim(), processUid });
      } else {
        await cloneGitRepository(mainWindow, { url, path, processUid });
      }
      return 'Repository cloned successfully';
    } catch (error) {
      if (directoryCreated) {
        await removeDirectory(path);
      }
      return Promise.reject(error);
    }
  });

  ipcMain.handle('renderer:get-git-remote-url', async (event, collectionPath) => {
    try {
      const gitRootPath = getCollectionGitRootPath(collectionPath);
      if (!gitRootPath) return null;
      const url = await getCollectionGitRepoUrl(gitRootPath);
      // getCollectionGitRepoUrl returns the url or the remote name if not configured
      if (!url || url.trim() === 'origin') return null;
      return url.trim();
    } catch (error) {
      return null;
    }
  });

  ipcMain.handle('renderer:get-git-changed-files', async (event, collectionPath) => {
    try {
      const gitRootPath = getCollectionGitRootPath(collectionPath);
      if (!gitRootPath) return { staged: [], unstaged: [], conflicted: [] };
      const changes = await getChangedFilesInCollectionGit(gitRootPath, collectionPath);
      return {
        staged: changes.staged || [],
        unstaged: changes.unstaged || [],
        conflicted: changes.conflicted || []
      };
    } catch (error) {
      return { staged: [], unstaged: [], conflicted: [] };
    }
  });

  ipcMain.handle('renderer:get-git-file-diff', async (event, { collectionPath, filePath, type }) => {
    try {
      const gitRootPath = getCollectionGitRootPath(collectionPath);
      if (!gitRootPath) return '';
      const absolutePath = path.join(gitRootPath, filePath);
      if (type === 'staged') {
        return await getStagedFileDiff(gitRootPath, absolutePath);
      } else {
        return await getUnstagedFileDiff(gitRootPath, absolutePath);
      }
    } catch (error) {
      return '';
    }
  });

  ipcMain.handle('renderer:manual-git-commit-push', async (event, { collectionPath, commitMessage }) => {
    try {
      const gitRootPath = getCollectionGitRootPath(collectionPath);
      if (!gitRootPath) throw new Error('Not a git repository');

      const remotes = await fetchRemotes(gitRootPath);
      if (!remotes || remotes.length === 0) throw new Error('No remote configured. Please set a remote URL in Git settings.');

      const changes = await getChangedFilesInCollectionGit(gitRootPath, collectionPath);
      const allFiles = [...(changes.staged || []), ...(changes.unstaged || [])];
      if (allFiles.length === 0) throw new Error('No changes to commit');

      const filePaths = allFiles.map((file) => path.join(gitRootPath, file.path));
      await stageChanges(gitRootPath, filePaths);
      await commitChanges(gitRootPath, commitMessage);

      const branch = await getCurrentGitBranch(gitRootPath);
      try {
        await pushGitChanges(mainWindow, { gitRootPath, processUid: uuid(), remote: 'origin', remoteBranch: branch });
      } catch (pushError) {
        if (isPushRejected(pushError)) {
          const err = new Error('Remote has new changes. Rebase and push?');
          err.needsRebase = true;
          return Promise.reject(err);
        }
        throw pushError;
      }

      return { branch, filesChanged: allFiles.length };
    } catch (error) {
      return Promise.reject(error);
    }
  });

  ipcMain.handle('renderer:git-rebase-and-push', async (event, collectionPath) => {
    try {
      const gitRootPath = getCollectionGitRootPath(collectionPath);
      if (!gitRootPath) throw new Error('Not a git repository');

      const branch = await getCurrentGitBranch(gitRootPath);
      const git = simpleGit(gitRootPath);
      await git.pull('origin', branch, ['--rebase']);
      await pushGitChanges(mainWindow, { gitRootPath, processUid: uuid(), remote: 'origin', remoteBranch: branch });

      return { branch };
    } catch (error) {
      const isConflict = error.message?.includes('conflict') || error.message?.includes('CONFLICT');
      const err = new Error(isConflict
        ? 'Merge conflict — resolve conflicts manually, then commit.'
        : (error.message || 'Rebase failed'));
      return Promise.reject(err);
    }
  });

  ipcMain.handle('renderer:git-discard-file', async (event, { collectionPath, filePath }) => {
    try {
      const gitRootPath = getCollectionGitRootPath(collectionPath);
      if (!gitRootPath) throw new Error('Not a git repository');
      const absolutePath = path.join(gitRootPath, filePath);
      await discardChanges(gitRootPath, [absolutePath]);
      return true;
    } catch (error) {
      return Promise.reject(error);
    }
  });

  ipcMain.handle('renderer:git-get-conflict-content', async (event, { collectionPath, filePath }) => {
    try {
      const gitRootPath = getCollectionGitRootPath(collectionPath);
      if (!gitRootPath) throw new Error('Not a git repository');
      const absolutePath = path.join(gitRootPath, filePath);
      const content = fs.readFileSync(absolutePath, 'utf8');
      return content;
    } catch (error) {
      return Promise.reject(error);
    }
  });

  ipcMain.handle('renderer:git-resolve-conflict', async (event, { collectionPath, filePath, resolvedContent }) => {
    try {
      const gitRootPath = getCollectionGitRootPath(collectionPath);
      if (!gitRootPath) throw new Error('Not a git repository');
      const absolutePath = path.join(gitRootPath, filePath);
      fs.writeFileSync(absolutePath, resolvedContent, 'utf8');
      await stageChanges(gitRootPath, [absolutePath]);
      return true;
    } catch (error) {
      return Promise.reject(error);
    }
  });

  ipcMain.handle('renderer:git-continue-rebase', async (event, collectionPath) => {
    return new Promise((resolve, reject) => {
      const gitRootPath = getCollectionGitRootPath(collectionPath);
      if (!gitRootPath) return reject(new Error('Not a git repository'));
      exec('git -c core.editor=: rebase --continue', { cwd: gitRootPath }, (err, stdout, stderr) => {
        if (err) return reject(new Error(stderr || err.message));
        resolve(stdout);
      });
    });
  });

  ipcMain.handle('renderer:git-abort-rebase', async (event, collectionPath) => {
    try {
      const gitRootPath = getCollectionGitRootPath(collectionPath);
      if (!gitRootPath) throw new Error('Not a git repository');
      const git = simpleGit(gitRootPath);
      await git.rebase(['--abort']);
      return true;
    } catch (error) {
      return Promise.reject(error);
    }
  });

  ipcMain.handle('renderer:set-git-remote-url', async (event, { collectionPath, url }) => {
    try {
      const gitRootPath = getCollectionGitRootPath(collectionPath);
      if (!gitRootPath) throw new Error('Not a git repository');

      const git = simpleGit(gitRootPath);
      const remotes = await fetchRemotes(gitRootPath);
      const originExists = remotes.some((r) => r.name === 'origin');

      if (originExists) {
        await git.remote(['set-url', 'origin', url]);
      } else {
        await addRemote({ gitRootPath, remoteName: 'origin', remoteUrl: url });
      }
      return url;
    } catch (error) {
      return Promise.reject(error);
    }
  });
};

module.exports = registerGitIpc;
