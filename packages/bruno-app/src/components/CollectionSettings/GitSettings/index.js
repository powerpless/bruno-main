import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { get } from 'lodash';
import toast from 'react-hot-toast';
import {
  IconRefresh,
  IconChevronDown,
  IconChevronRight,
  IconCloud,
  IconCloudDownload,
  IconCloudUpload,
  IconArrowBackUp,
  IconAlertTriangle,
  IconFile
} from '@tabler/icons';
import { updateCollectionGitConfig } from 'providers/ReduxStore/slices/collections';
import { saveCollectionSettings } from 'providers/ReduxStore/slices/collections/actions';
import Button from 'ui/Button';
import StyledWrapper from './StyledWrapper';

const STATUS_LABELS = {
  'A': { label: 'Added', color: 'status-added' },
  'M': { label: 'Modified', color: 'status-modified' },
  'D': { label: 'Deleted', color: 'status-deleted' },
  'R': { label: 'Renamed', color: 'status-renamed' },
  '?': { label: 'New', color: 'status-new' }
};

const getStatusBadge = (fileIndex) => STATUS_LABELS[fileIndex] || { label: fileIndex || '?', color: 'status-default' };

const diffLineClass = (line) => {
  if (line.startsWith('+') && !line.startsWith('+++')) return 'diff-add';
  if (line.startsWith('-') && !line.startsWith('---')) return 'diff-remove';
  if (line.startsWith('@@')) return 'diff-hunk';
  return 'diff-context';
};

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
    } else if (state === 'ours') ours.push(line);
    else if (state === 'theirs') theirs.push(line);
  }
  return sections;
};

const acceptOurs = (content) => content.replace(/<<<<<<< .+?\n([\s\S]*?)=======\n[\s\S]*?>>>>>>> .+?\n/g, '$1');
const acceptTheirs = (content) => content.replace(/<<<<<<< .+?\n[\s\S]*?=======\n([\s\S]*?)>>>>>>> .+?\n/g, '$1');
const hasConflictMarkers = (content) => content.includes('<<<<<<<') && content.includes('=======') && content.includes('>>>>>>>');

const fileName = (filePath) => filePath.split('/').pop();
const fileDir = (filePath) => {
  const parts = filePath.split('/');
  parts.pop();
  return parts.join('/');
};

const Section = ({ icon: Icon, title, subtitle, defaultOpen = true, children, badge }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="git-section">
      <button className="git-section-header" onClick={() => setOpen((v) => !v)} type="button">
        <span className="git-section-chevron">
          {open ? <IconChevronDown size={14} stroke={1.5} /> : <IconChevronRight size={14} stroke={1.5} />}
        </span>
        {Icon && <Icon size={16} stroke={1.5} className="git-section-icon" />}
        <span className="git-section-title">{title}</span>
        {badge !== undefined && badge !== null && <span className="git-section-badge">{badge}</span>}
        {subtitle && <span className="git-section-subtitle">{subtitle}</span>}
      </button>
      {open && <div className="git-section-body">{children}</div>}
    </div>
  );
};

