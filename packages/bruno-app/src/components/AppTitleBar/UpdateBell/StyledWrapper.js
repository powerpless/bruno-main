import styled from 'styled-components';

const StyledWrapper = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  -webkit-app-region: no-drag;

  .bell-icon-wrapper {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .bell-badge {
    position: absolute;
    top: -2px;
    right: -2px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #e11d48;
    box-shadow: 0 0 0 2px ${(props) => props.theme.sidebar.bg};
  }

  .bell-popover {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    z-index: 1100;
    min-width: 240px;
    padding: 12px;
    background: ${(props) => props.theme.dropdown.bg};
    color: ${(props) => props.theme.dropdown.color};
    border: 1px solid ${(props) => props.theme.dropdown.border || props.theme.sidebar.collection.item.hoverBg};
    border-radius: 6px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
    -webkit-app-region: no-drag;
  }

  .bell-popover-body {
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 12px;
  }

  .bell-popover-title {
    font-weight: 500;
  }

  .bell-popover-text {
    color: ${(props) => props.theme.dropdown.mutedText};
  }

  .bell-popover-empty {
    color: ${(props) => props.theme.dropdown.mutedText};
    font-style: italic;
  }

  .bell-popover-error {
    color: #ef4444;
    font-size: 11px;
  }

  .bell-progress-track {
    width: 100%;
    height: 4px;
    background: ${(props) => props.theme.sidebar.collection.item.hoverBg};
    border-radius: 2px;
    overflow: hidden;
  }

  .bell-progress-fill {
    height: 100%;
    background: #1e40af;
    transition: width 0.3s ease;
  }

  .bell-popover-btn {
    align-self: flex-start;
    padding: 4px 12px;
    background: #1e40af;
    color: #fff;
    border: none;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;

    &:hover {
      background: #1e3a8a;
    }
  }
`;

export default StyledWrapper;
