const { ipcMain, dialog } = require('electron');
const fs = require('fs');
const { exec } = require('child_process');
const { cloneGitRepository, cloneSparseCollection, downloadCollectionFromGit, getCollectionGitRootPath, getCollectionGitRepoUrl, fetchRemotes, fetchChanges, fetchRemoteBranches, getCollectionGitBranches, addRemote, getChangedFilesInCollectionGit, stageChanges, commitChanges, getCurrentGitBranch, pushGitChanges, getUnstagedFileDiff, getStagedFileDiff, discardChanges, initGit, getBehindCount } = require('../utils/git');
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

  ipcMain.handle('renderer:download-collection-from-git', async (event, { url, targetPath, processUid, collectionPath }) => {
    try {
      const fsPromises = require('fs/promises');
      await fsPromises.mkdir(targetPath, { recursive: true });
      await downloadCollectionFromGit(mainWindow, { url, targetPath, collectionPath: collectionPath?.trim() || '', processUid });
      return 'Collection files downloaded successfully';
    } catch (error) {
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

  ipcMain.handle('renderer:manual-git-commit-push', async (event, { collectionPath, commitMessage, targetBranch }) => {
    try {
      const gitRootPath = getCollectionGitRootPath(collectionPath);
      if (!gitRootPath) throw new Error('Not a git repository');

      const remotes = await fetchRemotes(gitRootPath);
      if (!remotes || remotes.length === 0) throw new Error('No remote configured. Please set a remote URL in Git settings.');

      const changes = await getChangedFilesInCollectionGit(gitRootPath, collectionPath);
      const allFiles = [...(changes.staged || []), ...(changes.unstaged || [])];
      if (allFiles.length === 0) throw new Error('No changes to commit');

      const currentBranch = await getCurrentGitBranch(gitRootPath);
      const effectiveTarget = (targetBranch && targetBranch.trim()) || currentBranch;

      // If user picked a different branch, require it to already exist locally — never silently create.
      if (effectiveTarget !== currentBranch) {
        const git = simpleGit(gitRootPath);
        const locals = await getCollectionGitBranches(gitRootPath);
        if (locals.includes(effectiveTarget)) {
          await git.checkout(effectiveTarget);
        } else {
          throw new Error(
            `Branch "${effectiveTarget}" does not exist locally. `
            + `Create or switch to it in your terminal first (e.g. "git checkout -b ${effectiveTarget}"), `
            + `then commit & push from there.`
          );
        }
      }

      const filePaths = allFiles.map((file) => path.join(gitRootPath, file.path));
      await stageChanges(gitRootPath, filePaths);
      await commitChanges(gitRootPath, commitMessage);

      try {
        await pushGitChanges(mainWindow, { gitRootPath, processUid: uuid(), remote: 'origin', remoteBranch: effectiveTarget });
      } catch (pushError) {
        if (isPushRejected(pushError)) {
          const err = new Error('Remote has new changes. Rebase and push?');
          err.needsRebase = true;
          return Promise.reject(err);
        }
        throw pushError;
      }

      return { branch: effectiveTarget, filesChanged: allFiles.length };
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

  ipcMain.handle('renderer:get-git-branches', async (event, collectionPath) => {
    try {
      const gitRootPath = getCollectionGitRootPath(collectionPath);
      if (!gitRootPath) return { local: [], remote: [], current: null, default: null };

      // Try to fetch from origin (best-effort; offline / no-remote must not break listing)
      try {
        const remotes = await fetchRemotes(gitRootPath);
        if (remotes && remotes.length > 0) {
          await fetchChanges(gitRootPath, 'origin');
        }
      } catch (err) {
        // continue with cached refs
      }

      const [local, current, remote] = await Promise.all([
        getCollectionGitBranches(gitRootPath).catch(() => []),
        getCurrentGitBranch(gitRootPath).catch(() => null),
        fetchRemoteBranches({ gitRootPath, remote: 'origin' }).catch(() => [])
      ]);

      let defaultBranch = null;
      if (local.includes('main')) defaultBranch = 'main';
      else if (local.includes('master')) defaultBranch = 'master';
      else if (remote.includes('main')) defaultBranch = 'main';
      else if (remote.includes('master')) defaultBranch = 'master';
      else defaultBranch = current;

      return { local, remote, current, default: defaultBranch };
    } catch (error) {
      return { local: [], remote: [], current: null, default: null };
    }
  });

  ipcMain.handle('renderer:manual-git-pull', async (event, { collectionPath, branch, strategy }) => {
    try {
      const gitRootPath = getCollectionGitRootPath(collectionPath);
      if (!gitRootPath) throw new Error('Not a git repository');

      const remotes = await fetchRemotes(gitRootPath);
      if (!remotes || remotes.length === 0) throw new Error('No remote configured');

      const git = simpleGit(gitRootPath);
      const currentBranch = await getCurrentGitBranch(gitRootPath);
      const targetBranch = branch || currentBranch;

      if (targetBranch !== currentBranch) {
        const locals = await getCollectionGitBranches(gitRootPath);
        if (locals.includes(targetBranch)) {
          await git.checkout(targetBranch);
        } else {
          throw new Error(
            `Branch "${targetBranch}" does not exist locally. `
            + `To work on it, switch to it in your terminal first: git checkout ${targetBranch}`
          );
        }
      }

      const pullArgs = ['--autostash'];
      const mode = strategy || 'rebase';
      if (mode === 'ff-only') pullArgs.push('--ff-only');
      else if (mode === 'rebase') pullArgs.push('--rebase');
      else pullArgs.push('--no-rebase');

      const result = await git.pull('origin', targetBranch, pullArgs);
      const behind = await getBehindCount(gitRootPath).catch(() => ({ behind: 0 }));

      return {
        branch: targetBranch,
        behind: behind.behind,
        summary: result?.summary || {}
      };
    } catch (error) {
      const msg = error.message || 'Pull failed';
      const isConflict = /conflict|CONFLICT/.test(msg);
      const isDiverged = /not possible to fast-forward|diverged/i.test(msg);
      let reason;
      if (isConflict) {
        reason = 'Merge conflict - resolve manually in Git settings';
      } else if (isDiverged) {
        reason = 'Branches have diverged - try Rebase strategy';
      } else {
        reason = msg;
      }
      const err = new Error(reason);
      return Promise.reject(err);
    }
  });

  ipcMain.handle('renderer:git-check-remote-updates', async (event, collectionPath) => {
    try {
      const gitRootPath = getCollectionGitRootPath(collectionPath);
      if (!gitRootPath) return { behind: 0, branch: null, hasRemote: false };

      const remotes = await fetchRemotes(gitRootPath);
      if (!remotes || remotes.length === 0) return { behind: 0, branch: null, hasRemote: false };

      try {
        await fetchChanges(gitRootPath, 'origin');
      } catch {}

      const [behindStatus, branch] = await Promise.all([
        getBehindCount(gitRootPath).catch(() => ({ behind: 0, commits: [] })),
        getCurrentGitBranch(gitRootPath).catch(() => null)
      ]);

      return { behind: behindStatus.behind || 0, commits: behindStatus.commits || [], branch, hasRemote: true };
    } catch (error) {
      return { behind: 0, branch: null, hasRemote: false };
    }
  });

  ipcMain.handle('renderer:pick-and-import-bru-files', async (event, { targetFolderPath }) => {
    try {
      if (!targetFolderPath || !fs.existsSync(targetFolderPath) || !fs.statSync(targetFolderPath).isDirectory()) {
        throw new Error('Target is not a valid folder');
      }

      const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
        title: 'Import .bru files',
        properties: ['openFile', 'multiSelections'],
        filters: [
          { name: 'Bruno files', extensions: ['bru', 'yml', 'yaml', 'json'] },
          { name: 'All files', extensions: ['*'] }
        ]
      });

      if (canceled || !filePaths || filePaths.length === 0) {
        return { imported: [], failed: [], cancelled: true };
      }

      const imported = [];
      const failed = [];
      for (const source of filePaths) {
        try {
          const baseName = path.basename(source);
          const ext = path.extname(baseName).toLowerCase();
          if (!['.bru', '.yml', '.yaml', '.json'].includes(ext)) {
            failed.push({ path: source, reason: 'unsupported extension' });
            continue;
          }

          const { name, ext: parsedExt } = path.parse(baseName);
          let destPath = path.join(targetFolderPath, baseName);
          let counter = 1;
          while (fs.existsSync(destPath)) {
            destPath = path.join(targetFolderPath, `${name}-${counter}${parsedExt}`);
            counter++;
          }

          fs.copyFileSync(source, destPath);
          imported.push({ source, destPath, fileName: path.basename(destPath) });
        } catch (e) {
          failed.push({ path: source, reason: e.message });
        }
      }

      return { imported, failed, cancelled: false };
    } catch (error) {
      return Promise.reject(error);
    }
  });

  ipcMain.handle('renderer:import-bru-file', async (event, { sourceFilePath, targetFolderPath }) => {
    try {
      if (!sourceFilePath || !targetFolderPath) {
        throw new Error('Missing source or target path');
      }
      if (!fs.existsSync(sourceFilePath)) {
        throw new Error('Source file does not exist');
      }
      if (!fs.existsSync(targetFolderPath) || !fs.statSync(targetFolderPath).isDirectory()) {
        throw new Error('Target is not a valid folder');
      }

      const baseName = path.basename(sourceFilePath);
      const ext = path.extname(baseName).toLowerCase();
      if (!['.bru', '.yml', '.yaml', '.json'].includes(ext)) {
        throw new Error('Only .bru/.yml/.yaml/.json files can be imported');
      }

      const resolvedSource = path.resolve(sourceFilePath);
      const resolvedTargetDir = path.resolve(targetFolderPath);
      if (path.dirname(resolvedSource) === resolvedTargetDir) {
        throw new Error('File is already in this folder');
      }

      const { name, ext: parsedExt } = path.parse(baseName);
      let destPath = path.join(resolvedTargetDir, baseName);
      let counter = 1;
      while (fs.existsSync(destPath)) {
        destPath = path.join(resolvedTargetDir, `${name}-${counter}${parsedExt}`);
        counter++;
      }

      fs.copyFileSync(resolvedSource, destPath);
      return { destPath, fileName: path.basename(destPath) };
    } catch (error) {
      return Promise.reject(error);
    }
  });

  ipcMain.handle('renderer:set-git-remote-url', async (event, { collectionPath, url }) => {
    try {
      let gitRootPath = getCollectionGitRootPath(collectionPath);
      if (!gitRootPath) {
        await initGit(collectionPath);
        gitRootPath = collectionPath;
      }

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
