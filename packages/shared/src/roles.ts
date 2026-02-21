import { Role } from "@prisma/client";

export { Role };

/**
 * Privilege ordering. Higher number == more capability.
 * RBAC checks compare a member's role rank against the minimum required rank.
 */
export const ROLE_RANK: Record<Role, number> = {
  READONLY: 0,
  ANALYST: 1,
  ADMIN: 2,
  OWNER: 3,
};

/** True when `role` meets or exceeds `required`. */
export function roleSatisfies(role: Role, required: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[required];
}
