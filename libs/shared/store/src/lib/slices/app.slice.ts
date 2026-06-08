import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export const APP_FEATURE_KEY = 'app';

export type Theme = 'light' | 'dark' | 'system';

export interface AppNotification {
  id: string;
  level: 'info' | 'success' | 'warning' | 'error';
  message: string;
  createdAt: number;
}

export interface AppState {
  theme: Theme;
  locale: string;
  sidebarOpen: boolean;
  notifications: AppNotification[];
}

export const initialAppState: AppState = {
  theme: 'system',
  locale: 'en-US',
  sidebarOpen: true,
  notifications: [],
};

const appSlice = createSlice({
  name: APP_FEATURE_KEY,
  initialState: initialAppState,
  reducers: {
    setTheme(state, action: PayloadAction<Theme>) {
      state.theme = action.payload;
    },
    setLocale(state, action: PayloadAction<string>) {
      state.locale = action.payload;
    },
    toggleSidebar(state) {
      state.sidebarOpen = !state.sidebarOpen;
    },
    pushNotification(
      state,
      action: PayloadAction<Omit<AppNotification, 'id' | 'createdAt'>>,
    ) {
      state.notifications.push({
        ...action.payload,
        id:
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random()}`,
        createdAt: Date.now(),
      });
    },
    dismissNotification(state, action: PayloadAction<string>) {
      state.notifications = state.notifications.filter(
        (n) => n.id !== action.payload,
      );
    },
  },
});

export const appReducer = appSlice.reducer;
export const appActions = appSlice.actions;

export const selectTheme = (state: { [APP_FEATURE_KEY]: AppState }) =>
  state[APP_FEATURE_KEY].theme;
export const selectLocale = (state: { [APP_FEATURE_KEY]: AppState }) =>
  state[APP_FEATURE_KEY].locale;
export const selectSidebarOpen = (state: { [APP_FEATURE_KEY]: AppState }) =>
  state[APP_FEATURE_KEY].sidebarOpen;
export const selectNotifications = (state: { [APP_FEATURE_KEY]: AppState }) =>
  state[APP_FEATURE_KEY].notifications;
