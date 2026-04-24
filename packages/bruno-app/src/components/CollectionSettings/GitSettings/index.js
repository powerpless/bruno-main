import React, { useState, useEffect, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { get } from 'lodash';
import toast from 'react-hot-toast';
import { updateCollectionGitConfig } from 'providers/ReduxStore/slices/collections';
import { saveCollectionSettings } from 'providers/ReduxStore/slices/collections/actions';
import Button from 'ui/Button';
import StyledWrapper from './StyledWrapper';

const statusColor = (fileIndex) => {
  if (fileIndex === 'A') return 'text-green-500';
  if (fileIndex === 'D') return 'text-red-500';
  if (fileIndex === 'M') return 'text-yellow-500';
  return 'opacity-50';
};

const diffLineClass = (line) => {
  if (line.startsWith('+') && !line.startsWith('+++')) return 'diff-add';
  if (line.startsWith('-') && !line.startsWith('---')) return 'diff-remove';
  if (line.startsWith('@@')) return 'diff-hunk';
  return 'diff-context';
};

// Parse conflict markers and extract ours/theirs sections
const parseConflict = (content) => {
  const lines = content.split('\n');
  const sections = [];
  let state = 'normal';
  let ours = [];
  let theirs = [];

  for (const line of lines) {
    if (line.startsWith('<<<<<<< ')) {
      state = 'ours'; ours = [];
    } else if (line === '=======' && state === 'ours') {
      state = 'theirs'; theirs = [];
    } else if (line.startsWith('>>>>>>> ') && state === 'theirs') {
      sections.push({ ours: ours.join('\n'), theirs: theirs.join('\n') });
      state = 'normal';
    } else if (state === 'ours') { ours.push(line); } else if (state === 'theirs') { theirs.push(line); }
  }
  return sections;
};

const acceptOurs = (content) => content.replace(/<<<<<<< .+?\n([\s\S]*?)=======\n[\s\S]*?>>>>>>> .+?\n/g, '$1');
const acceptTheirs = (content) => content.replace(/<<<<<<< .+?\n[\s\S]*?=======\n([\s\S]*?)>>>>>>> .+?\n/g, '$1');
const hasConflictMarkers = (content) => content.includes('<<<<<<<') && content.includes('=======') && content.includes('>>>>>>>');

const GitSettings = ({ collection }) => {
  const dispatch = useDispatch();
  const { ipcRenderer } = window;

  const gitConfig = collection.draft?.brunoConfig
    ? get(collection, 'draft.brunoConfig.git', {})
    : get(collection, 'brunoConfig.git', {});

  const [remoteUrl, setRemoteUrl] = useState('');
  const [autoCommitPush, setAutoCommitPush] = useState(gitConfig?.autoCommitPush || false);
  const [autoPull, setAutoPull] = useState(gitConfig?.autoPull || false);
  const [commitMessage, setCommitMessage] = useState('');
  const [isPushing, setIsPushing] = useState(false);
  const [changedFiles, setChangedFiles] = useState([]);
  const [conflictedFiles, setConflictedFiles] = useState([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileDiff, setFileDiff] = useState('');
  const [isLoadingDiff, setIsLoadingDiff] = useState(false);
  const [showRebaseDialog, setShowRebaseDialog] = useState(false);
  const [isRebasing, setIsRebasing] = useState(false);
  // Conflict editor state
  const [conflictFile, setConflictFile] = useState(null);
  const [conflictContent, setConflictContent] = useState('');
  const [resolvedContent, setResolvedContent] = useState('');
  const [conflictSections, setConflictSections] = useState([]);
  // Branches / pull state
  const [branchInfo, setBranchInfo] = useState({ local: [], remote: [], current: null, default: null });
  const [pullBranch, setPullBranch] = useState('');
  const [pushBranch, setPushBranch] = useState('');
  const [pullStrategy, setPullStrategy] = useState('rebase');
  const [isPulling, setIsPulling] = useState(false);
  const [remoteUpdate, setRemoteUpdate] = useState(null);

  const loadChangedFiles = useCallback(async () => {
    setIsLoadingFiles(true);
    try {
      const result = await ipcRenderer.invoke('renderer:get-git-changed-files', collection.pathname);
      const all = [...(result.staged || []), ...(result.unstaged || [])];
      setChangedFiles(all);
      setConflictedFiles(result.conflicted || []);
      setSelectedFile(null);
      setFileDiff('');
    } catch {
      setChangedFiles([]);
      setConflictedFiles([]);
    } finally {
      setIsLoadingFiles(false);
    }
  }, [collection.pathname]);

  const loadFileDiff = useCallback(async (file) => {
    setSelectedFile(file);
    setConflictFile(null);
    setIsLoadingDiff(true);
    setFileDiff('');
    try {
      const diff = await ipcRenderer.invoke('renderer:get-git-file-diff', {
        collectionPath: collection.pathname,
        filePath: file.path,
        type: file.type
      });
      setFileDiff(diff || '');
    } catch {
      setFileDiff('');
    } finally {
      setIsLoadingDiff(false);
    }
  }, [collection.pathname]);

  const openConflictEditor = useCallback(async (file) => {
    setSelectedFile(null);
    setConflictFile(file);
    try {
      const content = await ipcRenderer.invoke('renderer:git-get-conflict-content', {
        collectionPath: collection.pathname,
        filePath: file.path
      });
      setConflictContent(content);
      setResolvedContent(content);
      setConflictSections(parseConflict(content));
    } catch (e) {
      toast.error('Failed to load conflict: ' + e.message);
    }
  }, [collection.pathname]);

  const loadBranches = useCallback(async () => {
    try {
      const info = await ipcRenderer.invoke('renderer:get-git-branches', collection.pathname);
      setBranchInfo(info || { local: [], remote: [], current: null, default: null });
      setPullBranch((prev) => prev || info?.default || info?.current || '');
      setPushBranch((prev) => prev || info?.current || info?.default || '');
    } catch {
      setBranchInfo({ local: [], remote: [], current: null, default: null });
    }
  }, [collection.pathname]);

  const checkRemoteUpdates = useCallback(async () => {
    try {
      const result = await ipcRenderer.invoke('renderer:git-check-remote-updates', collection.pathname);
      if (result?.behind > 0) {
        setRemoteUpdate({ behind: result.behind, branch: result.branch, commits: result.commits || [] });
      } else {
        setRemoteUpdate(null);
      }
    } catch {
      // ignore
    }
  }, [collection.pathname]);

  useEffect(() => {
    ipcRenderer.invoke('renderer:get-git-remote-url', collection.pathname)
      .then((url) => setRemoteUrl(url || ''))
      .catch(() => setRemoteUrl(''));
    loadChangedFiles();
    loadBranches();
    checkRemoteUpdates();
  }, [collection.pathname]);

  useEffect(() => {
    if (!ipcRenderer?.on) return;
    const unsubscribe = ipcRenderer.on('main:auto-git-status', (val) => {
      if (!val) return;
      if (val.collectionPath && val.collectionPath !== collection.pathname) return;
      if (val.type === 'remote-changes-available' && val.behind > 0) {
        setRemoteUpdate({ behind: val.behind, branch: val.branch, commits: val.commits || [] });
      }
      if (val.type === 'auto-pulled') {
        setRemoteUpdate(null);
        loadChangedFiles();
        loadBranches();
      }
    });
    return () => unsubscribe && unsubscribe();
  }, [collection.pathname, loadChangedFiles, loadBranches]);

  const handleSave = async () => {
    try {
      if (remoteUrl.trim()) {
        await ipcRenderer.invoke('renderer:set-git-remote-url', { collectionPath: collection.pathname, url: remoteUrl.trim() });
      }
      dispatch(updateCollectionGitConfig({ collectionUid: collection.uid, git: { autoCommitPush, autoPull } }));
      dispatch(saveCollectionSettings(collection.uid));
      toast.success('Git settings saved');
    } catch (error) {
      toast.error(error.message || 'Failed to save git settings');
    }
  };

  const handleCommitAndPush = async () => {
    setIsPushing(true);
    try {
      const result = await ipcRenderer.invoke('renderer:manual-git-commit-push', {
        collectionPath: collection.pathname,
        commitMessage: commitMessage.trim(),
        targetBranch: (pushBranch || '').trim() || undefined
      });
      toast.success(`Committed and pushed to ${result.branch}`);
      setCommitMessage('');
      await loadChangedFiles();
      await loadBranches();
    } catch (error) {
      if (error.needsRebase) {
        setShowRebaseDialog(true);
      } else {
        toast.error(error.message || 'Commit & push failed');
      }
    } finally {
      setIsPushing(false);
    }
  };

  const handlePull = async () => {
    if (!pullBranch) {
      toast.error('Select a branch to pull from');
      return;
    }
    setIsPulling(true);
    try {
      const result = await ipcRenderer.invoke('renderer:manual-git-pull', {
        collectionPath: collection.pathname,
        branch: pullBranch,
        strategy: pullStrategy
      });
      toast.success(`Pulled from origin/${result.branch}`);
      setRemoteUpdate(null);
      await loadChangedFiles();
      await loadBranches();
    } catch (error) {
      toast.error(error.message || 'Pull failed');
    } finally {
      setIsPulling(false);
    }
  };

  const handleOneClickUpdate = async () => {
    if (!remoteUpdate) return;
    const targetBranch = remoteUpdate.branch || pullBranch || branchInfo.current;
    setIsPulling(true);
    try {
      const result = await ipcRenderer.invoke('renderer:manual-git-pull', {
        collectionPath: collection.pathname,
        branch: targetBranch,
        strategy: 'rebase'
      });
      toast.success(`Updated from origin/${result.branch}`);
      setRemoteUpdate(null);
      await loadChangedFiles();
      await loadBranches();
    } catch (error) {
      toast.error(error.message || 'Update failed');
    } finally {
      setIsPulling(false);
    }
  };

  const handleRebaseAndPush = async () => {
    setIsRebasing(true);
    setShowRebaseDialog(false);
    try {
      const result = await ipcRenderer.invoke('renderer:git-rebase-and-push', collection.pathname);
      toast.success(`Rebased and pushed to ${result.branch}`);
      await loadChangedFiles();
    } catch (error) {
      toast.error(error.message || 'Rebase failed');
      await loadChangedFiles(); // may now have conflicts
    } finally {
      setIsRebasing(false);
    }
  };

  const handleDiscard = async (file, e) => {
    e.stopPropagation();
    if (!window.confirm(`Discard changes to "${file.path}"?`)) return;
    try {
      await ipcRenderer.invoke('renderer:git-discard-file', { collectionPath: collection.pathname, filePath: file.path });
      toast.success('Changes discarded');
      await loadChangedFiles();
    } catch (error) {
      toast.error(error.message || 'Failed to discard');
    }
  };

  const handleResolveConflict = async () => {
    if (hasConflictMarkers(resolvedContent)) {
      toast.error('File still has conflict markers. Resolve all conflicts first.');
      return;
    }
    try {
      await ipcRenderer.invoke('renderer:git-resolve-conflict', {
        collectionPath: collection.pathname,
        filePath: conflictFile.path,
        resolvedContent
      });
      toast.success('Conflict resolved and staged');
      setConflictFile(null);
      await loadChangedFiles();
    } catch (error) {
      toast.error(error.message || 'Failed to resolve conflict');
    }
  };

  const handleContinueRebase = async () => {
    try {
      await ipcRenderer.invoke('renderer:git-continue-rebase', collection.pathname);
      toast.success('Rebase continued successfully');
      await loadChangedFiles();
      // Now push
      const gitBranch = await ipcRenderer.invoke('renderer:git-rebase-and-push', collection.pathname).catch(() => null);
      if (gitBranch) toast.success(`Pushed to ${gitBranch.branch}`);
    } catch (error) {
      toast.error(error.message || 'Continue rebase failed');
      await loadChangedFiles();
    }
  };

  const handleAbortRebase = async () => {
    if (!window.confirm('Abort rebase? Your local commits will be restored but remote changes will be lost.')) return;
    try {
      await ipcRenderer.invoke('renderer:git-abort-rebase', collection.pathname);
      toast.success('Rebase aborted');
      setConflictFile(null);
      await loadChangedFiles();
    } catch (error) {
      toast.error(error.message || 'Abort failed');
    }
  };

  const fileName = (filePath) => filePath.split('/').pop();

  const allConflictsResolved = conflictedFiles.length === 0;

  return (
    <StyledWrapper className="w-full h-full">
      <div className="git-layout">

        {/* LEFT: Settings */}
        <div className="git-settings-col">
          <div className="flex flex-col gap-4">
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

            <div className="flex items-center gap-3">
              <input type="checkbox" id="autoCommitPush" checked={autoCommitPush} onChange={(e) => setAutoCommitPush(e.target.checked)} />
              <label htmlFor="autoCommitPush" className="toggle-label cursor-pointer">Auto Commit &amp; Push on Save</label>
            </div>
            <p className="text-xs -mt-3 opacity-60">Automatically commit and push changes every time you save a request</p>

            <div className="flex items-center gap-3">
              <input type="checkbox" id="autoPull" checked={autoPull} onChange={(e) => setAutoPull(e.target.checked)} />
              <label htmlFor="autoPull" className="toggle-label cursor-pointer">Auto Pull (every 2 minutes)</label>
            </div>
            <p className="text-xs -mt-3 opacity-60">Automatically pull remote changes when local tree is clean</p>

            <div><Button variant="primary" onClick={handleSave}>Save</Button></div>

            <hr className="opacity-20" />

            <div>
              <label className="block text-sm font-medium mb-1">Pull from branch</label>
              <div className="flex gap-2">
                <select
                  className="textbox"
                  value={pullBranch}
                  onChange={(e) => setPullBranch(e.target.value)}
                  style={{ flex: 1 }}
                >
                  {branchInfo.current && !branchInfo.local.includes(branchInfo.current) && (
                    <option value={branchInfo.current}>{branchInfo.current} (current)</option>
                  )}
                  {(() => {
                    const localSet = new Set(branchInfo.local || []);
                    const union = Array.from(new Set([...(branchInfo.local || []), ...(branchInfo.remote || [])]));
                    if (union.length === 0) return <option value="">(no branches)</option>;
                    return union.map((b) => {
                      const onlyRemote = !localSet.has(b);
                      const labelSuffix = [
                        b === branchInfo.current ? ' (current)' : '',
                        b === branchInfo.default ? ' [default]' : '',
                        onlyRemote ? ' (remote only - switch in terminal first)' : ''
                      ].join('');
                      return (
                        <option key={b} value={b} disabled={onlyRemote}>
                          {b}{labelSuffix}
                        </option>
                      );
                    });
                  })()}
                </select>
                <select
                  className="textbox"
                  value={pullStrategy}
                  onChange={(e) => setPullStrategy(e.target.value)}
                  style={{ width: '110px', flexShrink: 0 }}
                  title="Pull strategy"
                >
                  <option value="rebase">Rebase</option>
                  <option value="ff-only">FF only</option>
                  <option value="merge">Merge</option>
                </select>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Button variant="secondary" disabled={isPulling || !pullBranch} onClick={handlePull}>
                  {isPulling ? 'Pulling...' : 'Pull'}
                </Button>
                <button className="text-xs opacity-60 hover:opacity-100 cursor-pointer" onClick={loadBranches}>
                  Refresh branches
                </button>
              </div>
            </div>

            <hr className="opacity-20" />

            <div>
              <label className="block text-sm font-medium mb-1">Commit Message</label>
              <input
                type="text"
                className="textbox"
                placeholder="Enter commit message"
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && commitMessage.trim() && changedFiles.length > 0 && !isPushing) handleCommitAndPush(); }}
              />
              <label className="block text-xs mt-2 mb-1 opacity-70">Push to branch</label>
              <input
                type="text"
                className="textbox"
                list="push-branch-options"
                placeholder={branchInfo.current || 'current branch'}
                value={pushBranch}
                onChange={(e) => setPushBranch(e.target.value)}
              />
              <datalist id="push-branch-options">
                {Array.from(new Set([...(branchInfo.local || []), ...(branchInfo.remote || [])])).map((b) => (
                  <option key={b} value={b} />
                ))}
              </datalist>
              <div className="mt-2">
                <Button
                  variant="primary"
                  disabled={!commitMessage.trim() || changedFiles.length === 0 || isPushing}
                  onClick={handleCommitAndPush}
                >
                  {isPushing ? 'Pushing...' : `Commit & Push${changedFiles.length > 0 ? ` (${changedFiles.length})` : ''}`}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Rebase dialog overlay */}
        {showRebaseDialog && (
          <div className="rebase-dialog">
            <div className="rebase-dialog-box">
              <p className="text-sm font-medium mb-1">Remote has new changes</p>
              <p className="text-xs opacity-60 mb-3">Your push was rejected. Rebase your commits on top of remote changes and push?</p>
              <div className="flex gap-2">
                <Button variant="primary" disabled={isRebasing} onClick={handleRebaseAndPush}>
                  {isRebasing ? 'Rebasing...' : 'Rebase & Push'}
                </Button>
                <Button variant="secondary" onClick={() => setShowRebaseDialog(false)}>Cancel</Button>
              </div>
            </div>
          </div>
        )}

        {/* RIGHT: Changes + Conflict Editor */}
        <div className="git-changes-col">
          {remoteUpdate && remoteUpdate.behind > 0 && (
            <div className="remote-update-banner">
              <div className="flex-1">
                <div className="text-sm font-medium">
                  {remoteUpdate.behind} new commit{remoteUpdate.behind > 1 ? 's' : ''} on origin/{remoteUpdate.branch}
                </div>
                <div className="text-xs opacity-70">Remote has changes others have pushed. Update your local copy?</div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="primary" disabled={isPulling} onClick={handleOneClickUpdate}>
                  {isPulling ? 'Updating...' : 'Update'}
                </Button>
                <button className="text-xs opacity-60 hover:opacity-100 cursor-pointer" onClick={() => setRemoteUpdate(null)}>
                  Dismiss
                </button>
              </div>
            </div>
          )}
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">
              Changes {changedFiles.length > 0 && <span className="opacity-60">({changedFiles.length})</span>}
              {conflictedFiles.length > 0 && <span className="text-red-500 ml-2">⚠ {conflictedFiles.length} conflict{conflictedFiles.length > 1 ? 's' : ''}</span>}
            </span>
            <button className="text-xs opacity-60 hover:opacity-100 cursor-pointer" onClick={loadChangedFiles} disabled={isLoadingFiles}>
              {isLoadingFiles ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>

          {/* Conflicted files */}
          {conflictedFiles.length > 0 && (
            <div className="mb-2">
              <div className="text-xs text-red-400 mb-1 font-medium">Conflicts — click to resolve</div>
              <div className="file-list conflict-list">
                {conflictedFiles.map((file, idx) => (
                  <div
                    key={idx}
                    className={`file-item ${conflictFile?.path === file.path ? 'selected' : ''}`}
                    onClick={() => openConflictEditor(file)}
                    title={file.path}
                  >
                    <span className="file-status text-red-500">!</span>
                    <span className="file-name">{fileName(file.path)}</span>
                    <span className="file-path-hint">{file.path}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                {allConflictsResolved && (
                  <button className="text-xs text-green-500 hover:opacity-80 cursor-pointer" onClick={handleContinueRebase}>
                    Continue Rebase & Push
                  </button>
                )}
                <button className="text-xs text-red-400 hover:opacity-80 cursor-pointer" onClick={handleAbortRebase}>
                  Abort Rebase
                </button>
              </div>
            </div>
          )}

          {/* Changed files list */}
          <div className="file-list">
            {changedFiles.length === 0 ? (
              <p className="text-xs opacity-40 italic p-2">No changes</p>
            ) : (
              changedFiles.map((file, idx) => (
                <div
                  key={idx}
                  className={`file-item ${selectedFile?.path === file.path ? 'selected' : ''}`}
                  onClick={() => loadFileDiff(file)}
                  title={file.path}
                >
                  <span className={`file-status ${statusColor(file.fileIndex)}`}>{file.fileIndex || '?'}</span>
                  <span className="file-name">{fileName(file.path)}</span>
                  <span className="file-path-hint">{file.path}</span>
                  <button className="rollback-btn" title="Discard changes" onClick={(e) => handleDiscard(file, e)}>↩</button>
                </div>
              ))
            )}
          </div>

          {/* Diff viewer */}
          {selectedFile && !conflictFile && (
            <div className="diff-viewer">
              <div className="diff-header">{selectedFile.path}</div>
              {isLoadingDiff ? (
                <p className="text-xs opacity-40 p-2">Loading diff...</p>
              ) : fileDiff ? (
                <pre className="diff-content">
                  {fileDiff.split('\n').map((line, i) => (
                    <div key={i} className={`diff-line ${diffLineClass(line)}`}>{line || ' '}</div>
                  ))}
                </pre>
              ) : (
                <p className="text-xs opacity-40 p-2">No diff available</p>
              )}
            </div>
          )}

          {/* Conflict editor */}
          {conflictFile && (
            <div className="conflict-editor">
              <div className="conflict-editor-header">
                <span>Resolving: {fileName(conflictFile.path)}</span>
                <div className="flex gap-2">
                  <button className="conflict-btn ours" onClick={() => setResolvedContent(acceptOurs(conflictContent))}>Accept Ours</button>
                  <button className="conflict-btn theirs" onClick={() => setResolvedContent(acceptTheirs(conflictContent))}>Accept Theirs</button>
                </div>
              </div>
              {conflictSections.length > 0 && (
                <div className="conflict-preview">
                  {conflictSections.map((s, i) => (
                    <div key={i} className="conflict-section">
                      <div className="conflict-col ours-col">
                        <div className="conflict-col-header">Yours</div>
                        <pre>{s.ours}</pre>
                      </div>
                      <div className="conflict-col theirs-col">
                        <div className="conflict-col-header">Theirs</div>
                        <pre>{s.theirs}</pre>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <textarea
                className="conflict-textarea"
                value={resolvedContent}
                onChange={(e) => setResolvedContent(e.target.value)}
                spellCheck={false}
              />
              <div className="conflict-actions">
                {hasConflictMarkers(resolvedContent) && (
                  <span className="text-xs text-red-400">Still has conflict markers</span>
                )}
                <Button variant="primary" disabled={hasConflictMarkers(resolvedContent)} onClick={handleResolveConflict}>
                  Resolve &amp; Stage
                </Button>
                <button className="text-xs opacity-60 hover:opacity-100 cursor-pointer" onClick={() => setConflictFile(null)}>Cancel</button>
              </div>
            </div>
          )}
        </div>

      </div>
    </StyledWrapper>
  );
};

export default GitSettings;
