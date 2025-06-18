import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { Doc } from "./_generated/dataModel";
import { internalMutation, mutation, query } from "./_generated/server";

export type FieldType = Doc<"fields">;

export const getAll = query({
  handler: async ctx => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return {
        viewer: null,
        fields: []
      };
    }

    const fields = await ctx.db.query("fields").order("asc").collect();
    const editors = await Promise.all(
      fields.map(f =>
        f.editingBy ? ctx.db.get(f.editingBy) : Promise.resolve(null)
      )
    );

    return {
      viewer: userId,
      fields: fields.map((field, i) => ({
        field,
        editingBy: editors[i]
      }))
    };
  }
});

export const acquireLock = mutation({
  args: { id: v.id("fields") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return {
        success: false,
        error: "Not authenticated",
        _logs: ["Failed to acquire lock: not authenticated"]
      };
    }
    const field = await ctx.db.get(args.id);
    if (!field) {
      return {
        success: false,
        error: "Field not found",
        _logs: ["Failed to acquire lock: field not found"]
      };
    }
    if (field.editing && field.editingBy !== userId) {
      return {
        success: false,
        error: "Field is already being edited by another user",
        _logs: [
          `Failed to acquire lock for ${field.name}: already being edited by another user`
        ]
      };
    }

    const otherLocks = await ctx.db
      .query("fields")
      .filter(f => f.eq(f.field("editingBy"), userId))
      .collect();

    await Promise.all(
      otherLocks.map(f =>
        ctx.db.patch(f._id, {
          editing: false,
          editingBy: undefined,
          editingLockExpires: undefined
        })
      )
    );

    const now = Date.now();
    const expiresAt = now + 60 * 1000;
    await ctx.db.patch(args.id, {
      editing: true,
      editingBy: userId,
      editingLockExpires: expiresAt
    });
    return { success: true, _logs: [`Lock acquired for ${field.name}`] };
  }
});

export const releaseLock = mutation({
  args: { id: v.id("fields") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return {
        success: false,
        error: "Not authenticated",
        _logs: ["Failed to release lock: not authenticated"]
      };
    }
    const field = await ctx.db.get(args.id);
    if (!field) {
      return {
        success: false,
        error: "Field not found",
        _logs: ["Failed to release lock: field not found"]
      };
    }
    if (!field.editing || field.editingBy !== userId) {
      return {
        success: false,
        error: "Field is not being edited by you",
        _logs: [
          `Failed to release lock for ${field.name}: not being edited by you`
        ]
      };
    }
    await ctx.db.patch(args.id, {
      editing: false,
      editingBy: undefined,
      editingLockExpires: undefined
    });
    return { success: true, _logs: [`Lock released for ${field.name}`] };
  }
});

export const renewLock = mutation({
  args: { id: v.id("fields") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return {
        success: false,
        error: "Not authenticated",
        _logs: ["Failed to renew lock: not authenticated"]
      };
    }
    const field = await ctx.db.get(args.id);
    if (!field) {
      return {
        success: false,
        error: "Field not found",
        _logs: ["Failed to renew lock: field not found"]
      };
    }
    if (!field.editing || field.editingBy !== userId) {
      return {
        success: false,
        error: "Field is not being edited by you",
        _logs: [
          `Failed to renew lock for ${field.name}: not being edited by you`
        ]
      };
    }
    const now = Date.now();
    const expiresAt = now + 60 * 1000;
    await ctx.db.patch(args.id, {
      editingLockExpires: expiresAt
    });
    return { success: true, _logs: [`Lock renewed for ${field.name}`] };
  }
});

export const createField = mutation({
  args: {
    name: v.string(),
    type: v.union(
      v.literal("string"),
      v.literal("number"),
      v.literal("boolean"),
      v.literal("array"),
      v.literal("select"),
      v.literal("date"),
      v.literal("email"),
      v.literal("user"),
      v.literal("url"),
      v.literal("ip")
    ),
    required: v.boolean(),
    hidden: v.optional(v.boolean()),
    extra: v.optional(
      v.object({
        description: v.optional(v.string()),
        placeholder: v.optional(v.string()),
        regex: v.optional(v.string()),
        regexError: v.optional(v.string()),
        minLength: v.optional(v.number()),
        maxLength: v.optional(v.number()),
        minItems: v.optional(v.number()),
        maxItems: v.optional(v.number()),
        minValue: v.optional(v.number()),
        maxValue: v.optional(v.number()),
        icon: v.optional(v.string()),
        options: v.optional(v.array(v.string())),
        hideFromSearch: v.optional(v.boolean()),
        subnet: v.optional(v.string()),
        listObjectType: v.optional(v.string()),
        listObjectExtra: v.optional(
          v.object({
            regex: v.optional(v.string()),
            regexError: v.optional(v.string()),
            minLength: v.optional(v.number()),
            maxLength: v.optional(v.number()),
            minItems: v.optional(v.number()),
            maxItems: v.optional(v.number()),
            minValue: v.optional(v.number()),
            maxValue: v.optional(v.number())
          })
        )
      })
    )
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return {
        success: false,
        error: "Not authenticated",
        _logs: ["Failed to add field: not authenticated"]
      };
    }
    const newField = {
      name: args.name,
      slug: args.name.toLowerCase().replace(/\s+/g, "-"),
      type: args.type,
      required: args.required,
      hidden: args.hidden || false,
      extra: args.extra
    };
    const fieldId = await ctx.db.insert("fields", newField);
    return { success: true, fieldId, _logs: [`Field ${args.name} added`] };
  }
});

