import React from 'react';
import { IconCloudDownload } from '@tabler/icons';

const DownloadGitTab = ({ handleSubmit }) => {
  const handleClick = () => {
    handleSubmit({ type: 'download-git' });
  };

  return (
    <div className="flex flex-col items-center justify-center py-8">
      <IconCloudDownload size={48} strokeWidth={1} className="mb-4 opacity-40" />
      <p className="text-sm text-center mb-4 opacity-60">
        Download collection files from a Git repository into a local directory without creating a .git folder.
      </p>
      <button className="btn btn-secondary" onClick={handleClick}>
        Open Download Dialog
      </button>
    </div>
  );
};

export default DownloadGitTab;
