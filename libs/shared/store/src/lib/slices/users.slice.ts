import type { UsersService } from '@org/api-client';
import type { UpdateUserDto, User } from '@org/dto';
import {
  createAsyncThunk,
  createEntityAdapter,
  createSelector,
  createSlice,
} from '@reduxjs/toolkit';

export const USERS_FEATURE_KEY = 'users';

export const usersAdapter = createEntityAdapter<User>();

export interface UsersState extends ReturnType<
  typeof usersAdapter.getInitialState
> {
  status: 'idle' | 'pending' | 'succeeded' | 'failed';
  error: string | null;
}

export const initialUsersState: UsersState = usersAdapter.getInitialState({
  status: 'idle',
  error: null,
});

type Thunks = { extra: { users: UsersService } };

export const fetchUsersThunk = createAsyncThunk<User[], void, Thunks>(
  'users/fetchAll',
  (_, { extra }) => extra.users.list(),
);

export const updateUserThunk = createAsyncThunk<
  User,
  { id: string; payload: UpdateUserDto },
  Thunks
>('users/update', ({ id, payload }, { extra }) =>
  extra.users.update(id, payload),
);

const usersSlice = createSlice({
  name: USERS_FEATURE_KEY,
  initialState: initialUsersState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchUsersThunk.pending, (state) => {
        state.status = 'pending';
      })
      .addCase(fetchUsersThunk.fulfilled, (state, action) => {
        usersAdapter.setAll(state, action.payload);
        state.status = 'succeeded';
      })
      .addCase(fetchUsersThunk.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message ?? 'failed';
      })
      .addCase(updateUserThunk.fulfilled, (state, action) => {
        usersAdapter.upsertOne(state, action.payload);
      });
  },
});

export const usersReducer = usersSlice.reducer;
export const usersActions = usersSlice.actions;

const adapterSelectors = usersAdapter.getSelectors<{
  [USERS_FEATURE_KEY]: UsersState;
}>((state) => state[USERS_FEATURE_KEY]);

export const selectAllUsers = adapterSelectors.selectAll;
export const selectUserEntities = adapterSelectors.selectEntities;
export const selectUserById = (id: string) =>
  createSelector(adapterSelectors.selectEntities, (entities) => entities[id]);