export const deleteField = mutation({
  args: { fieldId: v.id("fields") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return {
        success: false,
        error: "Not authenticated",
        _logs: ["Failed to delete field: not authenticated"]
      };
    }
    const field = await ctx.db.get(args.fieldId);
    if (!field) {
      return {
        success: false,
        error: "Field not found",
        _logs: ["Failed to delete field: field not found"]
      };
    }
    if (field.editing && field.editingBy !== userId) {
      return {
        success: false,
        error: "Field is being edited by another user",
        _logs: [
          `Failed to delete field ${field.name}: being edited by another user`
        ]
      };
    }
    await ctx.db.delete(args.fieldId);
    return { success: true, _logs: [`Field ${field.name} deleted`] };
  }
});

export const updateField = mutation({
  args: {
    fieldId: v.id("fields"),
    name: v.string(),
    type: v.union(
      v.literal("string"),
      v.literal("number"),
      v.literal("boolean"),
      v.literal("array"),
      v.literal("select"),
      v.literal("date"),
      v.literal("email"),
      v.literal("user"),
      v.literal("url"),
      v.literal("ip")
    ),
    required: v.boolean(),
    hidden: v.optional(v.boolean()),
    extra: v.optional(
      v.object({
        description: v.optional(v.string()),
        placeholder: v.optional(v.string()),
        regex: v.optional(v.string()),
        regexError: v.optional(v.string()),
        minLength: v.optional(v.number()),
        maxLength: v.optional(v.number()),
        minItems: v.optional(v.number()),
        maxItems: v.optional(v.number()),
        minValue: v.optional(v.number()),
        maxValue: v.optional(v.number()),
        icon: v.optional(v.string()),
        options: v.optional(v.array(v.string())),
        hideFromSearch: v.optional(v.boolean()),
        subnet: v.optional(v.string()),
        listObjectType: v.optional(v.string()),
        listObjectExtra: v.optional(
          v.object({
            regex: v.optional(v.string()),
            regexError: v.optional(v.string()),
            minLength: v.optional(v.number()),
            maxLength: v.optional(v.number()),
            minItems: v.optional(v.number()),
            maxItems: v.optional(v.number()),
            minValue: v.optional(v.number()),
            maxValue: v.optional(v.number())
          })
        )
      })
    )
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return {
        success: false,
        error: "Not authenticated"
      };
    }

    const field = await ctx.db.get(args.fieldId);
    if (!field) {
      return {
        success: false,
        error: "Field not found"
      };
    }

    if (!field.editing || field.editingBy !== userId) {
      return {
        success: false,
        error: "Field is not being edited by you",
        _logs: [`Failed to update field ${field.name}: not being edited by you`]
      };
    }

    await ctx.db.patch(args.fieldId, {
      name: args.name,
      type: args.type,
      required: args.required,
      hidden: args.hidden || false,
      extra: args.extra
    });
    return { success: true, _logs: [`Field ${field.name} saved`] };
  }
});

export const makePersistent = mutation({
  args: { fieldId: v.id("fields") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return {
        success: false,
        error: "Not authenticated",
        _logs: ["Failed to make field persistent: not authenticated"]
      };
    }
    const field = await ctx.db.get(args.fieldId);
    if (!field) {
      return {
        success: false,
        error: "Field not found",
        _logs: ["Failed to make field persistent: field not found"]
      };
    }
    if (field.persistent) {
      return {
        success: false,
        error: "Field is already persistent",
        _logs: [`Field ${field.name} is already persistent`]
      };
    }
    await ctx.db.patch(args.fieldId, { persistent: true });
    return { success: true, _logs: [`Field ${field.name} made persistent`] };
  }
});

export const releaseExpiredLocks = internalMutation({
  handler: async ctx => {
    const now = Date.now();
    const fields = await ctx.db
      .query("fields")
      .filter(f => f.gt(f.field("editingLockExpires"), now))
      .collect();
    await Promise.all(
      fields.map(f =>
        ctx.db.patch(f._id, {
          editing: false,
          editingBy: undefined,
          editingLockExpires: undefined
        })
      )
    );
  }
});
