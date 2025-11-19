"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BanIcon,
  Loader2Icon,
  RefreshCcwIcon,
  Trash2Icon,
  UserPlusIcon,
} from "lucide-react";
import type { UserAccount, UserRole } from "@/types/user";
import { USER_ROLES } from "@/types/user";

const PAGE_SIZE = 25;
const EMPTY_INVITE_FORM = {
  email: "",
  fullName: "",
  role: "member" as UserRole,
};

interface ListResponse {
  users: UserAccount[];
  page: number;
  perPage: number;
  hasMore: boolean;
}

export default function UsersSettingsPage() {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [pagination, setPagination] = useState({
    page: 0,
    perPage: PAGE_SIZE,
    hasMore: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState(EMPTY_INVITE_FORM);
  const [isInviting, setIsInviting] = useState(false);
  const [actionUserId, setActionUserId] = useState<string | null>(null);

  useEffect(() => {
    void loadUsers();
  }, []);

  const loadUsers = async (page = 1, append = false) => {
    if (append) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
    }

    try {
      setError(null);
      const response = await fetch(`/api/users?page=${page}&perPage=${PAGE_SIZE}`);
      if (!response.ok) {
        const err = await safeJson(response);
        throw new Error(err?.error || "Failed to load users");
      }

      const data = (await response.json()) as ListResponse;
      setUsers((prev) => (append ? [...prev, ...data.users] : data.users));
      setPagination({
        page: data.page,
        perPage: data.perPage,
        hasMore: data.hasMore,
      });
    } catch (err) {
      console.error("Failed to load users", err);
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  const handleInviteSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!inviteForm.email.trim()) {
      alert("Email is required");
      return;
    }

    setIsInviting(true);

    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteForm.email.trim(),
          fullName: inviteForm.fullName.trim() || undefined,
          role: inviteForm.role,
        }),
      });

      if (!response.ok) {
        const err = await safeJson(response);
        throw new Error(err?.error || "Failed to invite user");
      }

      const created = (await response.json()) as UserAccount;
      setUsers((prev) => [created, ...prev]);
      setInviteDialogOpen(false);
      setInviteForm(EMPTY_INVITE_FORM);
    } catch (err) {
      console.error("Failed to invite user", err);
      alert(err instanceof Error ? err.message : "Failed to invite user");
    } finally {
      setIsInviting(false);
    }
  };

  const handleRoleChange = async (userId: string, role: UserRole) => {
    setActionUserId(userId);
    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!response.ok) {
        const err = await safeJson(response);
        throw new Error(err?.error || "Failed to update role");
      }

      const updated = (await response.json()) as UserAccount;
      setUsers((prev) => prev.map((user) => (user.id === userId ? updated : user)));
    } catch (err) {
      console.error("Failed to update role", err);
      alert(err instanceof Error ? err.message : "Failed to update role");
    } finally {
      setActionUserId(null);
    }
  };

  const handleToggleStatus = async (user: UserAccount) => {
    setActionUserId(user.id);
    try {
      const nextStatus = user.status === "disabled" ? "active" : "disabled";
      const response = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (!response.ok) {
        const err = await safeJson(response);
        throw new Error(err?.error || "Failed to update user status");
      }

      const updated = (await response.json()) as UserAccount;
      setUsers((prev) => prev.map((item) => (item.id === user.id ? updated : item)));
    } catch (err) {
      console.error("Failed to update status", err);
      alert(err instanceof Error ? err.message : "Failed to update user status");
    } finally {
      setActionUserId(null);
    }
  };

  const handleDelete = async (user: UserAccount) => {
    if (
      !confirm(
        `Remove ${user.email}? This immediately revokes their Supabase access.`
      )
    ) {
      return;
    }

    setActionUserId(user.id);
    try {
      const response = await fetch(`/api/users/${user.id}`, { method: "DELETE" });
      if (!response.ok) {
        const err = await safeJson(response);
        throw new Error(err?.error || "Failed to remove user");
      }

      setUsers((prev) => prev.filter((item) => item.id !== user.id));
    } catch (err) {
      console.error("Failed to delete user", err);
      alert(err instanceof Error ? err.message : "Failed to remove user");
    } finally {
      setActionUserId(null);
    }
  };

  const renderStatusBadge = (status: UserAccount["status"]) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500/10 text-green-700 dark:text-green-400">Active</Badge>;
      case "invited":
        return <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400">Invited</Badge>;
      case "disabled":
        return <Badge className="bg-red-500/10 text-red-700 dark:text-red-400">Disabled</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  return (
    <div className="container mx-auto max-w-6xl px-4 py-10">
      <header className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
          <p className="text-muted-foreground">
            Invite teammates, update roles, and manage Supabase-authenticated users.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button asChild variant="outline">
            <Link href="/">Back to dashboard</Link>
          </Button>
          <Button variant="secondary" onClick={() => loadUsers(1)}>
            <RefreshCcwIcon className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Dialog open={isInviteDialogOpen} onOpenChange={setInviteDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setInviteForm(EMPTY_INVITE_FORM)}>
                <UserPlusIcon className="mr-2 h-4 w-4" />
                Invite user
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleInviteSubmit}>
                <DialogHeader>
                  <DialogTitle>Invite a teammate</DialogTitle>
                  <DialogDescription>
                    Supabase will send them a magic link to finish onboarding.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="invite-email">Email</Label>
                    <Input
                      id="invite-email"
                      type="email"
                      value={inviteForm.email}
                      onChange={(event) =>
                        setInviteForm((prev) => ({ ...prev, email: event.target.value }))
                      }
                      placeholder="teammate@example.com"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="invite-name">Full name</Label>
                    <Input
                      id="invite-name"
                      value={inviteForm.fullName}
                      onChange={(event) =>
                        setInviteForm((prev) => ({ ...prev, fullName: event.target.value }))
                      }
                      placeholder="Ada Lovelace"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="invite-role">Role</Label>
                    <Select
                      value={inviteForm.role}
                      onValueChange={(value) =>
                        setInviteForm((prev) => ({ ...prev, role: value as UserRole }))
                      }
                    >
                      <SelectTrigger id="invite-role">
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                      <SelectContent>
                        {USER_ROLES.map((role) => (
                          <SelectItem key={role} value={role}>
                            {role.charAt(0).toUpperCase() + role.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setInviteDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isInviting}>
                    {isInviting ? (
                      <>
                        <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      "Send invite"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      {isLoading ? (
        <Card>
          <CardContent className="flex items-center gap-2 py-10 text-muted-foreground">
            <Loader2Icon className="h-5 w-5 animate-spin" />
            Loading users...
          </CardContent>
        </Card>
      ) : error ? (
        <Card className="border-destructive/40 bg-destructive/10">
          <CardContent className="py-6 text-destructive">{error}</CardContent>
        </Card>
      ) : users.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No users yet</CardTitle>
            <CardDescription>Invite your first teammate to get started.</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button onClick={() => setInviteDialogOpen(true)}>
              <UserPlusIcon className="mr-2 h-4 w-4" />
              Invite user
            </Button>
          </CardFooter>
        </Card>
      ) : (
        <Card>
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Workspace users</CardTitle>
              <CardDescription>
                {users.length} user{users.length === 1 ? "" : "s"} loaded
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => loadUsers(1)}>
              <RefreshCcwIcon className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="text-muted-foreground">
                  <th className="py-2 text-left font-medium">User</th>
                  <th className="py-2 text-left font-medium">Role</th>
                  <th className="py-2 text-left font-medium">Status</th>
                  <th className="py-2 text-left font-medium">Last active</th>
                  <th className="py-2 text-left font-medium">MFA</th>
                  <th className="py-2 text-left font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const isBusy = actionUserId === user.id;
                  return (
                    <tr key={user.id} className="border-t">
                      <td className="py-3">
                        <div className="flex flex-col">
                          <span className="font-medium">{user.fullName || "—"}</span>
                          <span className="text-xs text-muted-foreground">{user.email}</span>
                        </div>
                      </td>
                      <td className="py-3">
                        <Select
                          value={user.role}
                          onValueChange={(value) => handleRoleChange(user.id, value as UserRole)}
                          disabled={isBusy}
                        >
                          <SelectTrigger className="w-[140px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {USER_ROLES.map((role) => (
                              <SelectItem key={role} value={role}>
                                {role.charAt(0).toUpperCase() + role.slice(1)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="py-3">{renderStatusBadge(user.status)}</td>
                      <td className="py-3">
                        {user.lastSignInAt
                          ? new Date(user.lastSignInAt).toLocaleString()
                          : "Never"}
                      </td>
                      <td className="py-3">{user.factorsCount}</td>
                      <td className="py-3">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleToggleStatus(user)}
                            disabled={isBusy}
                          >
                            {isBusy ? (
                              <Loader2Icon className="h-4 w-4 animate-spin" />
                            ) : user.status === "disabled" ? (
                              <>
                                <RefreshCcwIcon className="mr-1 h-4 w-4" />
                                Enable
                              </>
                            ) : (
                              <>
                                <BanIcon className="mr-1 h-4 w-4" />
                                Disable
                              </>
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDelete(user)}
                            disabled={isBusy}
                          >
                            <Trash2Icon className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
          {pagination.hasMore && (
            <CardFooter>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => loadUsers(pagination.page + 1, true)}
                disabled={isLoadingMore}
              >
                {isLoadingMore ? (
                  <>
                    <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                    Loading more...
                  </>
                ) : (
                  "Load more"
                )}
              </Button>
            </CardFooter>
          )}
        </Card>
      )}
    </div>
  );
}

async function safeJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}
