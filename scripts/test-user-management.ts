import { randomUUID } from 'node:crypto';
import {
  createApiToken,
  createUser,
  deactivateUser,
  getUser,
  listUsers,
  revokeApiToken,
  updateUser,
} from '@/lib/services/user-management.service';
import { createServiceSupabaseClient } from '@/lib/supabase';

async function ensureAdminUser(): Promise<string> {
  const supabase = createServiceSupabaseClient();

  const { data: existing } = await supabase
    .from('user_profiles')
    .select('user_id')
    .eq('role', 'admin')
    .limit(1)
    .maybeSingle();

  if (existing?.user_id) {
    return existing.user_id;
  }

  const email = `admin+${Date.now()}@repatch.test`;

  const { data: authUser, error } = await supabase.auth.admin.createUser({
    email,
    password: 'Admin123!',
    email_confirm: true,
    user_metadata: {
      full_name: 'Local Admin',
      role: 'admin',
    },
  });

  if (error || !authUser.user) {
    throw new Error(`Failed to create bootstrap admin: ${error?.message}`);
  }

  const { error: updateError } = await supabase
    .from('user_profiles')
    .update({ role: 'admin', status: 'active', email })
    .eq('user_id', authUser.user.id);

  if (updateError) {
    throw new Error(`Failed to promote admin: ${updateError.message}`);
  }

  return authUser.user.id;
}

async function main() {
  const actorId = await ensureAdminUser();
  console.log('✅ Using admin actor', actorId);

  const list = await listUsers(actorId, { limit: 5 });
  if (!list.success) throw new Error(list.error);
  console.log('👥 Existing users:', list.data.total);

  const email = `test+${randomUUID()}@example.com`;
  const created = await createUser(actorId, {
    email,
    fullName: 'API Tester',
    role: 'viewer',
    status: 'active',
  });
  if (!created.success) throw new Error(created.error);

  console.log('🆕 Created user', created.data.user.id);

  const updated = await updateUser(actorId, created.data.user.id, {
    role: 'editor',
    metadata: { team: 'devrel' },
  });
  if (!updated.success) throw new Error(updated.error);
  console.log('✏️ Updated user role to', updated.data.role);

  const token = await createApiToken(actorId, {
    userId: created.data.user.id,
    name: 'Integration test token',
  });
  if (!token.success) throw new Error(token.error);
  console.log('🔐 Issued token', token.data.tokenId);

  const revoke = await revokeApiToken(actorId, created.data.user.id, token.data.tokenId);
  if (!revoke.success) throw new Error(revoke.error);
  console.log('❌ Revoked token');

  const detail = await getUser(actorId, created.data.user.id);
  if (!detail.success) throw new Error(detail.error);
  console.log('📄 User tokens count', detail.data.tokens.length);

  const deactivate = await deactivateUser(actorId, created.data.user.id);
  if (!deactivate.success) throw new Error(deactivate.error);
  console.log('🪦 Deactivated user status', deactivate.data.status);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
