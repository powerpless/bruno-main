import styled from 'styled-components';

const StyledWrapper = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;

  .git-page {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    width: 100%;
    height: 100%;
  }

  /* ─── Layout grid ───────────────────────────────────────────── */
  .git-grid {
    display: grid;
    grid-template-columns: 360px minmax(0, 1fr);
    gap: 1rem;
    height: 100%;
    min-height: 0;
  }

  .git-sidebar {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    overflow-y: auto;
    padding-right: 4px;
  }

  .git-main {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    min-height: 0;
    min-width: 0;
  }

  /* ─── Collapsible sections ──────────────────────────────────── */
  .git-section {
    border: 1px solid ${(props) => props.theme.input.border};
    border-radius: 6px;
    background-color: ${(props) => props.theme.input.bg};
    overflow: hidden;
    flex-shrink: 0;
  }

  .git-section-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.6rem 0.75rem;
    background: none;
    border: none;
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 500;
    color: inherit;
    text-align: left;

    &:hover {
      background-color: ${(props) => props.theme.input.border}30;
    }
  }

  .git-section-chevron {
    display: inline-flex;
    opacity: 0.6;
  }

  .git-section-icon {
    opacity: 0.7;
  }

  .git-section-title {
    flex: 1;
  }

  .git-section-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 22px;
    height: 18px;
    padding: 0 6px;
    background-color: #1e40af;
    color: #fff;
    border-radius: 9px;
    font-size: 11px;
    font-weight: 600;
  }

  .git-section-subtitle {
    font-size: 0.75rem;
    opacity: 0.55;
    font-weight: 400;
  }

  .git-section-body {
    padding: 0.5rem 0.85rem 0.85rem;
    border-top: 1px solid ${(props) => props.theme.input.border}80;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  /* ─── Form fields ───────────────────────────────────────────── */
  .field-label {
    display: block;
    font-size: 0.75rem;
    font-weight: 500;
    margin-top: 0.25rem;
    margin-bottom: 0.2rem;
    opacity: 0.85;
  }

  .field-hint {
    font-size: 0.7rem;
    opacity: 0.55;
    margin-top: 0.15rem;
  }

  .warning-hint {
    font-size: 0.7rem;
    color: #f59e0b;
    margin-top: 0.25rem;
  }

  .textbox {
    border: 1px solid ${(props) => props.theme.input.border};
    padding: 0.4rem 0.6rem;
    border-radius: 4px;
    outline: none;
    background-color: ${(props) => props.theme.bg};
    transition: border-color ease-in-out 0.1s;
    width: 100%;
    font-size: 0.8rem;
    color: inherit;

    &:focus {
      border-color: ${(props) => props.theme.input.focusBorder};
    }
  }

  .checkbox-row {
    display: flex;
    align-items: flex-start;
    gap: 0.6rem;
    padding: 0.4rem 0;
    cursor: pointer;
    user-select: none;

    input[type='checkbox'] {
      margin-top: 0.15rem;
      flex-shrink: 0;
      cursor: pointer;
    }

    .checkbox-title {
      display: block;
      font-size: 0.8rem;
      font-weight: 500;
    }

    .checkbox-hint {
      display: block;
      font-size: 0.7rem;
      opacity: 0.55;
      margin-top: 0.1rem;
    }
  }

  .section-actions {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    margin-top: 0.4rem;
    flex-wrap: wrap;
  }

  .link-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0.2rem 0.3rem;
    font-size: 0.75rem;
    color: inherit;
    opacity: 0.7;
    transition: opacity 0.15s ease;

    &:hover:not(:disabled) {
      opacity: 1;
      text-decoration: underline;
    }

    &:disabled {
      opacity: 0.3;
      cursor: not-allowed;
    }

    &.success { color: #22c55e; opacity: 0.9; }
    &.danger  { color: #ef4444; opacity: 0.9; }
  }

  .icon-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border: 1px solid transparent;
    border-radius: 4px;
    background: none;
    cursor: pointer;
    color: inherit;
    opacity: 0.65;
    transition: all 0.15s ease;

    &:hover:not(:disabled) {
      opacity: 1;
      background-color: ${(props) => props.theme.input.border}40;
    }

    &:disabled {
      opacity: 0.3;
      cursor: not-allowed;
    }
  }

  .spin {
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }

  /* ─── Remote update banner (top) ────────────────────────────── */
  .remote-update-banner {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.65rem 0.85rem;
    border: 1px solid #3b82f680;
    border-left: 3px solid #3b82f6;
    background-color: rgba(59, 130, 246, 0.08);
    border-radius: 6px;

    .banner-icon {
      color: #3b82f6;
      flex-shrink: 0;
    }
  }

  .banner-dismiss {
    background: none;
    border: none;
    cursor: pointer;
    color: inherit;
    opacity: 0.5;
    font-size: 1.1rem;
    line-height: 1;
    padding: 0 0.4rem;

    &:hover { opacity: 1; }
  }

  /* ─── Changes panel ─────────────────────────────────────────── */
  .changes-panel {
    border: 1px solid ${(props) => props.theme.input.border};
    border-radius: 6px;
    background-color: ${(props) => props.theme.input.bg};
    display: flex;
    flex-direction: column;
    overflow: hidden;
    flex-shrink: 0;
    max-height: 50%;
    min-height: 220px;
  }

  .changes-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.6rem 0.85rem;
    border-bottom: 1px solid ${(props) => props.theme.input.border}80;
  }

  .changes-title-block {
    display: flex;
    align-items: baseline;
    gap: 0.6rem;
  }

  .changes-title {
    font-size: 0.95rem;
    font-weight: 600;
    margin: 0;
  }

  .changes-counter {
    font-size: 0.7rem;
    opacity: 0.6;
  }

  .changes-actions {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .changes-toolbar {
    padding: 0.4rem 0.85rem;
    border-bottom: 1px solid ${(props) => props.theme.input.border}50;
    background-color: ${(props) => props.theme.bg};
  }

  .select-all-row {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    font-size: 0.75rem;
    opacity: 0.75;
    user-select: none;

    input[type='checkbox'] { cursor: pointer; }
    &:hover { opacity: 1; }
  }

  /* ─── File list ─────────────────────────────────────────────── */
  .file-list {
    overflow-y: auto;
    flex: 1;
    min-height: 80px;
  }

  .file-item {
    display: grid;
    grid-template-columns: auto auto 1fr auto auto;
    align-items: center;
    gap: 0.55rem;
    padding: 0.4rem 0.85rem;
    cursor: pointer;
    font-size: 0.8rem;
    border-bottom: 1px solid ${(props) => props.theme.input.border}30;
    transition: background-color 0.1s ease;

    &:last-child { border-bottom: none; }

    &:hover {
      background-color: ${(props) => props.theme.input.border}30;
    }

    &.selected {
      background-color: ${(props) => props.theme.input.border}55;
    }

    &.checked .file-name {
      font-weight: 500;
    }
  }

  .file-checkbox {
    cursor: pointer;
    flex-shrink: 0;
  }

  .file-status-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 18px;
    border-radius: 3px;
    font-size: 0.65rem;
    font-weight: 700;
    font-family: monospace;
    flex-shrink: 0;

    &.status-added    { color: #22c55e; background-color: rgba(34,197,94,0.12); }
    &.status-modified { color: #eab308; background-color: rgba(234,179,8,0.12); }
    &.status-deleted  { color: #ef4444; background-color: rgba(239,68,68,0.12); }
    &.status-renamed  { color: #3b82f6; background-color: rgba(59,130,246,0.12); }
    &.status-new      { color: #a78bfa; background-color: rgba(167,139,250,0.12); }
    &.status-default  { color: inherit; background-color: ${(props) => props.theme.input.border}50; }
  }

  .file-name {
    font-family: ${(props) => props.theme.font?.codeFont || 'monospace'};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .file-path-hint {
    opacity: 0.45;
    font-size: 0.7rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    direction: rtl;
    text-align: left;
    max-width: 280px;
  }

  .discard-btn {
    width: 24px;
    height: 24px;
    opacity: 0;

    .file-item:hover & { opacity: 0.7; }

    &:hover { color: #ef4444 !important; opacity: 1 !important; }
  }

  /* ─── Empty state ───────────────────────────────────────────── */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2.25rem 1rem;
    gap: 0.5rem;
    text-align: center;
  }

  .empty-icon { opacity: 0.3; }
  .empty-title {
    font-size: 0.85rem;
    font-weight: 500;
    margin: 0;
    opacity: 0.75;
  }
  .empty-hint {
    font-size: 0.75rem;
    margin: 0;
    opacity: 0.45;
  }

  /* ─── Conflicts banner ──────────────────────────────────────── */
  .conflicts-banner {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.7rem 0.85rem;
    border-bottom: 1px solid #ef444450;
    background-color: rgba(239, 68, 68, 0.08);

    .conflict-icon {
      color: #ef4444;
      margin-top: 0.1rem;
      flex-shrink: 0;
    }
  }

  .conflict-files {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-top: 0.3rem;
  }

  .conflict-file {
    padding: 0.15rem 0.5rem;
    background-color: rgba(239, 68, 68, 0.15);
    border: 1px solid #ef444460;
    border-radius: 3px;
    font-size: 0.7rem;
    font-family: monospace;
    cursor: pointer;
    color: inherit;

    &:hover { background-color: rgba(239, 68, 68, 0.25); }
    &.active {
      background-color: #ef4444;
      color: #fff;
    }
  }

  /* ─── Diff viewer ───────────────────────────────────────────── */
  .diff-viewer {
    border: 1px solid ${(props) => props.theme.input.border};
    border-radius: 6px;
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    min-height: 0;
    background-color: ${(props) => props.theme.input.bg};
  }

  .diff-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.75rem;
    padding: 0.45rem 0.85rem;
    border-bottom: 1px solid ${(props) => props.theme.input.border};
    background-color: ${(props) => props.theme.bg};
    flex-shrink: 0;
  }

  .diff-filename {
    font-family: monospace;
    opacity: 0.85;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .diff-empty {
    font-size: 0.75rem;
    opacity: 0.4;
    padding: 1rem;
    margin: 0;
  }

  .diff-content {
    overflow: auto;
    flex: 1;
    font-size: 0.72rem;
    font-family: monospace;
    margin: 0;
    padding: 0;
  }

  .diff-line {
    padding: 0 0.7rem;
    white-space: pre;
    line-height: 1.55;
  }

  .diff-add    { background-color: rgba(34,197,94,0.15);  color: #4ade80; }
  .diff-remove { background-color: rgba(239,68,68,0.15);  color: #f87171; }
  .diff-hunk   { color: #60a5fa; opacity: 0.85; }
  .diff-context{ opacity: 0.7; }

  /* ─── Conflict editor ───────────────────────────────────────── */
  .conflict-editor {
    border: 1px solid ${(props) => props.theme.input.border};
    border-radius: 6px;
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
    background-color: ${(props) => props.theme.input.bg};
  }

  .conflict-editor-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.45rem 0.85rem;
    border-bottom: 1px solid ${(props) => props.theme.input.border};
    background-color: ${(props) => props.theme.bg};
    font-size: 0.75rem;
    flex-shrink: 0;
  }

  .conflict-preview {
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    max-height: 140px;
    flex-shrink: 0;
    border-bottom: 1px solid ${(props) => props.theme.input.border};
  }

  .conflict-section {
    display: flex;
    border-bottom: 1px solid ${(props) => props.theme.input.border}30;

    &:last-child { border-bottom: none; }
  }

  .conflict-col {
    flex: 1;
    min-width: 0;
    font-size: 0.7rem;
    font-family: monospace;
    overflow: auto;

    pre {
      margin: 0;
      padding: 0.3rem 0.6rem;
      white-space: pre-wrap;
      word-break: break-all;
    }
  }

  .ours-col {
    border-right: 1px solid ${(props) => props.theme.input.border}50;
    background-color: rgba(34, 197, 94, 0.05);
  }
  .theirs-col {
    background-color: rgba(239, 68, 68, 0.05);
  }

  .conflict-col-header {
    font-size: 0.65rem;
    font-weight: 700;
    padding: 0.18rem 0.6rem;
    opacity: 0.6;
    border-bottom: 1px solid ${(props) => props.theme.input.border}30;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .conflict-textarea {
    flex: 1;
    width: 100%;
    min-height: 80px;
    resize: none;
    border: none;
    border-top: 1px solid ${(props) => props.theme.input.border};
    outline: none;
    background-color: ${(props) => props.theme.bg};
    color: inherit;
    font-size: 0.72rem;
    font-family: monospace;
    padding: 0.5rem 0.75rem;
    line-height: 1.55;
  }

  .conflict-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.45rem 0.75rem;
    border-top: 1px solid ${(props) => props.theme.input.border};
    flex-shrink: 0;
    background-color: ${(props) => props.theme.input.bg};
  }

  .conflict-btn {
    font-size: 0.7rem;
    padding: 0.2rem 0.55rem;
    border-radius: 4px;
    border: 1px solid ${(props) => props.theme.input.border};
    background: none;
    cursor: pointer;
    opacity: 0.85;
    color: inherit;

    &:hover { opacity: 1; }

    &.ours {
      color: #4ade80;
      border-color: #4ade8060;
      &:hover { background-color: rgba(34,197,94,0.1); }
    }
    &.theirs {
      color: #f87171;
      border-color: #f8717160;
      &:hover { background-color: rgba(239,68,68,0.1); }
    }
  }

  /* ─── Rebase dialog ─────────────────────────────────────────── */
  .rebase-dialog {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }

  .rebase-dialog-box {
    background: ${(props) => props.theme.sidebar.bg};
    border: 1px solid ${(props) => props.theme.input.border};
    border-radius: 8px;
    padding: 1.5rem;
    max-width: 380px;
    width: 100%;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35);
  }

  .rebase-dialog-icon {
    color: #f59e0b;
    margin-bottom: 0.5rem;
  }
`;

export default StyledWrapper;
