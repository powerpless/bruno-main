import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  info: null,
  progress: null,
  ready: null,
  error: null,
  bannerDismissed: false
};

export const autoUpdateSlice = createSlice({
  name: 'autoUpdate',
  initialState,
  reducers: {
    setUpdateAvailable: (state, action) => {
      state.info = action.payload;
      state.bannerDismissed = false;
      state.error = null;
    },
    setUpdateProgress: (state, action) => {
      state.progress = action.payload;
    },
    setUpdateDownloaded: (state, action) => {
      state.progress = null;
      state.ready = action.payload;
      state.error = null;
      state.info = null;
      state.bannerDismissed = false;
    },
    setUpdateError: (state, action) => {
      state.error = action.payload;
      state.progress = null;
    },
    dismissUpdateBanner: (state) => {
      state.bannerDismissed = true;
      state.error = null;
    },
    showUpdateBanner: (state) => {
      state.bannerDismissed = false;
    },
    startUpdateDownload: (state) => {
      state.progress = { percent: 0 };
    },
    resetUpdateProgress: (state) => {
      state.progress = null;
    }
  }
});

export const {
  setUpdateAvailable,
  setUpdateProgress,
  setUpdateDownloaded,
  setUpdateError,
  dismissUpdateBanner,
  showUpdateBanner,
  startUpdateDownload,
  resetUpdateProgress
} = autoUpdateSlice.actions;

export default autoUpdateSlice.reducer;
