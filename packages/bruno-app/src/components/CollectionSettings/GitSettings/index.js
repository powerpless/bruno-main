import React, { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { get } from 'lodash';
import toast from 'react-hot-toast';
import { updateCollectionGitConfig } from 'providers/ReduxStore/slices/collections';
import { saveCollectionSettings } from 'providers/ReduxStore/slices/collections/actions';
import Button from 'ui/Button';
import StyledWrapper from './StyledWrapper';

const GitSettings = ({ collection }) => {
  const dispatch = useDispatch();
  const { ipcRenderer } = window;

  const gitConfig = collection.draft?.brunoConfig
    ? get(collection, 'draft.brunoConfig.git', {})
    : get(collection, 'brunoConfig.git', {});

  const [remoteUrl, setRemoteUrl] = useState('');
  const [autoCommitPush, setAutoCommitPush] = useState(gitConfig?.autoCommitPush || false);
  const [autoPull, setAutoPull] = useState(gitConfig?.autoPull || false);

  useEffect(() => {
    ipcRenderer
      .invoke('renderer:get-git-remote-url', collection.pathname)
      .then((url) => setRemoteUrl(url || ''))
      .catch(() => setRemoteUrl(''));
  }, [collection.pathname]);

  const handleSave = async () => {
    try {
      // Save remote URL if provided
      if (remoteUrl.trim()) {
        await ipcRenderer.invoke('renderer:set-git-remote-url', {
          collectionPath: collection.pathname,
          url: remoteUrl.trim()
        });
      }

      // Save git config to brunoConfig
      dispatch(
        updateCollectionGitConfig({
          collectionUid: collection.uid,
          git: { autoCommitPush, autoPull }
        })
      );

      dispatch(saveCollectionSettings(collection.uid));
      toast.success('Git settings saved');
    } catch (error) {
      toast.error(error.message || 'Failed to save git settings');
    }
  };

  return (
    <StyledWrapper className="w-full">
      <div className="flex flex-col gap-4 max-w-lg">

        {/* Remote URL */}
        <div>
          <label className="block text-sm font-medium mb-1">Remote Repository URL</label>
          <input
            type="text"
            className="textbox"
            placeholder="https://github.com/user/repo.git"
            value={remoteUrl}
            onChange={(e) => setRemoteUrl(e.target.value)}
          />
          <p className="text-xs mt-1 opacity-60">Git repository where changes will be pushed (origin)</p>
        </div>

        {/* Auto Commit & Push */}
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="autoCommitPush"
            checked={autoCommitPush}
            onChange={(e) => setAutoCommitPush(e.target.checked)}
          />
          <label htmlFor="autoCommitPush" className="toggle-label cursor-pointer">
            Auto Commit &amp; Push on Save
          </label>
        </div>
        <p className="text-xs -mt-3 opacity-60">
          Automatically commit and push changes every time you save a request
        </p>

        {/* Auto Pull */}
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="autoPull"
            checked={autoPull}
            onChange={(e) => setAutoPull(e.target.checked)}
          />
          <label htmlFor="autoPull" className="toggle-label cursor-pointer">
            Auto Pull (every 2 minutes)
          </label>
        </div>
        <p className="text-xs -mt-3 opacity-60">
          Automatically pull remote changes every 2 minutes
        </p>

        <div className="mt-2">
          <Button variant="primary" onClick={handleSave}>
            Save
          </Button>
        </div>
      </div>
    </StyledWrapper>
  );
};

export default GitSettings;
