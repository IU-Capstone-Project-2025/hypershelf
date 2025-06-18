import { z, ZodError, ZodSchema, ZodTypeAny } from "zod";
import { FieldType } from "./schema";

type Extra = NonNullable<FieldType["extra"]>;
type FieldKind = FieldType["type"];

export const buildValuesSchema = (
  fields: FieldType[]
): ZodSchema<Record<string, unknown>> => {
  const shape: Record<string, ZodTypeAny> = {};

  for (const field of fields) {
    const { type, required = false, extra = {} } = field;

    let schema: ZodTypeAny;

    if (type === "array") {
      const itemSchema = buildPrimitiveSchema(
        extra.listObjectType ?? "string",
        extra.listObjectExtra || {}
      );

      schema = z.array(itemSchema);

      if (extra.minItems !== undefined && schema instanceof z.ZodArray)
        schema = schema.min(extra.minItems);
      if (extra.maxItems !== undefined && schema instanceof z.ZodArray)
        schema = schema.max(extra.maxItems);
    } else {
      schema = buildPrimitiveSchema(type, extra);
    }

    if (required) {
      schema = schema.refine(
        v =>
          !(typeof v === "string" && v.trim() === "") &&
          v !== undefined &&
          v !== null,
        "Field is required"
      );
    } else {
      schema = schema.optional();
    }

    shape[field._id] = schema;
  }

  return z.object(shape);
};

const ipInSubnet = (ip: string, subnet: string): boolean => {
  const ipToInt = (ip: string): number => {
    const parts = ip.split(".").map(Number);
    if (parts.length !== 4 || parts.some(p => p < 0 || p > 255))
      throw new Error("Invalid IP");
    return parts.reduce((acc, part) => (acc << 8) + part, 0);
  };

  const [subnetIp, prefixStr] = subnet.split("/");
  if (!prefixStr) throw new Error("Invalid subnet");
  const prefix = parseInt(prefixStr, 10);
  if (prefix < 0 || prefix > 32) throw new Error("Invalid subnet prefix");

  const ipInt = ipToInt(ip);
  const subnetInt = ipToInt(subnetIp);
  const mask = prefix === 0 ? 0 : 0xffffffff << (32 - prefix);

  return (ipInt & mask) === (subnetInt & mask);
};

const buildPrimitiveSchema = (
  kind: FieldKind | string,
  extra: Extra
): ZodTypeAny => {
  if (extra.options?.length)
    return z.enum([...extra.options] as [string, ...string[]]);

  let schema: ZodTypeAny;

  switch (kind) {
    case "number":
      schema = z.number();
      break;
    case "boolean":
      schema = z.boolean();
      break;
    case "email":
      schema = z.string().email("Invalid email");
      break;
    case "url":
      schema = z.string().url("Invalid URL");
      break;
    case "date":
      schema = z.preprocess(
        v => (typeof v === "string" || v instanceof Date ? new Date(v) : v),
        z.date()
      );
      break;
    case "ip":
      schema = z
        .string()
        .regex(
          /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(\/([1-2]?[0-9]|3[0-2]))?$/,
          "Invalid IP address"
        );
      if (extra.subnet) {
        schema = schema.refine(
          v => ipInSubnet(v, extra.subnet as string),
          `IP address must be in subnet ${extra.subnet}`
        );
      }
      break;

    default:
      schema = z.string();
  }

  if (schema instanceof z.ZodString) {
    if (extra.regex)
      schema = schema.regex(
        new RegExp(extra.regex),
        extra.regexError || "Value does not match the regex"
      );
    if (extra.minLength && schema instanceof z.ZodString)
      schema = schema.min(extra.minLength);
    if (extra.maxLength && schema instanceof z.ZodString)
      schema = schema.max(extra.maxLength);
  }

  if (schema instanceof z.ZodNumber) {
    if (extra.minValue !== undefined && schema instanceof z.ZodNumber)
      schema = schema.min(extra.minValue);
    if (extra.maxValue !== undefined && schema instanceof z.ZodNumber)
      schema = schema.max(extra.maxValue);
  }

  return schema;
};

export const validateFields = (
  fields: FieldType[],
  values: Record<string, unknown>
): Record<string, string> | null => {
  const schema = buildValuesSchema(fields);
  const errors: Record<string, string> = {};

  for (const fieldId of Object.keys(values)) {
    const field = fields.find(f => f._id === fieldId);
    if (!field) {
      errors[fieldId] = `Field with ID ${fieldId} not found`;
    }
  }

  if (Object.keys(errors).length > 0) {
    return errors;
  }

  try {
    schema.parse(values);
  } catch (err) {
    if (err instanceof ZodError) {
      for (const issue of err.issues) {
        if (issue.path.length === 1 && typeof issue.path[0] === "string") {
          const fieldId = issue.path[0];
          errors[fieldId] = issue.message;
        }
      }
    } else {
      throw err;
    }
  }

  if (Object.keys(errors).length > 0) {
    return errors;
  }

  return null;
};
