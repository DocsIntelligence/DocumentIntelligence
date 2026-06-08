import { useEffect, useState } from 'react';
import { selectUser, useAppSelector } from '@org/store';
import { Button, Card } from '@org/ui';
import { toast } from 'sonner';
import { AdminLookups } from './AdminLookups';
import { useConfirm } from '../../components/confirm/ConfirmProvider';
import { APP_ENV } from '../../../config';

const API_BASE_URL = APP_ENV.apiUrl;

interface UserRow {
  id: string;
  name: string;
  email: string;
  username: string;
  role: string;
  provider: string;
  emailVerified: boolean;
  createdAt: string;
}

interface Stats {
  userCount: number;
  paymentCount: number;
  activeWallets: number;
}

export function AdminDashboard() {
  const currentUser = useAppSelector(selectUser);
  const confirm = useConfirm();
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE_URL}/admin/stats`, { credentials: 'include' }).then(
        (r) => r.json(),
      ),
      fetch(`${API_BASE_URL}/admin/users`, { credentials: 'include' }).then(
        (r) => r.json(),
      ),
    ])
      .then(([s, u]) => {
        setStats(s);
        setUsers(u.users ?? []);
      })
      .catch(() => toast.error('Failed to load admin data'))
      .finally(() => setLoading(false));
  }, []);

  const toggleRole = async (userId: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    try {
      await fetch(`${API_BASE_URL}/admin/users/${userId}/role`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)),
      );
      toast.success(`Role updated to ${newRole}`);
    } catch {
      toast.error('Failed to update role');
    }
  };

  const deleteUser = async (userId: string) => {
    const ok = await confirm({
      title: 'Delete this user?',
      description: 'This cannot be undone.',
      confirmLabel: 'Delete',
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      await fetch(`${API_BASE_URL}/admin/users/${userId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      toast.success('User deleted');
    } catch {
      toast.error('Failed to delete user');
    }
  };

  if (currentUser?.role !== 'admin') {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-foreground">Access Denied</h2>
        <p className="text-foreground/60 mt-2">
          You need admin privileges to view this page.
        </p>
      </div>
    );
  }

  if (loading)
    return <p className="text-foreground/60">Loading admin panel...</p>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">
          Admin Dashboard
        </h2>
        <p className="text-foreground/60 mt-1">
          Manage users and platform settings
        </p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="rounded-xl p-5">
            <p className="text-xs font-medium text-foreground/50 uppercase tracking-wide">
              Total Users
            </p>
            <p className="text-2xl font-bold text-foreground mt-1">
              {stats.userCount}
            </p>
          </Card>
          <Card className="rounded-xl p-5">
            <p className="text-xs font-medium text-foreground/50 uppercase tracking-wide">
              Payments
            </p>
            <p className="text-2xl font-bold text-foreground mt-1">
              {stats.paymentCount}
            </p>
          </Card>
          <Card className="rounded-xl p-5">
            <p className="text-xs font-medium text-foreground/50 uppercase tracking-wide">
              Active Wallets
            </p>
            <p className="text-2xl font-bold text-foreground mt-1">
              {stats.activeWallets}
            </p>
          </Card>
        </div>
      )}

      {/* Users table */}
      <Card className="rounded-xl p-6 overflow-x-auto">
        <h3 className="font-medium text-foreground mb-4">Users</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50 text-left">
              <th className="pb-2 font-medium text-foreground/60">Name</th>
              <th className="pb-2 font-medium text-foreground/60">Email</th>
              <th className="pb-2 font-medium text-foreground/60">Provider</th>
              <th className="pb-2 font-medium text-foreground/60">Role</th>
              <th className="pb-2 font-medium text-foreground/60">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-border/20">
                <td className="py-2 text-foreground">{user.name}</td>
                <td className="py-2 text-foreground/70">{user.email}</td>
                <td className="py-2">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground capitalize">
                    {user.provider}
                  </span>
                </td>
                <td className="py-2">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${user.role === 'admin' ? 'bg-primary/10 text-primary' : 'bg-secondary text-secondary-foreground'}`}
                  >
                    {user.role}
                  </span>
                </td>
                <td className="py-2 flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => toggleRole(user.id, user.role)}
                  >
                    {user.role === 'admin' ? 'Demote' : 'Promote'}
                  </Button>
                  {user.id !== currentUser?.id && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteUser(user.id)}
                      className="text-error"
                    >
                      Delete
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Lookups Management */}
      <Card className="rounded-xl p-6">
        <AdminLookups />
      </Card>
    </div>
  );
}

export default AdminDashboard;
