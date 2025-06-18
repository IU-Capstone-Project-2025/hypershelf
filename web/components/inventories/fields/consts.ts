export const FIELD_TYPES = [
  {
    value: "string",
    icon: "case-sensitive",
    label: "String",
    extras: ["placeholder", "regex", "regexError", "minLength", "maxLength"]
  },
  {
    value: "number",
    icon: "hash",
    label: "Number",
    extras: ["placeholder", "minValue", "maxValue"]
  },
  {
    value: "boolean",
    icon: "square-check",
    label: "Boolean",
    extras: []
  },
  {
    value: "array",
    icon: "brackets",
    label: "Array",
    extras: [
      "placeholder",
      "minItems",
      "maxItems",
      "listObjectType",
      "listObjectExtra"
    ]
  },
  { value: "select", icon: "list-todo", label: "Select", extras: ["options"] },
  { value: "date", icon: "calendar", label: "Date", extras: ["placeholder"] },
  { value: "email", icon: "at-sign", label: "Email", extras: ["placeholder"] },
  {
    value: "user",
    icon: "circle-user",
    label: "User",
    extras: ["placeholder"]
  },
  { value: "url", icon: "link-2", label: "URL", extras: ["placeholder"] },
  {
    value: "ip",
    icon: "ethernet-port",
    label: "IP Address",
    extras: ["placeholder", "subnet"]
  }
  // TODO: markdown field type
];

export const getExtrasForType = (type: string) =>
  FIELD_TYPES.find(t => t.value === type)?.extras ?? [];
