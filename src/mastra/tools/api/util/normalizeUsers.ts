import { z } from 'zod';

// Zod schema for User (minimal, with catchall to allow extra properties).
export const userSchema = z
  .object({
    id: z.string().optional(),
    email: z.string().optional(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    displayName: z.string().optional(),
    name: z.string().optional(),
    username: z.string().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .catchall(z.any());

export const usersListSchema = z.array(userSchema);

export type User = z.infer<typeof userSchema>;

// Utility to normalize various API user response shapes into a consistent array.
export function normalizeUsersResponse(raw: unknown): User[] {
  if (!raw) return [];

  // unwrap common wrapper shapes
  let arr: any[] = [];
  if (Array.isArray(raw)) arr = raw;
  else if ((raw as any).users && Array.isArray((raw as any).users)) arr = (raw as any).users;
  else if ((raw as any).data && Array.isArray((raw as any).data?.users)) arr = (raw as any).data.users;
  else if ((raw as any).data && Array.isArray((raw as any).data)) arr = (raw as any).data;
  else if (Array.isArray((raw as any).items)) arr = (raw as any).items;
  else arr = [raw as any];

  return arr.map((it: any) => {
    const u: User = {} as any;
    const src = it ?? {};

    u.id = src.id ?? src.user_id ?? src.uid ?? src._id ?? undefined;
    u.email = src.email ?? src.email_address ?? src.emailAddress ?? undefined;
    u.firstName = src.firstName ?? src.first_name ?? src.given_name ?? undefined;
    u.lastName = src.lastName ?? src.last_name ?? src.family_name ?? undefined;
    u.displayName = src.displayName ?? src.display_name ?? src.name ?? src.fullName ?? undefined;
    u.name = u.displayName || [u.firstName, u.lastName].filter(Boolean).join(' ') || src.name || undefined;
    u.username = src.username ?? src.login ?? undefined;
    u.createdAt = src.created_at ?? src.createdAt ?? src.created ?? undefined;
    u.updatedAt = src.updated_at ?? src.updatedAt ?? src.updated ?? undefined;

    for (const k of Object.keys(src)) {
      if (!(k in u)) u[k] = src[k];
    }

    return u;
  });
}
