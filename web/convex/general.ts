import { Id } from "./_generated/dataModel";
import { internalMutation } from "./_generated/server";

export const releaseExpiredLocks = internalMutation({
  handler: async ctx => {
    const objects: { _id: Id<"fields"> | Id<"assets"> }[] = (
      await Promise.all([
        ctx.db
          .query("fields")
          .filter(q => q.lt(q.field("editingLockExpires"), Date.now()))
          .collect(),
        ctx.db
          .query("assets")
          .filter(q => q.lt(q.field("editingLockExpires"), Date.now()))
          .collect()
      ])
    ).flat();

    await Promise.all(
      objects.map(f =>
        ctx.db.patch(f._id, {
          editing: false,
          editingBy: undefined,
          editingLockExpires: undefined
        })
      )
    );
  }
});
