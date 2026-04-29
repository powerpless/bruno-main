import React, { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { IconBell } from '@tabler/icons';
import ActionIcon from 'ui/ActionIcon';
import {
  startUpdateDownload,
  resetUpdateProgress,
  showUpdateBanner
} from 'providers/ReduxStore/slices/auto-update';
import StyledWrapper from './StyledWrapper';

const UpdateBell = () => {
  const dispatch = useDispatch();
  const info = useSelector((state) => state.autoUpdate.info);
  const progress = useSelector((state) => state.autoUpdate.progress);
  const ready = useSelector((state) => state.autoUpdate.ready);
  const error = useSelector((state) => state.autoUpdate.error);

  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  // Bell shows a notification only while there is a pending (not yet downloaded) update.
  // Once the update is downloaded (`ready` set, `info` cleared by reducer), the bell goes silent.
  const hasPending = !!info && !ready;
  const isDownloading = progress !== null && !ready;

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleToggle = () => {
    setOpen((prev) => !prev);
  };

  const handleDownload = async () => {
    dispatch(startUpdateDownload());
    dispatch(showUpdateBanner());
    try {
      await window.ipcRenderer.invoke('renderer:download-update');
    } catch (e) {
      dispatch(resetUpdateProgress());
    }
  };

  const renderBody = () => {
    if (isDownloading) {
      return (
        <div className="bell-popover-body">
          <div className="bell-popover-title">Загрузка обновления</div>
          <div className="bell-popover-text">{progress?.percent || 0}%</div>
          <div className="bell-progress-track">
            <div className="bell-progress-fill" style={{ width: `${progress?.percent || 0}%` }} />
          </div>
        </div>
      );
    }

    if (hasPending) {
      return (
        <div className="bell-popover-body">
          <div className="bell-popover-title">
            Доступна новая версия <strong>{info.version}</strong>
          </div>
          {error && <div className="bell-popover-error">Ошибка: {error.message}</div>}
          <button className="bell-popover-btn" onClick={handleDownload}>
            {error ? 'Повторить' : 'Загрузить'}
          </button>
        </div>
      );
    }

    return (
      <div className="bell-popover-body">
        <div className="bell-popover-empty">Нет новых обновлений</div>
      </div>
    );
  };

  return (
    <StyledWrapper ref={wrapperRef}>
      <ActionIcon
        onClick={handleToggle}
        label={hasPending ? 'Доступно обновление' : 'Обновления'}
        size="lg"
        data-testid="update-bell-button"
      >
        <span className="bell-icon-wrapper">
          <IconBell size={16} stroke={1.5} />
          {hasPending && <span className="bell-badge" />}
        </span>
      </ActionIcon>
      {open && (
        <div className="bell-popover" role="dialog">
          {renderBody()}
        </div>
      )}
    </StyledWrapper>
  );
};

export default UpdateBell;
