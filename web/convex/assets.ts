import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { FieldType, ValueType } from "./schema";
import { validateFields } from "./utils";

export const getAll = query({
  handler: async ctx => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return {
        viewer: null,
        assets: []
      };
    }

    const assets = await ctx.db.query("assets").order("asc").collect();
    const editors = await Promise.all(
      assets.map(f =>
        f.editingBy ? ctx.db.get(f.editingBy) : Promise.resolve(null)
      )
    );

    return {
      viewer: userId,
      assets: assets.map((asset, i) => ({
        asset,
        editingBy: editors[i]
      }))
    };
  }
});

export const acquireLock = mutation({
  args: { id: v.id("assets") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null)
      return {
        success: false,
        error: "Not authenticated",
        _logs: ["Failed to acquire asset lock: not authenticated"]
      };

    const asset = await ctx.db.get(id);
    if (!asset)
      return {
        success: false,
        error: "Asset not found",
        _logs: ["Failed to acquire asset lock: asset not found"]
      };

    if (asset.editing && asset.editingBy !== userId) {
      return {
        success: false,
        error: "Asset is already being edited by another user",
        _logs: [`Failed to acquire asset lock: already being edited`]
      };
    }

    const otherLocks = await ctx.db
      .query("assets")
      .filter(a => a.eq(a.field("editingBy"), userId))
      .collect();

    await Promise.all(
      otherLocks.map(a =>
        ctx.db.patch(a._id, {
          editing: false,
          editingBy: undefined,
          editingLockExpires: undefined
        })
      )
    );

    const now = Date.now();
    const expiresAt = now + 60 * 1000;

    await ctx.db.patch(id, {
      editing: true,
      editingBy: userId,
      editingLockExpires: expiresAt
    });

    return { success: true, _logs: ["Asset lock acquired"] };
  }
});

export const releaseLock = mutation({
  args: { id: v.id("assets") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null)
      return {
        success: false,
        error: "Not authenticated",
        _logs: ["Failed to release asset lock: not authenticated"]
      };

    const asset = await ctx.db.get(id);
    if (!asset)
      return {
        success: false,
        error: "Asset not found",
        _logs: ["Failed to release asset lock: asset not found"]
      };

    if (!asset.editing || asset.editingBy !== userId) {
      return {
        success: false,
        error: "Asset is not being edited by you",
        _logs: [`Failed to release asset lock: not owned by caller`]
      };
    }

    await ctx.db.patch(id, {
      editing: false,
      editingBy: undefined,
      editingLockExpires: undefined
    });

    return { success: true, _logs: ["Asset lock released"] };
  }
});

export const renewLock = mutation({
  args: { id: v.id("assets") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null)
      return {
        success: false,
        error: "Not authenticated",
        _logs: ["Failed to renew asset lock: not authenticated"]
      };
    const asset = await ctx.db.get(id);
    if (!asset)
      return {
        success: false,
        error: "Asset not found",
        _logs: ["Failed to renew asset lock: asset not found"]
      };
    if (!asset.editing || asset.editingBy !== userId) {
      return {
        success: false,
        error: "Asset is not being edited by you",
        _logs: [`Failed to renew asset lock: not owned by caller`]
      };
    }
    const now = Date.now();
    const expiresAt = now + 60 * 1000;
    await ctx.db.patch(id, {
      editingLockExpires: expiresAt
    });
    return { success: true, _logs: ["Asset lock renewed"] };
  }
});

export const createAsset = mutation({
  args: {
    values: v.record(v.id("fields"), v.any())
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return {
        success: false,
        errors: { _: "Not authenticated" },
        _logs: ["Failed to create asset: not authenticated"]
      };
    }
    let fields: FieldType[];
    try {
      fields = await Promise.all(
        Object.entries(args.values).map(async ([fieldId]) => {
          const field = await ctx.db.get(fieldId as Id<"fields">);
          if (!field) {
            throw new Error(`Field with ID ${fieldId} not found`);
          }
          return field;
        })
      );
    } catch {
      return {
        success: false,
        errors: { _: "Unknown error" },
        _logs: ["Failed to fetch fields"]
      };
    }
    const metadata: Record<string, ValueType> = {};

    const errors = validateFields(fields, args.values);
    if (errors !== null) {
      return { success: false, errors };
    }

    const asset = {
      metadata,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      editing: false,
      editingBy: undefined,
      editingLockExpires: undefined
    };

    const assetId = await ctx.db.insert("assets", asset);
    return {
      success: true,
      assetId,
      _logs: ["Asset created successfully"]
    };
  }
});

export const updateAsset = mutation({
  args: {
    assetId: v.id("assets"),
    values: v.record(v.id("fields"), v.any())
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return {
        success: false,
        errors: { _: "Not authenticated" },
        _logs: ["Failed to update asset: not authenticated"]
      };
    }
    const asset = await ctx.db.get(args.assetId);
    if (!asset) {
      return {
        success: false,
        errors: { _: "Asset not found" },
        _logs: ["Failed to update asset: not found"]
      };
    }
    if (!asset.editing || asset.editingBy !== userId) {
      return {
        success: false,
        errors: { _: "Asset is not being edited by you" },
        _logs: [`Failed to update asset: not being edited by you`]
      };
    }
    const metadata = asset.metadata || {};
    let fields: FieldType[];
    try {
      fields = await Promise.all(
        Object.entries(args.values).map(async ([fieldId]) => {
          const field = await ctx.db.get(fieldId as Id<"fields">);
          if (!field) {
            throw new Error(`Field with ID ${fieldId} not found`);
          }
          return field;
        })
      );
    } catch {
      return {
        success: false,
        errors: { _: "Unknown error" },
        _logs: ["Failed to fetch fields"]
      };
    }

    const errors = validateFields(fields, args.values);
    if (errors !== null) {
      return { success: false, errors };
    }

    for (const [fieldId, value] of Object.entries(args.values)) {
      const field = fields.find(f => f._id === fieldId);
      if (field) {
        metadata[field._id] = value;
      }
    }

    await ctx.db.patch(args.assetId, {
      metadata,
      updatedAt: Date.now()
    });

    return { success: true, _logs: ["Asset updated successfully"] };
  }
});
