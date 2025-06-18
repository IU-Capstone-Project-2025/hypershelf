import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { Doc } from "./_generated/dataModel";

export default defineSchema({
  ...authTables,
  assets: defineTable({
    metadata: v.optional(v.record(v.id("fields"), v.any())),
    mutex: v.optional(v.boolean()),
    mutexHolderId: v.optional(v.id("users")),
    mutexExpiresAt: v.optional(v.number()),
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
    editing: v.optional(v.boolean()),
    editingBy: v.optional(v.id("users")),
    editingLockExpires: v.optional(v.number())
  }),
  fields: defineTable({
    name: v.string(),
    slug: v.string(),
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
    ),
    editing: v.optional(v.boolean()),
    editingBy: v.optional(v.id("users")),
    editingLockExpires: v.optional(v.number()),
    persistent: v.optional(v.boolean())
  })
});

export type AssetType = Doc<"assets">;
export type FieldType = Doc<"fields">;
export type UserType = Doc<"users">;
export type ValueType = string | number | boolean | undefined | string[];
