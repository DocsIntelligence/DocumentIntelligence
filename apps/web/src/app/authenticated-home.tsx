'use client';

import {
  fetchMeThunk,
  logoutThunk,
  selectUser,
  useAppDispatch,
  useAppSelector,
} from '@org/store';
import { Button, Card, UserAvatar } from '@org/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { SITE_NAME } from '../lib/site';

export function AuthenticatedHome() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const user = useAppSelector(selectUser);

  useEffect(() => {
    if (!user) void dispatch(fetchMeThunk());
  }, [dispatch, user]);

  const onLogout = async () => {
    await dispatch(logoutThunk());
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/95 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-foreground">{SITE_NAME}</h1>
          <div className="flex items-center gap-3">
            <Link
              href="/settings"
              className="text-sm text-foreground/70 hover:text-foreground transition-colors"
            >
              Settings
            </Link>
            <Button variant="ghost" size="sm" onClick={onLogout}>
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="flex flex-col items-center text-center space-y-6">
          <UserAvatar name={user?.name} src={user?.picture} size="lg" />

          {user ? (
            <>
              <div>
                <h2 className="text-2xl font-semibold text-foreground">
                  Welcome back, {user.name}
                </h2>
                <p className="text-foreground/60 mt-1">{user.email}</p>
              </div>

              <Card className="rounded-xl p-6 w-full max-w-md text-left">
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-foreground/60">Username</span>
                    <span className="text-foreground font-medium">
                      @{user.username}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-foreground/60">Role</span>
                    <span className="inline-block text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                      {user.role}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-foreground/60">Member since</span>
                    <span className="text-foreground">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </Card>

              <div className="flex gap-3 pt-4">
                <Link
                  href="/settings"
                  className="px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  Manage Account
                </Link>
              </div>
            </>
          ) : (
            <p className="text-foreground/50 text-sm">Loading profile…</p>
          )}
        </div>
      </main>
    </div>
  );
}
