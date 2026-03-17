const { ipcMain } = require('electron');
const { cloneGitRepository, getCollectionGitRootPath, getCollectionGitRepoUrl, fetchRemotes, addRemote } = require('../utils/git');
const { createDirectory, removeDirectory } = require('../utils/filesystem');
const simpleGit = require('simple-git');

const registerGitIpc = (mainWindow) => {
  ipcMain.handle('renderer:clone-git-repository', async (event, { url, path, processUid }) => {
    let directoryCreated = false;
    try {
      await createDirectory(path);
      directoryCreated = true;
      await cloneGitRepository(mainWindow, { url, path, processUid });
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