const GitSettings = ({ collection }) => {
  const dispatch = useDispatch();
  const { ipcRenderer } = window;

  const gitConfig = collection.draft?.brunoConfig
    ? get(collection, 'draft.brunoConfig.git', {})
    : get(collection, 'brunoConfig.git', {});

  const [remoteUrl, setRemoteUrl] = useState('');
  const [originalRemoteUrl, setOriginalRemoteUrl] = useState('');
  const [autoCommitPush, setAutoCommitPush] = useState(gitConfig?.autoCommitPush || false);
  const [autoPull, setAutoPull] = useState(gitConfig?.autoPull || false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [commitMessage, setCommitMessage] = useState('');
  const [isPushing, setIsPushing] = useState(false);
  const [changedFiles, setChangedFiles] = useState([]);
  const [conflictedFiles, setConflictedFiles] = useState([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [selectedPaths, setSelectedPaths] = useState(() => new Set());
  const [previewFile, setPreviewFile] = useState(null);
  const [fileDiff, setFileDiff] = useState('');
  const [isLoadingDiff, setIsLoadingDiff] = useState(false);
  const [showRebaseDialog, setShowRebaseDialog] = useState(false);
  const [isRebasing, setIsRebasing] = useState(false);
  const [conflictFile, setConflictFile] = useState(null);
  const [conflictContent, setConflictContent] = useState('');
  const [resolvedContent, setResolvedContent] = useState('');
  const [conflictSections, setConflictSections] = useState([]);
  const [branchInfo, setBranchInfo] = useState({ local: [], remote: [], current: null, default: null });
  const [pullBranch, setPullBranch] = useState('');
  const [pushBranch, setPushBranch] = useState('');
  const [pullStrategy, setPullStrategy] = useState('rebase');
  const [isPulling, setIsPulling] = useState(false);
  const [remoteUpdate, setRemoteUpdate] = useState(null);

  const remoteUrlDirty = remoteUrl.trim() !== originalRemoteUrl.trim();
  const settingsDirty
    = remoteUrlDirty
      || autoCommitPush !== !!gitConfig?.autoCommitPush
      || autoPull !== !!gitConfig?.autoPull;

  const allBranches = useMemo(() => {
    return Array.from(new Set([...(branchInfo.local || []), ...(branchInfo.remote || [])]));
  }, [branchInfo]);

  const loadChangedFiles = useCallback(async () => {
    setIsLoadingFiles(true);
    try {
      const result = await ipcRenderer.invoke('renderer:get-git-changed-files', collection.pathname);
      const all = [...(result.staged || []), ...(result.unstaged || [])];
      setChangedFiles(all);
      setConflictedFiles(result.conflicted || []);
      // Preserve only selections that still exist; default-select everything new.
      setSelectedPaths((prev) => {
        const existing = new Set(all.map((f) => f.path));
        const next = new Set(all.map((f) => f.path));
        if (prev.size === 0) return next;
        // Keep prior selection if any was made; otherwise re-select all by default.
        const filtered = new Set();
        for (const p of prev) if (existing.has(p)) filtered.add(p);
        return filtered.size === 0 ? next : filtered;
      });
      setPreviewFile((curr) => (curr && all.some((f) => f.path === curr.path) ? curr : null));
    } catch {
      setChangedFiles([]);
      setConflictedFiles([]);
    } finally {
      setIsLoadingFiles(false);
    }
  }, [collection.pathname]);

  const loadFileDiff = useCallback(async (file) => {
    setPreviewFile(file);
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
    setPreviewFile(null);
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
    } catch { /* ignore */ }
  }, [collection.pathname]);

  useEffect(() => {
    ipcRenderer.invoke('renderer:get-git-remote-url', collection.pathname)
      .then((url) => {
        setRemoteUrl(url || '');
        setOriginalRemoteUrl(url || '');
      })
      .catch(() => {
        setRemoteUrl('');
        setOriginalRemoteUrl('');
      });
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
    setSavingSettings(true);
    try {
      if (remoteUrlDirty && remoteUrl.trim()) {
        await ipcRenderer.invoke('renderer:set-git-remote-url', { collectionPath: collection.pathname, url: remoteUrl.trim() });
        setOriginalRemoteUrl(remoteUrl.trim());
      }
      dispatch(updateCollectionGitConfig({ collectionUid: collection.uid, git: { autoCommitPush, autoPull } }));
      dispatch(saveCollectionSettings(collection.uid));
      toast.success('Git settings saved');
    } catch (error) {
      toast.error(error.message || 'Failed to save git settings');
    } finally {
      setSavingSettings(false);
    }
  };

  const toggleSelected = (path) => {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path); else next.add(path);
      return next;
    });
  };

  const setAllSelected = (selected) => {
    if (selected) {
      setSelectedPaths(new Set(changedFiles.map((f) => f.path)));
    } else {
      setSelectedPaths(new Set());
    }
  };

  const allSelected = changedFiles.length > 0 && changedFiles.every((f) => selectedPaths.has(f.path));
  const someSelected = changedFiles.some((f) => selectedPaths.has(f.path));
  const selectedFilesArray = changedFiles.filter((f) => selectedPaths.has(f.path));

  const handleCommitAndPush = async () => {
    if (selectedFilesArray.length === 0) {
      toast.error('Select at least one file to commit');
      return;
    }
    setIsPushing(true);
    try {
      const result = await ipcRenderer.invoke('renderer:manual-git-commit-push', {
        collectionPath: collection.pathname,
        commitMessage: commitMessage.trim(),
        targetBranch: (pushBranch || '').trim() || undefined,
        selectedFiles: selectedFilesArray.map((f) => f.path)
      });
      toast.success(`Committed ${result.filesChanged} file${result.filesChanged === 1 ? '' : 's'} to ${result.branch}`);
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
      await loadChangedFiles();
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

  const allConflictsResolved = conflictedFiles.length === 0;
  const canCommit = commitMessage.trim() && selectedFilesArray.length > 0 && !isPushing;

  return (
    <StyledWrapper className="w-full h-full">
      {showRebaseDialog && (
        <div className="rebase-dialog">
          <div className="rebase-dialog-box">
            <div className="rebase-dialog-icon"><IconAlertTriangle size={22} /></div>
            <p className="text-sm font-semibold mb-1">Remote has new changes</p>
            <p className="text-xs opacity-70 mb-4">Your push was rejected. Rebase your commits on top of remote changes and push?</p>
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" onClick={() => setShowRebaseDialog(false)}>Cancel</Button>
              <Button variant="primary" disabled={isRebasing} onClick={handleRebaseAndPush}>
                {isRebasing ? 'Rebasing...' : 'Rebase & Push'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="git-page">
        {/* Top notification banner */}
        {remoteUpdate && remoteUpdate.behind > 0 && (
          <div className="remote-update-banner">
            <IconCloudDownload size={18} stroke={1.5} className="banner-icon" />
            <div className="flex-1">
              <div className="text-sm font-medium">
                {remoteUpdate.behind} new commit{remoteUpdate.behind > 1 ? 's' : ''} on origin/{remoteUpdate.branch}
              </div>
              <div className="text-xs opacity-70">Remote has changes others have pushed.</div>
            </div>
            <Button variant="primary" disabled={isPulling} onClick={handleOneClickUpdate}>
              {isPulling ? 'Updating…' : 'Update now'}
            </Button>
            <button className="banner-dismiss" onClick={() => setRemoteUpdate(null)} title="Dismiss">×</button>
          </div>
        )}

        <div className="git-grid">
          {/* LEFT column — settings */}
          <aside className="git-sidebar">
            <Section icon={IconCloud} title="Repository" defaultOpen={true}>
              <label className="field-label">Remote URL</label>
              <input
                type="text"
                className="textbox"
                placeholder="https://github.com/user/repo.git"
                value={remoteUrl}
                onChange={(e) => setRemoteUrl(e.target.value)}
              />
              <p className="field-hint">Where changes will be pushed (origin)</p>

              <label className="checkbox-row">
                <input type="checkbox" checked={autoCommitPush} onChange={(e) => setAutoCommitPush(e.target.checked)} />
                <span>
                  <span className="checkbox-title">Auto Commit & Push on Save</span>
                  <span className="checkbox-hint">Commits & pushes automatically each time you save a request.</span>
                </span>
              </label>

              <label className="checkbox-row">
                <input type="checkbox" checked={autoPull} onChange={(e) => setAutoPull(e.target.checked)} />
                <span>
                  <span className="checkbox-title">Auto Pull (every 2 minutes)</span>
                  <span className="checkbox-hint">Pulls remote changes when local tree is clean.</span>
                </span>
              </label>

              <div className="section-actions">
                <Button variant="primary" disabled={!settingsDirty || savingSettings} onClick={handleSave}>
                  {savingSettings ? 'Saving…' : 'Save settings'}
                </Button>
              </div>
            </Section>

            <Section icon={IconCloudDownload} title="Pull from remote" defaultOpen={true}>
              <label className="field-label">Branch</label>
              <select
                className="textbox"
                value={pullBranch}
                onChange={(e) => setPullBranch(e.target.value)}
              >
                {branchInfo.current && !branchInfo.local.includes(branchInfo.current) && (
                  <option value={branchInfo.current}>{branchInfo.current} (current)</option>
                )}
                {(() => {
                  const localSet = new Set(branchInfo.local || []);
                  if (allBranches.length === 0) return <option value="">(no branches)</option>;
                  return allBranches.map((b) => {
                    const onlyRemote = !localSet.has(b);
                    const labelSuffix = [
                      b === branchInfo.current ? ' (current)' : '',
                      b === branchInfo.default ? ' [default]' : '',
                      onlyRemote ? ' (remote only)' : ''
                    ].join('');
                    return (
                      <option key={b} value={b} disabled={onlyRemote}>
                        {b}{labelSuffix}
                      </option>
                    );
                  });
                })()}
              </select>

              <label className="field-label">Strategy</label>
              <select className="textbox" value={pullStrategy} onChange={(e) => setPullStrategy(e.target.value)}>
                <option value="rebase">Rebase</option>
                <option value="ff-only">Fast-forward only</option>
                <option value="merge">Merge</option>
              </select>

              <div className="section-actions">
                <Button variant="secondary" disabled={isPulling || !pullBranch} onClick={handlePull}>
                  {isPulling ? 'Pulling…' : 'Pull'}
                </Button>
                <button className="link-btn" onClick={loadBranches} type="button">
                  <IconRefresh size={12} stroke={1.5} /> Refresh branches
                </button>
              </div>
            </Section>

            <Section icon={IconCloudUpload} title="Commit & Push" defaultOpen={true} badge={selectedFilesArray.length || null}>
              <label className="field-label">Commit message</label>
              <input
                type="text"
                className="textbox"
                placeholder={`Describe your changes${selectedFilesArray.length > 0 ? ` (${selectedFilesArray.length} file${selectedFilesArray.length === 1 ? '' : 's'})` : ''}`}
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && canCommit) handleCommitAndPush(); }}
              />

              <label className="field-label">Push to branch</label>
              <input
                type="text"
                className="textbox"
                list="push-branch-options"
                placeholder={branchInfo.current || 'current branch'}
                value={pushBranch}
                onChange={(e) => setPushBranch(e.target.value)}
              />
              <datalist id="push-branch-options">
                {allBranches.map((b) => (<option key={b} value={b} />))}
              </datalist>

              <div className="section-actions">
                <Button variant="primary" disabled={!canCommit} onClick={handleCommitAndPush}>
                  {isPushing
                    ? 'Pushing…'
                    : `Commit & Push${selectedFilesArray.length > 0 ? ` (${selectedFilesArray.length})` : ''}`}
                </Button>
              </div>

              {selectedFilesArray.length === 0 && changedFiles.length > 0 && (
                <p className="warning-hint">Select at least one file to commit.</p>
              )}
            </Section>
          </aside>

          {/* RIGHT column — changes & diff */}
          <main className="git-main">
            <div className="changes-panel">
              <div className="changes-header">
                <div className="changes-title-block">
                  <h2 className="changes-title">Changes</h2>
                  <span className="changes-counter">
                    {selectedFilesArray.length} of {changedFiles.length} selected
                  </span>
                </div>
                <div className="changes-actions">
                  <button className="link-btn" onClick={() => setAllSelected(true)} disabled={changedFiles.length === 0} type="button">
                    Select all
                  </button>
                  <button className="link-btn" onClick={() => setAllSelected(false)} disabled={!someSelected} type="button">
                    Select none
                  </button>
                  <button
                    className="icon-btn"
                    onClick={loadChangedFiles}
                    disabled={isLoadingFiles}
                    title="Refresh"
                    type="button"
                  >
                    <IconRefresh size={14} stroke={1.5} className={isLoadingFiles ? 'spin' : ''} />
                  </button>
                </div>
              </div>

              {conflictedFiles.length > 0 && (
                <div className="conflicts-banner">
                  <IconAlertTriangle size={16} stroke={1.5} className="conflict-icon" />
                  <div className="flex-1">
                    <div className="text-sm font-medium">
                      {conflictedFiles.length} conflict{conflictedFiles.length > 1 ? 's' : ''} — click a file to resolve
                    </div>
                    <div className="conflict-files">
                      {conflictedFiles.map((file, idx) => (
                        <button
                          key={idx}
                          className={`conflict-file ${conflictFile?.path === file.path ? 'active' : ''}`}
                          onClick={() => openConflictEditor(file)}
                          type="button"
                        >
                          {fileName(file.path)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    {allConflictsResolved && (
                      <button className="link-btn success" onClick={handleContinueRebase} type="button">
                        Continue Rebase & Push
                      </button>
                    )}
                    <button className="link-btn danger" onClick={handleAbortRebase} type="button">
                      Abort Rebase
                    </button>
                  </div>
                </div>
              )}

              <div className="changes-toolbar">
                <label className="select-all-row">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(e) => setAllSelected(e.target.checked)}
                    ref={(el) => { if (el) el.indeterminate = !allSelected && someSelected; }}
                  />
                  <span>{allSelected ? 'Deselect all' : 'Select all'}</span>
                </label>
              </div>

              <div className="file-list">
                {changedFiles.length === 0 ? (
                  <div className="empty-state">
                    <IconFile size={28} stroke={1.2} className="empty-icon" />
                    <p className="empty-title">Working tree clean</p>
                    <p className="empty-hint">No local changes to commit.</p>
                  </div>
                ) : (
                  changedFiles.map((file, idx) => {
                    const status = getStatusBadge(file.fileIndex);
                    const checked = selectedPaths.has(file.path);
                    const isPreview = previewFile?.path === file.path;
                    return (
                      <div
                        key={idx}
                        className={`file-item ${isPreview ? 'selected' : ''} ${checked ? 'checked' : ''}`}
                        onClick={() => loadFileDiff(file)}
                        title={file.path}
                      >
                        <input
                          type="checkbox"
                          className="file-checkbox"
                          checked={checked}
                          onChange={() => toggleSelected(file.path)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span className={`file-status-badge ${status.color}`} title={status.label}>
                          {file.fileIndex || '?'}
                        </span>
                        <span className="file-name">{fileName(file.path)}</span>
                        {fileDir(file.path) && (
                          <span className="file-path-hint">{fileDir(file.path)}</span>
                        )}
                        <button
                          className="icon-btn discard-btn"
                          title="Discard changes"
                          onClick={(e) => handleDiscard(file, e)}
                          type="button"
                        >
                          <IconArrowBackUp size={14} stroke={1.5} />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {previewFile && !conflictFile && (
              <div className="diff-viewer">
                <div className="diff-header">
                  <span className="diff-filename">{previewFile.path}</span>
                  <button className="link-btn" onClick={() => setPreviewFile(null)} type="button">Close</button>
                </div>
                {isLoadingDiff ? (
                  <p className="diff-empty">Loading diff…</p>
                ) : fileDiff ? (
                  <pre className="diff-content">
                    {fileDiff.split('\n').map((line, i) => (
                      <div key={i} className={`diff-line ${diffLineClass(line)}`}>{line || ' '}</div>
                    ))}
                  </pre>
                ) : (
                  <p className="diff-empty">No diff available</p>
                )}
              </div>
            )}

            {conflictFile && (
              <div className="conflict-editor">
                <div className="conflict-editor-header">
                  <span className="diff-filename">Resolving: {fileName(conflictFile.path)}</span>
                  <div className="flex gap-2">
                    <button className="conflict-btn ours" onClick={() => setResolvedContent(acceptOurs(conflictContent))} type="button">Accept Ours</button>
                    <button className="conflict-btn theirs" onClick={() => setResolvedContent(acceptTheirs(conflictContent))} type="button">Accept Theirs</button>
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
                    Resolve & Stage
                  </Button>
                  <button className="link-btn" onClick={() => setConflictFile(null)} type="button">Cancel</button>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </StyledWrapper>
  );
};

export default GitSettings;
