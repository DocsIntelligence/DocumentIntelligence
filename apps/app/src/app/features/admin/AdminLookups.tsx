import { useEffect, useState } from 'react';
import { Button, Card, Input } from '@org/ui';
import { toast } from 'sonner';
import { useConfirm } from '../../components/confirm/ConfirmProvider';
import { APP_ENV } from '../../../config';

const API_BASE_URL = APP_ENV.apiUrl;

interface LookupValue {
  id: string;
  label: string;
  value: string | null;
  order: number;
  isActive: boolean;
}

interface LookupGroup {
  id: string;
  key: string;
  name: string;
  description: string | null;
  values: LookupValue[];
}

export function AdminLookups() {
  const confirm = useConfirm();
  const [groups, setGroups] = useState<LookupGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [newValue, setNewValue] = useState<{ label: string; value: string }>({
    label: '',
    value: '',
  });
  const [newGroup, setNewGroup] = useState<{
    key: string;
    name: string;
    description: string;
  }>({ key: '', name: '', description: '' });
  const [showNewGroup, setShowNewGroup] = useState(false);

  const fetchGroups = () => {
    fetch(`${API_BASE_URL}/admin/lookups`, { credentials: 'include' })
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(setGroups)
      .catch(() => {
        // Fallback to public endpoint
        fetch(`${API_BASE_URL}/lookups`)
          .then((r) => r.json())
          .then(setGroups)
          .catch(() => toast.error('Failed to load lookups'));
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  const addValue = async (groupId: string) => {
    if (!newValue.label.trim()) return;
    try {
      const res = await fetch(`${API_BASE_URL}/lookups/${groupId}/values`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: newValue.label,
          value:
            newValue.value ||
            newValue.label.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        }),
      });
      if (!res.ok) throw new Error('Failed to add');
      setNewValue({ label: '', value: '' });
      fetchGroups();
      toast.success('Value added');
    } catch {
      toast.error('Failed to add value');
    }
  };

  const toggleActive = async (valueId: string, isActive: boolean) => {
    try {
      await fetch(`${API_BASE_URL}/lookups/values/${valueId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive }),
      });
      fetchGroups();
    } catch {
      toast.error('Failed to update');
    }
  };

  const deleteValue = async (valueId: string) => {
    const ok = await confirm({
      title: 'Delete this value?',
      confirmLabel: 'Delete',
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      await fetch(`${API_BASE_URL}/lookups/values/${valueId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      fetchGroups();
      toast.success('Value deleted');
    } catch {
      toast.error('Failed to delete');
    }
  };

  const createGroup = async () => {
    if (!newGroup.key.trim() || !newGroup.name.trim()) return;
    try {
      const res = await fetch(`${API_BASE_URL}/lookups`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newGroup),
      });
      if (!res.ok) throw new Error('Failed to create');
      setNewGroup({ key: '', name: '', description: '' });
      setShowNewGroup(false);
      fetchGroups();
      toast.success('Group created');
    } catch {
      toast.error('Failed to create group');
    }
  };

  if (loading) return <p className="text-foreground/60">Loading lookups...</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-foreground">Lookup Groups</h3>
        <Button size="sm" onClick={() => setShowNewGroup(!showNewGroup)}>
          {showNewGroup ? 'Cancel' : 'New Group'}
        </Button>
      </div>

      {/* New group form */}
      {showNewGroup && (
        <Card className="rounded-xl p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              placeholder="key (e.g. department)"
              value={newGroup.key}
              onChange={(e) =>
                setNewGroup({ ...newGroup, key: e.target.value })
              }
            />
            <Input
              placeholder="Name"
              value={newGroup.name}
              onChange={(e) =>
                setNewGroup({ ...newGroup, name: e.target.value })
              }
            />
            <Input
              placeholder="Description (optional)"
              value={newGroup.description}
              onChange={(e) =>
                setNewGroup({ ...newGroup, description: e.target.value })
              }
            />
          </div>
          <Button size="sm" className="mt-3" onClick={createGroup}>
            Create Group
          </Button>
        </Card>
      )}

      {/* Groups list */}
      {groups.map((group) => (
        <Card key={group.id} className="rounded-xl p-4">
          <button
            type="button"
            className="w-full flex items-center justify-between text-left"
            onClick={() =>
              setExpandedGroup(expandedGroup === group.id ? null : group.id)
            }
          >
            <div>
              <p className="font-medium text-sm text-foreground">
                {group.name}
              </p>
              <p className="text-xs text-foreground/50">
                key:{' '}
                <code className="bg-secondary/50 px-1 rounded">
                  {group.key}
                </code>
                {' · '}
                {group.values.length} values
              </p>
            </div>
            <span className="text-foreground/40 text-sm">
              {expandedGroup === group.id ? '▼' : '▶'}
            </span>
          </button>

          {expandedGroup === group.id && (
            <div className="mt-3 space-y-2 border-t border-border/30 pt-3">
              {group.values.map((val) => (
                <div
                  key={val.id}
                  className="flex items-center justify-between text-sm py-1"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={
                        val.isActive
                          ? 'text-foreground'
                          : 'text-foreground/40 line-through'
                      }
                    >
                      {val.label}
                    </span>
                    <span className="text-xs text-foreground/40">
                      ({val.value})
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => toggleActive(val.id, val.isActive)}
                    >
                      {val.isActive ? 'Disable' : 'Enable'}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-error"
                      onClick={() => deleteValue(val.id)}
                    >
                      ×
                    </Button>
                  </div>
                </div>
              ))}

              {/* Add new value */}
              <div className="flex gap-2 pt-2 border-t border-border/20">
                <Input
                  placeholder="Label"
                  className="flex-1"
                  value={newValue.label}
                  onChange={(e) =>
                    setNewValue({ ...newValue, label: e.target.value })
                  }
                />
                <Input
                  placeholder="Value (auto)"
                  className="flex-1"
                  value={newValue.value}
                  onChange={(e) =>
                    setNewValue({ ...newValue, value: e.target.value })
                  }
                />
                <Button size="sm" onClick={() => addValue(group.id)}>
                  Add
                </Button>
              </div>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

export default AdminLookups;
