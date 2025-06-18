"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { IconName, IconPicker } from "@/components/ui/icon-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OptionsInput } from "@/components/ui/options-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from "@/components/ui/tooltip";
import { FieldType } from "@/convex/fields";
import { ValueType } from "@/convex/schema";
import { useMaskito } from "@maskito/react";
import { WithoutSystemFields } from "convex/server";
import { motion } from "framer-motion";
import { Loader2Icon } from "lucide-react";
import { DynamicIcon } from "lucide-react/dynamic";
import { useCallback, useMemo, useState } from "react";
import { FIELD_TYPES, getExtrasForType } from "./consts";
import { ipv4CidrMaskOptions } from "./CIDRMasks";

type FieldFormProps = {
  idPrefix: string;
  values: WithoutSystemFields<Omit<FieldType, "slug">>;
  onChange: (key: string, value: ValueType) => void;
  lockField?: () => void;
  locked: boolean;
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
  isLockedBySomeoneElse: boolean;
  onDelete?: () => void;
};

export function FieldForm({
  idPrefix,
  values,
  onChange,
  lockField,
  locked,
  onSave,
  onCancel,
  isSaving,
  isLockedBySomeoneElse,
  onDelete
}: FieldFormProps) {
  const [pendingType, setPendingType] = useState<string | null>(null);
  const [fieldName, setFieldName] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const typeExtras = useMemo(
    () => getExtrasForType(values.type),
    [values.type]
  );
  const change = useCallback(
    (key: string, value: ValueType) => onChange(key, value),
    [onChange]
  );
  const subnetRef = useMaskito({ options: ipv4CidrMaskOptions });

  // TODO: client-side validation

  const formFields = useMemo(() => {
    return [
      {
        key: "name",
        node: (
          <div className="flex flex-col gap-1">
            <Label className="block text-xs font-medium">Name</Label>
            <Input
              value={values.name}
              onChange={e => change("name", e.target.value)}
              onFocus={lockField}
              disabled={isLockedBySomeoneElse}
            />
          </div>
        )
      },
      {
        key: "type",
        node: (
          <div className="relative flex flex-col gap-1">
            <Label className="block text-xs font-medium">Type</Label>
            <Select
              value={values.type}
              onValueChange={val => {
                const extras = getExtrasForType(values.type);
                const hasExtras = extras.some(k => {
                  const v = values.extra?.[k as keyof typeof values.extra];
                  return Array.isArray(v)
                    ? v.length > 0
                    : v != null && v !== "";
                });
                if (hasExtras) {
                  setPendingType(val);
                } else {
                  change("type", val);
                }
              }}
              disabled={isLockedBySomeoneElse || pendingType !== null}
            >
              <SelectTrigger className="w-full" onClick={lockField}>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {FIELD_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>
                    <DynamicIcon name={t.icon as IconName} />
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {pendingType && (
              <Alert className="absolute top-full -mt-2 -ml-3">
                <AlertTitle>Change type?</AlertTitle>
                <AlertDescription>
                  Changing the type will remove extra fields for the current
                  type.
                </AlertDescription>
                <div className="mt-2 flex space-x-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      change("type", pendingType);
                      setPendingType(null);
                    }}
                    variant="destructive"
                  >
                    Change
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPendingType(null)}
                  >
                    Cancel
                  </Button>
                </div>
              </Alert>
            )}
          </div>
        )
      },
      {
        key: "icon",
        node: (
          <div className="flex flex-col gap-1">
            <Label className="block text-xs font-medium">Icon</Label>
            <IconPicker
              value={(values.extra?.icon as IconName) || ""}
              onValueChange={v => change("icon", v)}
              onOpenChange={lockField}
              disabled={isLockedBySomeoneElse}
            />
          </div>
        )
      },
      {
        key: "description",
        node: (
          <div className="flex flex-col gap-1">
            <Label className="block text-xs font-medium">Description</Label>
            <Input
              value={values.extra?.description || ""}
              onChange={e => change("description", e.target.value)}
              onFocus={lockField}
              disabled={isLockedBySomeoneElse}
            />
          </div>
        )
      },
      ...(typeExtras.includes("placeholder")
        ? [
            {
              key: "placeholder",
              node: (
                <div className="flex flex-col gap-1">
                  <Label className="block text-xs font-medium">
                    Placeholder
                  </Label>
                  <Input
                    value={values.extra?.placeholder || ""}
                    onChange={e => change("placeholder", e.target.value)}
                    onFocus={lockField}
                    disabled={isLockedBySomeoneElse}
                  />
                </div>
              )
            }
          ]
        : []),
      ...(typeExtras.includes("regex")
        ? [
            {
              key: "regex",
              node: (
                <div className="flex flex-col gap-1">
                  <Label className="block text-xs font-medium">Regex</Label>
                  <Input
                    value={values.extra?.regex || ""}
                    onChange={e => change("regex", e.target.value)}
                    onFocus={lockField}
                    placeholder="^...$"
                    disabled={isLockedBySomeoneElse}
                  />
                </div>
              )
            }
          ]
        : []),
      ...(typeExtras.includes("regexError")
        ? [
            {
              key: "regexError",
              node: (
                <div className="flex flex-col gap-1">
                  <Label className="block text-xs font-medium">
                    Regex Error
                  </Label>
                  <Input
                    value={values.extra?.regexError || ""}
                    onChange={e => change("regexError", e.target.value)}
                    onFocus={lockField}
                    placeholder="Please enter a valid yara yara"
                    disabled={isLockedBySomeoneElse}
                  />
                </div>
              )
            }
          ]
        : []),
      ...(typeExtras.includes("minLength")
        ? [
            {
              key: "minLength",
              node: (
                <div className="flex flex-col gap-1">
                  <Label className="block text-xs font-medium">
                    Min Length
                  </Label>
                  <Input
                    type="number"
                    value={values.extra?.minLength ?? ""}
                    onChange={e =>
                      change(
                        "minLength",
                        e.target.value === ""
                          ? undefined
                          : Number(e.target.value)
                      )
                    }
                    onFocus={lockField}
                    disabled={isLockedBySomeoneElse}
                  />
                </div>
              )
            }
          ]
        : []),
      ...(typeExtras.includes("maxLength")
        ? [
            {
              key: "maxLength",
              node: (
                <div className="flex flex-col gap-1">
                  <Label className="block text-xs font-medium">
                    Max Length
                  </Label>
                  <Input
                    type="number"
                    value={values.extra?.maxLength ?? ""}
                    onChange={e =>
                      change(
                        "maxLength",
                        e.target.value === ""
                          ? undefined
                          : Number(e.target.value)
                      )
                    }
                    onFocus={lockField}
                    disabled={isLockedBySomeoneElse}
                  />
                </div>
              )
            }
          ]
        : []),
      ...(typeExtras.includes("minItems")
        ? [
            {
              key: "minItems",
              node: (
                <div className="flex flex-col gap-1">
                  <Label className="block text-xs font-medium">Min Items</Label>
                  <Input
                    type="number"
                    value={values.extra?.minItems ?? ""}
                    onChange={e =>
                      change(
                        "minItems",
                        e.target.value === ""
                          ? undefined
                          : Number(e.target.value)
                      )
                    }
                    onFocus={lockField}
                    disabled={isLockedBySomeoneElse}
                  />
                </div>
              )
            }
          ]
        : []),
      ...(typeExtras.includes("maxItems")
        ? [
            {
              key: "maxItems",
              node: (
                <div className="flex flex-col gap-1">
                  <Label className="block text-xs font-medium">Max Items</Label>
                  <Input
                    type="number"
                    value={values.extra?.maxItems ?? ""}
                    onChange={e =>
                      change(
                        "maxItems",
                        e.target.value === ""
                          ? undefined
                          : Number(e.target.value)
                      )
                    }
                    onFocus={lockField}
                    disabled={isLockedBySomeoneElse}
                  />
                </div>
              )
            }
          ]
        : []),
      ...(typeExtras.includes("listObjectType")
        ? [
            {
              key: "listObjectType",
              node: (
                <div className="flex flex-col gap-1">
                  <Label className="block text-xs font-medium">
                    List Object Type
                  </Label>
                  <Select
                    value={values.extra?.listObjectType || ""}
                    onValueChange={v => change("listObjectType", v)}
                    disabled={isLockedBySomeoneElse}
                  >
                    <SelectTrigger className="w-full" onClick={lockField}>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {FIELD_TYPES.filter(e =>
                        ["number", "string", "user", "email", "url"].includes(
                          e.value
                        )
                      ).map(t => (
                        <SelectItem key={t.value} value={t.value}>
                          <DynamicIcon name={t.icon as IconName} />
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )
            }
          ]
        : []),
      ...(typeExtras.includes("listObjectExtra") && values.extra?.listObjectType
        ? getExtrasForType(values.extra.listObjectType)
            .filter(
              k =>
                !["icon", "description", "options", "placeholder"].includes(k)
            )
            .map(extraKey => ({
              key: `listObjectExtra-${extraKey}`,
              node: (
                <div className="flex flex-col gap-1">
                  <Label className="block text-xs font-medium">
                    List Item{" "}
                    {(
                      {
                        placeholder: "Placeholder",
                        regex: "Regex",
                        regexError: "Regex Error",
                        minLength: "Min Length",
                        maxLength: "Max Length",
                        minItems: "Min Items",
                        maxItems: "Max Items",
                        minValue: "Min Value",
                        maxValue: "Max Value"
                      } as Record<string, string>
                    )[extraKey] || extraKey.replace(/([A-Z])/g, " $1").trim()}
                  </Label>
                  <Input
                    type={
                      [
                        "minValue",
                        "maxValue",
                        "minLength",
                        "maxLength",
                        "minItems",
                        "maxItems"
                      ].includes(extraKey)
                        ? "number"
                        : "text"
                    }
                    value={
                      values.extra?.listObjectExtra?.[
                        extraKey as keyof typeof values.extra.listObjectExtra
                      ] ?? ""
                    }
                    onChange={e =>
                      change(
                        `listObjectExtra.${extraKey}`,
                        e.target.value === ""
                          ? undefined
                          : /Value|Length|Items/.test(extraKey)
                            ? Number(e.target.value)
                            : e.target.value
                      )
                    }
                    onFocus={lockField}
                    disabled={isLockedBySomeoneElse}
                  />
                </div>
              )
            }))
        : []),
      ...(typeExtras.includes("minValue")
        ? [
            {
              key: "minValue",
              node: (
                <div className="flex flex-col gap-1">
                  <Label className="block text-xs font-medium">Min Value</Label>
                  <Input
                    type="number"
                    value={values.extra?.minValue ?? ""}
                    onChange={e =>
                      change(
                        "minValue",
                        e.target.value === ""
                          ? undefined
                          : Number(e.target.value)
                      )
                    }
                    onFocus={lockField}
                    disabled={isLockedBySomeoneElse}
                  />
                </div>
              )
            }
          ]
        : []),
      ...(typeExtras.includes("options")
        ? [
            {
              key: "options",
              node: (
                <div className="flex flex-col gap-1">
                  <Label className="block text-xs font-medium">Options</Label>
                  <OptionsInput
                    options={values.extra?.options || []}
                    onChange={opts => {
                      lockField?.();
                      change("options", opts);
                    }}
                    disabled={isLockedBySomeoneElse}
                  />
                </div>
              )
            }
          ]
        : []),
      ...(typeExtras.includes("maxValue")
        ? [
            {
              key: "maxValue",
              node: (
                <div className="flex flex-col gap-1">
                  <Label className="block text-xs font-medium">Max Value</Label>
                  <Input
                    type="number"
                    value={values.extra?.maxValue ?? ""}
                    onChange={e =>
                      change(
                        "maxValue",
                        e.target.value === ""
                          ? undefined
                          : Number(e.target.value)
                      )
                    }
                    onFocus={lockField}
                    disabled={isLockedBySomeoneElse}
                  />
                </div>
              )
            }
          ]
        : []),
      ...(typeExtras.includes("subnet")
        ? [
            {
              key: "subnet",
              node: (
                <div className="flex flex-col gap-1">
                  <Label className="block text-xs font-medium">Subnet</Label>
                  <Input
                    ref={subnetRef}
                    value={values.extra?.subnet || ""}
                    onChange={e => change("subnet", e.target.value)}
                    onFocus={lockField}
                    placeholder="0.0.0.0/0"
                    disabled={isLockedBySomeoneElse}
                  />
                </div>
              )
            }
          ]
        : []),
      {
        key: "hideFromSearch",
        node: (
          <div className="flex items-center gap-2">
            <Checkbox
              checked={!!values.extra?.hideFromSearch}
              onCheckedChange={checked => {
                lockField?.();
                change("hideFromSearch", !!checked);
              }}
              id={`hideFromSearch-${idPrefix}`}
              disabled={isLockedBySomeoneElse}
            />
            <Label
              htmlFor={`hideFromSearch-${idPrefix}`}
              className="text-xs font-medium"
            >
              Hide from search
            </Label>
          </div>
        ),
        full: true
      },
      {
        key: "required",
        node: (
          <div className="flex items-center gap-2">
            <Checkbox
              checked={!!values.required}
              onCheckedChange={checked => {
                lockField?.();
                change("required", !!checked);
              }}
              id={`required-${idPrefix}`}
              disabled={isLockedBySomeoneElse}
            />
            <Label
              htmlFor={`required-${idPrefix}`}
              className="text-xs font-medium"
            >
              Required
            </Label>
          </div>
        ),
        full: true
      },
      {
        key: "hidden",
        node: (
          <div className="flex items-center gap-2">
            <Checkbox
              checked={!!values.hidden}
              onCheckedChange={checked => {
                lockField?.();
                change("hidden", !!checked);
              }}
              id={`hidden-${idPrefix}`}
              disabled={isLockedBySomeoneElse}
            />
            <Label
              htmlFor={`hidden-${idPrefix}`}
              className="text-xs font-medium"
            >
              Hidden
            </Label>
          </div>
        ),
        full: true
      },
      {
        key: "actions",
        node: (
          <div className="col-span-full mt-4 flex gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    type="submit"
                    variant="default"
                    size="sm"
                    onClick={onSave}
                    disabled={
                      isLockedBySomeoneElse ||
                      !locked ||
                      isSaving ||
                      !values.name.trim() ||
                      !values.type.trim() ||
                      pendingType !== null ||
                      (values.type === "array" && !values.extra?.listObjectType)
                    }
                  >
                    {isSaving && <Loader2Icon className="animate-spin" />}
                    Save
                  </Button>
                </span>
              </TooltipTrigger>
              {!isSaving &&
                (!values.name.trim() ||
                  !values.type.trim() ||
                  pendingType !== null ||
                  (values.type === "array" &&
                    !values.extra?.listObjectType)) && (
                  <TooltipContent>
                    <p>
                      {values.name.trim() === "" && "Name is required."}
                      {values.type.trim() === "" && "Type is required."}
                      {pendingType !== null &&
                        "Pending type change must be resolved."}
                      {values.type === "array" &&
                        !values.extra?.listObjectType &&
                        "List Object Type is required for object type."}
                    </p>
                  </TooltipContent>
                )}
            </Tooltip>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onCancel}
              disabled={isSaving}
            >
              Cancel
            </Button>
            {onDelete && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={isLockedBySomeoneElse || isSaving}
                  >
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
                    <AlertDialogDescription>
                      Please enter <b>{values.name.toLowerCase()}</b> to confirm
                      deletion. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="mt-4">
                    <Input
                      placeholder="Enter field name"
                      onChange={e => setFieldName(e.target.value)}
                    />
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel asChild>
                      <Button variant="outline" onClick={() => {}}>
                        Cancel
                      </Button>
                    </AlertDialogCancel>
                    <Button
                      variant="destructive"
                      onClick={() => {
                        if (fieldName === values.name.toLowerCase()) {
                          setIsDeleting(true);
                          onDelete();
                          setIsDeleting(false);
                        }
                      }}
                      disabled={
                        isLockedBySomeoneElse ||
                        isSaving ||
                        fieldName.toLowerCase() !== values.name.toLowerCase() ||
                        isDeleting
                      }
                    >
                      {isDeleting && <Loader2Icon className="animate-spin" />}
                      Delete
                    </Button>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        ),
        full: true
      }
    ];
  }, [
    values,
    typeExtras,
    locked,
    isSaving,
    pendingType,
    idPrefix,
    lockField,
    change,
    onSave,
    onCancel,
    onDelete,
    fieldName,
    isDeleting,
    subnetRef,
    isLockedBySomeoneElse
  ]);

  return (
    <motion.form
      className="grid grid-cols-1 gap-4 px-2 md:grid-cols-2"
      onClick={e => e.stopPropagation()}
      onSubmit={e => e.preventDefault()}
      initial="collapsed"
      animate="open"
      exit="collapsed"
      variants={{
        open: { opacity: 1, height: "auto", marginTop: 16 },
        collapsed: { opacity: 0, height: 0, marginTop: 0 }
      }}
      transition={{
        opacity: {
          duration: formFields.length * 0.03 + 0.15,
          type: "spring",
          bounce: 0.2
        },
        height: { duration: 0.1, ease: "easeInOut" },
        marginTop: { duration: formFields.length * 0.03, ease: "easeInOut" }
      }}
      style={{ overflow: "hidden" }}
    >
      <motion.div
        className="contents"
        variants={{
          open: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } },
          collapsed: {
            transition: { staggerChildren: 0.03, staggerDirection: -1 }
          }
        }}
      >
        {formFields.map((f, idx) => (
          <motion.div
            key={f.key}
            className={f.full ? "col-span-full" : ""}
            initial={{ opacity: 0, y: 10 }}
            animate={{
              opacity: 1,
              y: 0,
              transition: { duration: 0.1, delay: idx * 0.03 }
            }}
            exit={{
              opacity: 0,
              y: 10,
              transition: {
                duration: 0.15,
                delay: (formFields.length - 1 - idx) * 0.03
              }
            }}
          >
            {f.node}
          </motion.div>
        ))}
      </motion.div>
    </motion.form>
  );
}
