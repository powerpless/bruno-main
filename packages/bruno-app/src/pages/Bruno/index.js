import React, { useState, useRef, useEffect } from 'react';
import classnames from 'classnames';
import ManageWorkspace from 'components/ManageWorkspace';
import RequestTabs from 'components/RequestTabs';
import RequestTabPanel from 'components/RequestTabPanel';
import Sidebar from 'components/Sidebar';
import StatusBar from 'components/StatusBar';
import AppTitleBar from 'components/AppTitleBar';
import ApiSpecPanel from 'components/ApiSpecPanel';
// import ErrorCapture from 'components/ErrorCapture';
import { useDispatch, useSelector } from 'react-redux';
import { isElectron } from 'utils/common/platform';
import {
  setUpdateAvailable,
  setUpdateProgress,
  setUpdateDownloaded,
  setUpdateError,
  dismissUpdateBanner,
  startUpdateDownload,
  resetUpdateProgress
} from 'providers/ReduxStore/slices/auto-update';
import StyledWrapper from './StyledWrapper';
import 'codemirror/theme/material.css';
import 'codemirror/theme/monokai.css';
import 'codemirror/addon/scroll/simplescrollbars.css';
import 'swagger-ui-react/swagger-ui.css';
import Devtools from 'components/Devtools';
import useGrpcEventListeners from 'utils/network/grpc-event-listeners';
import useWsEventListeners from 'utils/network/ws-event-listeners';
import Portal from 'components/Portal';
import SaveTransientRequestContainer from 'components/SaveTransientRequest/Container';
import SaveTransientRequest from 'components/SaveTransientRequest';

require('codemirror/mode/javascript/javascript');
require('codemirror/mode/xml/xml');
require('codemirror/mode/sparql/sparql');
require('codemirror/addon/comment/comment');
require('codemirror/addon/dialog/dialog');
require('codemirror/addon/edit/closebrackets');
require('codemirror/addon/edit/matchbrackets');
require('codemirror/addon/fold/brace-fold');
require('codemirror/addon/fold/foldgutter');
require('codemirror/addon/fold/xml-fold');
require('codemirror/addon/hint/javascript-hint');
require('codemirror/addon/hint/show-hint');
require('codemirror/addon/lint/lint');
require('codemirror/addon/lint/json-lint');
require('codemirror/addon/mode/overlay');
require('codemirror/addon/scroll/simplescrollbars');
require('codemirror/addon/search/jump-to-line');
require('codemirror/addon/search/search');
require('codemirror/addon/search/searchcursor');
require('codemirror/addon/display/placeholder');
require('codemirror/keymap/sublime');

require('codemirror-graphql/hint');
require('codemirror-graphql/info');
require('codemirror-graphql/jump');
require('codemirror-graphql/lint');
require('codemirror-graphql/mode');

require('utils/codemirror/brunoVarInfo');
require('utils/codemirror/javascript-lint');
require('utils/codemirror/autocomplete');

const TransientRequestModalsRenderer = ({ modals }) => {
  if (modals.length === 0) {
    return null;
  }

  if (modals.length === 1) {
    return (
      <SaveTransientRequest
        item={modals[0].item}
        collection={modals[0].collection}
        isOpen={true}
      />
    );
  }

  return <SaveTransientRequestContainer />;
};

