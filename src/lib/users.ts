/** Admin account storage: create, list, change password. Password hashing lives in auth.ts. */
import { hashPassword, type Role } from './auth';
import { insert, select, update } from './db';
import { isEmail } from './settings';

export const ROLES: Role[] = ['owner', 'sales', 'viewer'];
export const roleHelp: Record<Role, string> = {
  owner: 'Everything, including settings, users and the activity log.',
  sales: 'Works the enquiries (notes, stages, assignment) and sees the stats.',
  viewer: 'Can look, cannot change anything.',
};
export const isRole = (r: unknown): r is Role => ROLES.includes(r as Role);

export const cleanEmail = (s: unknown) => String(s ?? '').trim().toLowerCase().slice(0, 200);
export const cleanName = (s: unknown) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
export const emailProblem = (e: string) => (isEmail(e) ? '' : 'Enter a valid email address.');

/** Creates the account and returns it. Throws if the email is already taken (unique index). */
export async function createUser(u: { email: string; name: string; role: Role; password: string; mustChange: boolean }) {
  return insert('admin_users', { email: u.email, name: u.name, role: u.role, password_hash: await hashPassword(u.password), must_change_password: u.mustChange }, true);
}

export async function setPassword(id: string, password: string, mustChange: boolean) {
  const password_hash = await hashPassword(password);
  await update('admin_users', `id=eq.${id}`, { password_hash, must_change_password: mustChange });
  return password_hash;
}

export const listUsers = () => select('admin_users', 'select=id,email,name,role,active,must_change_password,created_at,last_login_at&order=created_at.asc');

/** Active users who can be assigned work (owners and sales). */
export const assignableUsers = () => select('admin_users', 'select=id,name,email,role&active=is.true&role=in.(owner,sales)&order=name.asc');
