import React, { useRef, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import {
  browseDirectory,
  downloadCollectionFromGit,
  openMultipleCollections,
  scanForBrunoFiles
} from 'providers/ReduxStore/slices/collections/actions';
import { removeGitOperationProgress } from 'providers/ReduxStore/slices/app';
import Modal from 'components/Modal';
import path from 'utils/common/path';
import Portal from 'components/Portal';
import { IconRefresh, IconCheck, IconAlertCircle, IconCloudDownload } from '@tabler/icons';
import { uuid } from 'utils/common/index';
import StyledWrapper from './StyledWrapper';
import GitNotFoundModal from 'components/Git/GitNotFoundModal/index';
import get from 'lodash/get';

const DownloadCollectionFromGit = ({ onClose, onFinish }) => {
  const [collectionPaths, setCollectionPaths] = useState([]);
  const [selectedCollectionPaths, setSelectedCollectionPaths] = useState([]);
  const [processUid, setProcessUid] = useState(uuid());
  const [steps, setSteps] = useState([]);
  const [view, setView] = useState('form');

  const progressData = useSelector((state) => state.app.gitOperationProgress[processUid]);
  const { gitVersion } = useSelector((state) => state.app);
  const { workspaces, activeWorkspaceUid } = useSelector((state) => state.workspaces);
  const preferences = useSelector((state) => state.app.preferences);
  const activeWorkspace = workspaces.find((w) => w.uid === activeWorkspaceUid);
  const isDefaultWorkspace = !activeWorkspace || activeWorkspace.type === 'default';
  const defaultLocation = isDefaultWorkspace
    ? get(preferences, 'general.defaultLocation', '')
    : (activeWorkspace?.pathname ? path.join(activeWorkspace.pathname, 'collections') : '');
  const inputRef = useRef();
  const dispatch = useDispatch();

  useEffect(() => {
    if (progressData) {
      setSteps((prev) =>
        prev.map((step) =>
          step.step === 'download' && !step?.completed
            ? { ...step, title: 'Downloading collection files', completed: false, info: progressData.progressData }
            : step
        )
      );
    }
  }, [progressData]);

  useEffect(() => {
    if (inputRef?.current) {
      inputRef.current.focus();
    }
  }, []);

  const downloadInProgress = () => {
    setSteps((prev) => [
      ...prev,
      {
        step: 'download',
        title: 'Downloading collection files',
        completed: false
      }
    ]);
  };

  const downloadFinished = () => {
    setSteps((prev) =>
      prev.map((step) =>
        step.step === 'download'
          ? { ...step, title: 'Download successful', completed: true, info: '' }
          : step
      )
    );
  };

  const downloadError = () => {
    setSteps((prev) =>
      prev.map((step) =>
        step.step === 'download'
          ? { ...step, title: 'Download failed', completed: true, error: true }
          : step
      )
    );
  };

  const scanInProgress = () => {
    setSteps((prev) => [
      ...prev,
      {
        step: 'scan',
        title: 'Scanning for Bruno files',
        completed: false
      }
    ]);
  };

  const scanFinished = () => {
    setSteps((prev) =>
      prev.map((step) =>
        step.step === 'scan' ? { ...step, title: 'Scan successful', completed: true, info: '' } : step
      )
    );
  };

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      repositoryUrl: '',
      targetLocation: defaultLocation,
      collectionPath: ''
    },
    validationSchema: Yup.object({
      repositoryUrl: Yup.string().required('Repository URL is required'),
      targetLocation: Yup.string().min(1, 'Location is required').required('Location is required')
    }),
    onSubmit: async (values) => {
      try {
        setView('progress');
        downloadInProgress();
        const { repositoryUrl, targetLocation, collectionPath } = values;

        await dispatch(
          downloadCollectionFromGit({
            url: repositoryUrl,
            targetPath: targetLocation,
            processUid,
            collectionPath: collectionPath.trim()
          })
        );

        downloadFinished();
        dispatch(removeGitOperationProgress(processUid));

        scanInProgress();
        const foundCollectionPaths = await dispatch(scanForBrunoFiles(targetLocation));
        scanFinished();
        setCollectionPaths(foundCollectionPaths);
      } catch (err) {
        downloadError();
        dispatch(removeGitOperationProgress(processUid));
        console.error(err);
      }
    }
  });

  const browse = () => {
    dispatch(browseDirectory())
      .then((dirPath) => {
        if (typeof dirPath === 'string') {
          formik.setFieldValue('targetLocation', dirPath);
        }
      })
      .catch((error) => {
        formik.setFieldValue('targetLocation', '');
        console.error(error);
      });
  };

  const handleCollectionSelect = (collection) => {
    setSelectedCollectionPaths((prevSelected) =>
      prevSelected.includes(collection)
        ? prevSelected.filter((c) => c !== collection)
        : [...prevSelected, collection]
    );
  };

  const getRelativePath = (fullPath, pathname) => {
    let relativePath = path.relative(fullPath, pathname);
    const { dir, name } = path.parse(relativePath);
    return path.join(dir, name);
  };

  const isScanCompleted = () => steps.some((step) => step.step === 'scan' && step.completed);

  const isConfirmDisabled = () => isScanCompleted() && collectionPaths?.length > 0 && selectedCollectionPaths?.length === 0;

  const isFooterHidden = () => steps.some((step) => !step.completed);

  const isError = () => steps.some((step) => step.error);

  const handleConfirm = () => {
    const buttonText = getConfirmText();
    switch (buttonText) {
      case 'Download':
        formik.handleSubmit();
        break;
      case 'Close':
        onClose();
        break;
      case 'Open':
        if (collectionPaths.length > 0 && selectedCollectionPaths.length > 0) {
          dispatch(openMultipleCollections(selectedCollectionPaths));
          onClose();
          onFinish();
        }
        break;
      default:
        break;
    }
  };

  const getConfirmText = () =>
    !steps.length
      ? 'Download'
      : steps.some((step) => !step.completed || step.error || (isScanCompleted() && !collectionPaths?.length))
        ? 'Close'
        : 'Open';

  const handleBackButtonClick = () => {
    setView('form');
    setSteps([]);
    setSelectedCollectionPaths([]);
  };

  if (!gitVersion) {
    return <GitNotFoundModal onClose={onClose} />;
  }

  return (
    <Portal id="download-collection-portal">
      <Modal
        size="md"
        title="Download Collection from Git"
        confirmText={getConfirmText()}
        handleConfirm={handleConfirm}
        handleCancel={onClose}
        confirmDisabled={isConfirmDisabled()}
        hideFooter={isFooterHidden()}
        hideCancel={isError() || (isScanCompleted() && !collectionPaths?.length)}
        showBackButton={isError()}
        handleBack={handleBackButtonClick}
      >
        <StyledWrapper>
          {view === 'form' && (
            <form className="bruno-form" onSubmit={(e) => e.preventDefault()}>
              <div>
                <label htmlFor="repository-url" className="flex items-center font-semibold">
                  Git Repository URL
                </label>
                <input
                  id="repository-url"
                  type="text"
                  name="repositoryUrl"
                  ref={inputRef}
                  className="block textbox mt-2 w-full"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck="false"
                  onChange={formik.handleChange}
                  value={formik.values.repositoryUrl || ''}
                />
                {formik.touched.repositoryUrl && formik.errors.repositoryUrl && (
                  <div className="text-red-500">{formik.errors.repositoryUrl}</div>
                )}
                <label htmlFor="collection-path" className="block font-semibold mt-3">
                  Collection Path in Repository
                </label>
                <input
                  id="collection-path"
                  type="text"
                  name="collectionPath"
                  className="block textbox mt-2 w-full"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck="false"
                  placeholder="bruno-collection"
                  onChange={formik.handleChange}
                  value={formik.values.collectionPath || ''}
                />
                <div className="mt-1 text-xs opacity-60">
                  Path to the collection folder inside the repository. Leave empty to download the entire repository.
                </div>
                <label htmlFor="target-location" className="block font-semibold mt-3">
                  Target Directory
                </label>
                <input
                  id="target-location"
                  type="text"
                  name="targetLocation"
                  readOnly
                  className="block textbox mt-2 w-full cursor-pointer"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck="false"
                  value={formik.values.targetLocation || ''}
                  onClick={browse}
                />
                {formik.touched.targetLocation && formik.errors.targetLocation && (
                  <div className="text-red-500">{formik.errors.targetLocation}</div>
                )}
                <div className="mt-1">
                  <span className="text-link cursor-pointer hover:underline" onClick={browse}>
                    Browse
                  </span>
                </div>
                <div className="mt-2 text-xs opacity-60">
                  Files will be downloaded directly into this directory without creating a .git folder.
                </div>
              </div>
            </form>
          )}
          {view === 'progress' && (
            <>
              {steps.length > 0 && (
                <div className="mt-4">
                  <ul>
                    {steps.map((step, index) => (
                      <li key={index} className="flex-col items-center space-x-2 mt-1">
                        <div className="flex">
                          {step.error ? (
                            <IconAlertCircle className="text-red-500" size={18} strokeWidth={1.5} />
                          ) : (
                            <>
                              {step.completed ? (
                                <IconCheck className="text-green-500" size={18} strokeWidth={1.5} />
                              ) : (
                                <IconRefresh className="text-yellow-500 animate-spin" size={18} strokeWidth={1.5} />
                              )}
                            </>
                          )}
                          <span className="ml-2">{step.title}</span>
                        </div>
                        {step.info && (
                          <div className="w-full mt-2">
                            <pre className="info-box ml-4">{step.info}</pre>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {isScanCompleted() && (
                <div className="mt-4 mb-4">
                  {collectionPaths.length === 0 && (
                    <div className="flex">
                      <IconAlertCircle className="text-yellow-500" size={18} strokeWidth={1.5} />
                      <h3 className="text-sm ml-2">No Bruno collections found in the downloaded files.</h3>
                    </div>
                  )}
                  {collectionPaths.length > 0 && (
                    <>
                      <h3 className="text-sm mb-2">
                        {collectionPaths.length} Bruno collections found. Please select the collections to open:
                      </h3>
                      <ul>
                        {collectionPaths.map((collection) => (
                          <li key={collection} className="mb-2">
                            <label className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                checked={selectedCollectionPaths.includes(collection)}
                                onChange={() => handleCollectionSelect(collection)}
                                className="form-checkbox"
                              />
                              <span>{getRelativePath(formik.values.targetLocation, collection)}</span>
                            </label>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </StyledWrapper>
      </Modal>
    </Portal>
  );
};

export default DownloadCollectionFromGit;
