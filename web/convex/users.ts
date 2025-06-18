import { getAuthUserId } from "@convex-dev/auth/server";
import { query } from "./_generated/server";

export const getAll = query({
  handler: async ctx => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return [];
    }

    const users = await ctx.db.query("users").order("asc").collect();
    return users.map(user => ({
      id: user._id,
      name: user.name,
      email: user.email
    }));
  }
});