export default function Main() {
  const dispatch = useDispatch();
  const activeTabUid = useSelector((state) => state.tabs.activeTabUid);
  const activeApiSpecUid = useSelector((state) => state.apiSpec.activeApiSpecUid);
  const isDragging = useSelector((state) => state.app.isDragging);
  const showApiSpecPage = useSelector((state) => state.app.showApiSpecPage);
  const showManageWorkspacePage = useSelector((state) => state.app.showManageWorkspacePage);
  const isConsoleOpen = useSelector((state) => state.logs.isConsoleOpen);
  const saveTransientRequestModals = useSelector((state) => state.collections.saveTransientRequestModals);
  const mainSectionRef = useRef(null);
  const [showRosettaBanner, setShowRosettaBanner] = useState(false);

  // Auto-update state (from redux)
  const updateInfo = useSelector((state) => state.autoUpdate.info);
  const updateProgress = useSelector((state) => state.autoUpdate.progress);
  const updateReady = useSelector((state) => state.autoUpdate.ready);
  const updateError = useSelector((state) => state.autoUpdate.error);
  const updateDismissed = useSelector((state) => state.autoUpdate.bannerDismissed);

  // Initialize event listeners
  useGrpcEventListeners();
  useWsEventListeners();

  const className = classnames({
    'is-dragging': isDragging
  });

  useEffect(() => {
    if (!isElectron()) {
      return;
    }

    const { ipcRenderer } = window;

    const removeAppLoadedListener = ipcRenderer.on('main:app-loaded', (init) => {
      if (mainSectionRef.current) {
        mainSectionRef.current.setAttribute('data-app-state', 'loaded');
      }
      setShowRosettaBanner(init.isRunningInRosetta);
    });

    const removeUpdateAvailable = ipcRenderer.on('main:update-available', (info) => {
      dispatch(setUpdateAvailable(info));
    });

    const removeUpdateProgress = ipcRenderer.on('main:update-progress', (progress) => {
      dispatch(setUpdateProgress(progress));
    });

    const removeUpdateDownloaded = ipcRenderer.on('main:update-downloaded', (info) => {
      dispatch(setUpdateDownloaded(info));
    });

    const removeUpdateError = ipcRenderer.on('main:update-error', (info) => {
      dispatch(setUpdateError(info));
    });

    return () => {
      removeAppLoadedListener();
      removeUpdateAvailable();
      removeUpdateProgress();
      removeUpdateDownloaded();
      removeUpdateError();
    };
  }, []);

  const handleDownloadUpdate = async () => {
    dispatch(startUpdateDownload());
    try {
      await window.ipcRenderer.invoke('renderer:download-update');
    } catch (e) {
      dispatch(resetUpdateProgress());
    }
  };

  const handleInstallUpdate = () => {
    window.ipcRenderer.invoke('renderer:install-update');
  };

  const showUpdateBanner = !updateDismissed && (updateInfo || updateProgress !== null || updateReady || updateError);
  const isErrorState = !!updateError && !updateReady;
  const bannerBg = isErrorState ? '#991b1b' : '#1e40af';

  return (
    // <ErrorCapture>
    <div id="main-container" className="flex flex-col h-screen max-h-screen overflow-hidden">
      <AppTitleBar />

      {/* Update banner */}
      {showUpdateBanner && (
        <div
          className="flex items-center gap-3 px-4 py-2 text-sm"
          style={{ background: bannerBg, color: '#fff', flexShrink: 0 }}
        >
          {updateReady ? (
            <>
              <span>Версия {updateReady.version} загружена. Перезапусти приложение для установки.</span>
              <button
                onClick={handleInstallUpdate}
                style={{ background: '#fff', color: '#1e40af', border: 'none', borderRadius: 4, padding: '2px 10px', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }}
              >
                Перезапустить
              </button>
            </>
          ) : updateError ? (
            <>
              <span>Ошибка обновления: {updateError.message}</span>
              <button
                onClick={handleDownloadUpdate}
                style={{ background: '#fff', color: '#991b1b', border: 'none', borderRadius: 4, padding: '2px 10px', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }}
              >
                Повторить
              </button>
            </>
          ) : updateProgress !== null ? (
            <>
              <span>Загрузка обновления... {updateProgress.percent}%</span>
              <div style={{ flex: 1, maxWidth: 200, height: 4, background: 'rgba(255,255,255,0.3)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ width: `${updateProgress.percent}%`, height: '100%', background: '#fff', transition: 'width 0.3s' }} />
              </div>
            </>
          ) : updateInfo ? (
            <>
              <span>Доступна новая версия <strong>{updateInfo.version}</strong></span>
              <button
                onClick={handleDownloadUpdate}
                style={{ background: '#fff', color: '#1e40af', border: 'none', borderRadius: 4, padding: '2px 10px', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }}
              >
                Загрузить
              </button>
            </>
          ) : null}
          <button
            onClick={() => dispatch(dismissUpdateBanner())}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }}
          >
            ×
          </button>
        </div>
      )}

      {showRosettaBanner ? (
        <Portal>
          <div className="fixed bottom-0 left-0 right-0 z-10 bg-amber-100 border border-amber-400 text-amber-700 px-4 py-3" role="alert">
            <strong className="font-bold">WARNING:</strong>
            <div>
              It looks like Bruno was launched as the Intel (x64) build under Rosetta on your Apple Silicon Mac. This can cause reduced performance and unexpected behavior.
            </div>
            <button className="absolute right-2 top-0 text-xl" onClick={() => setShowRosettaBanner(!showRosettaBanner)}>
              &times;
            </button>
          </div>
        </Portal>
      ) : null}
      <div
        ref={mainSectionRef}
        className="flex-1 min-h-0 flex"
        data-app-state="loading"
        style={{
          height: isConsoleOpen ? `calc(100vh - 60px - ${isConsoleOpen ? '300px' : '0px'})` : 'calc(100vh - 60px)'
        }}
      >
        <StyledWrapper className={className} style={{ height: '100%', zIndex: 1 }}>
          <Sidebar />
          <section className="flex flex-grow flex-col overflow-hidden">
            {showApiSpecPage && activeApiSpecUid ? (
              <ApiSpecPanel key={activeApiSpecUid} />
            ) : showManageWorkspacePage ? (
              <ManageWorkspace />
            ) : (
              <>
                <RequestTabs />
                <RequestTabPanel key={activeTabUid} />
              </>
            )}
          </section>
        </StyledWrapper>
      </div>

      <Devtools mainSectionRef={mainSectionRef} />
      <StatusBar />
      <TransientRequestModalsRenderer modals={saveTransientRequestModals} />
    </div>
    // </ErrorCapture>
  );
}
