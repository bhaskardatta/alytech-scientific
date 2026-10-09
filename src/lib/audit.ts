/** Activity log: who did what in the admin panel. Never throws; a failed log line must not undo the action itself. */
import { dbReady, insert } from './db';
import type { AdminUser } from './auth';

export async function audit(user: AdminUser | null | undefined, action: string, target?: string | null, details?: object) {
  if (!dbReady()) return;
  try {
    await insert('admin_audit', {
      user_id: user?.id ?? null,
      actor: user?.kind === 'breakglass' ? 'break-glass' : (user?.email ?? null),
      action,
      target: target ?? null,
      details: details ?? null,
    });
  } catch (e) {
    console.error('audit log failed', e);
  }
}
