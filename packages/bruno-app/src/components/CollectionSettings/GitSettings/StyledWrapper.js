import styled from 'styled-components';

const StyledWrapper = styled.div`
  .git-layout {
    display: flex;
    gap: 1.5rem;
    height: 100%;
  }

  .git-settings-col {
    width: 340px;
    flex-shrink: 0;
  }

  .git-changes-col {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .textbox {
    border: 1px solid ${(props) => props.theme.input.border};
    padding: 0.35rem 0.6rem;
    border-radius: 3px;
    outline: none;
    background-color: ${(props) => props.theme.input.bg};
    transition: border-color ease-in-out 0.1s;
    width: 100%;

    &:focus {
      border-color: ${(props) => props.theme.input.focusBorder};
      outline: none;
    }
  }

  .toggle-label {
    font-size: 0.875rem;
  }

  /* File list */
  .file-list {
    border: 1px solid ${(props) => props.theme.input.border};
    border-radius: 3px;
    background-color: ${(props) => props.theme.input.bg};
    overflow-y: auto;
    max-height: 160px;
    flex-shrink: 0;
  }

  .file-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.3rem 0.6rem;
    cursor: pointer;
    font-size: 0.75rem;
    font-family: monospace;
    border-bottom: 1px solid ${(props) => props.theme.input.border}20;

    &:last-child {
      border-bottom: none;
    }

    &:hover {
      background-color: ${(props) => props.theme.input.border}30;
    }

    &.selected {
      background-color: ${(props) => props.theme.input.border}50;
    }
  }

  .file-status {
    font-weight: bold;
    width: 14px;
    text-align: center;
    flex-shrink: 0;
  }

  .file-name {
    flex-shrink: 0;
  }

  .file-path-hint {
    opacity: 0.4;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    direction: rtl;
    text-align: left;
  }

  /* Diff viewer */
  .diff-viewer {
    margin-top: 0.75rem;
    border: 1px solid ${(props) => props.theme.input.border};
    border-radius: 3px;
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .diff-header {
    font-size: 0.7rem;
    font-family: monospace;
    padding: 0.3rem 0.6rem;
    border-bottom: 1px solid ${(props) => props.theme.input.border};
    opacity: 0.7;
    flex-shrink: 0;
    background-color: ${(props) => props.theme.input.bg};
  }

  .diff-content {
    overflow: auto;
    flex: 1;
    font-size: 0.7rem;
    font-family: monospace;
    margin: 0;
    padding: 0;
  }

  .diff-line {
    padding: 0 0.5rem;
    white-space: pre;
    line-height: 1.5;
  }

  .diff-add {
    background-color: rgba(34, 197, 94, 0.15);
    color: #4ade80;
  }

  .diff-remove {
    background-color: rgba(239, 68, 68, 0.15);
    color: #f87171;
  }

  .diff-hunk {
    color: #60a5fa;
    opacity: 0.8;
  }

  .diff-context {
    opacity: 0.7;
  }

  /* Rollback button */
  .rollback-btn {
    margin-left: auto;
    flex-shrink: 0;
    background: none;
    border: none;
    cursor: pointer;
    font-size: 0.85rem;
    opacity: 0.4;
    padding: 0 0.2rem;
    line-height: 1;

    &:hover {
      opacity: 1;
      color: #f87171;
    }
  }

  /* Conflict editor */
  .conflict-editor {
    margin-top: 0.75rem;
    border: 1px solid ${(props) => props.theme.input.border};
    border-radius: 3px;
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }

  .conflict-editor-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.35rem 0.6rem;
    border-bottom: 1px solid ${(props) => props.theme.input.border};
    font-size: 0.75rem;
    font-family: monospace;
    flex-shrink: 0;
    background-color: ${(props) => props.theme.input.bg};
  }

  .conflict-preview {
    display: flex;
    flex-direction: column;
    gap: 0;
    overflow-y: auto;
    max-height: 140px;
    flex-shrink: 0;
    border-bottom: 1px solid ${(props) => props.theme.input.border};
  }

  .conflict-section {
    display: flex;
    border-bottom: 1px solid ${(props) => props.theme.input.border}30;

    &:last-child {
      border-bottom: none;
    }
  }

  .conflict-col {
    flex: 1;
    min-width: 0;
    font-size: 0.7rem;
    font-family: monospace;
    overflow: auto;

    pre {
      margin: 0;
      padding: 0.3rem 0.5rem;
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
    font-weight: bold;
    padding: 0.15rem 0.5rem;
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
    background-color: ${(props) => props.theme.input.bg};
    color: inherit;
    font-size: 0.7rem;
    font-family: monospace;
    padding: 0.4rem 0.6rem;
    line-height: 1.5;
  }

  .conflict-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.4rem 0.6rem;
    border-top: 1px solid ${(props) => props.theme.input.border};
    flex-shrink: 0;
    background-color: ${(props) => props.theme.input.bg};
  }

  .conflict-btn {
    font-size: 0.7rem;
    padding: 0.15rem 0.5rem;
    border-radius: 3px;
    border: 1px solid ${(props) => props.theme.input.border};
    background: none;
    cursor: pointer;
    opacity: 0.8;

    &:hover {
      opacity: 1;
    }

    &.ours {
      color: #4ade80;
      border-color: #4ade8060;

      &:hover {
        background-color: rgba(34, 197, 94, 0.1);
      }
    }

    &.theirs {
      color: #f87171;
      border-color: #f8717160;

      &:hover {
        background-color: rgba(239, 68, 68, 0.1);
      }
    }
  }

  /* Remote update banner */
  .remote-update-banner {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.65rem 0.8rem;
    margin-bottom: 0.75rem;
    border: 1px solid ${(props) => props.theme.input.border};
    border-left: 3px solid #3b82f6;
    background-color: rgba(59, 130, 246, 0.08);
    border-radius: 3px;
  }

  /* Rebase dialog */
  .rebase-dialog {
    position: absolute;
    inset: 0;
    background: rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
    border-radius: 4px;
  }

  .rebase-dialog-box {
    background: ${(props) => props.theme.sidebar.bg};
    border: 1px solid ${(props) => props.theme.input.border};
    border-radius: 6px;
    padding: 1.25rem 1.5rem;
    max-width: 360px;
    width: 100%;
  }
`;

export default StyledWrapper;
