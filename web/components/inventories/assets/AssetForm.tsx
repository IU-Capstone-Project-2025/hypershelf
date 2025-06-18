"use client";

import { useLog } from "@/components/util/Log";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger
} from "@/components/ui/select";
import { TagInput } from "@/components/ui/tag-input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "@/components/ui/tooltip";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { FieldType } from "@/convex/fields";
import { AssetType, ValueType } from "@/convex/schema";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import { format } from "date-fns";
import { CalendarIcon, Check, ChevronsUpDown, Loader2Icon } from "lucide-react";
import { useEffect, useState } from "react";

interface AssetFormProps {
  open: boolean;
  asset: AssetType | null;
  fields: FieldType[];
  onClose: () => void;
}

export function AssetForm({ open, asset, fields, onClose }: AssetFormProps) {
  const ingestLogs = useLog();
  const updateAsset = useMutation(api.assets.updateAsset);
  const createAsset = useMutation(api.assets.createAsset);
  const [editedValues, setEditedValues] = useState<Record<string, ValueType>>(
    {}
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [openPopovers, setOpenPopovers] = useState<
    Record<Id<"fields">, boolean>
  >({});

  const users = useQuery(api.users.getAll) ?? [];

  useEffect(() => {
    setEditedValues(
      fields.reduce<Record<string, ValueType>>((acc, { _id, name }) => {
        const id = _id ?? (typeof name === "string" ? name : "");
        acc[id] = asset?.metadata?.[id];
        return acc;
      }, {})
    );
    setErrors({});
  }, [asset, fields]);

  // TODO: client-side validation

  const handleFieldChange = (fieldId: string, value: ValueType) =>
    setEditedValues(prev => ({ ...prev, [fieldId]: value }));

  const handleSave = async () => {
    setIsLoading(true);
    try {
      if (asset) {
        const res = await updateAsset({
          assetId: asset._id,
          values: editedValues
        });
        ingestLogs(res);
        if (res.success) {
          onClose();
        } else {
          setErrors(res.errors ?? { _: "Unknown error" });
        }
      } else {
        const res = await createAsset({ values: editedValues });
        ingestLogs(res);
        if (res.success) {
          onClose();
        } else {
          setErrors(res.errors ?? { _: "Unknown error" });
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="!max-w-[90vw]">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {asset ? "Edit Asset" : "Create Asset"}
          </AlertDialogTitle>
        </AlertDialogHeader>
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 py-4">
          {fields.map(field => {
            const fieldId = field._id;
            const value = editedValues[fieldId];
            const label = typeof field.name === "string" ? field.name : fieldId;

            let input;
            if (field.type === "boolean") {
              input = (
                <Checkbox
                  id={fieldId}
                  checked={!!value}
                  onCheckedChange={v => handleFieldChange(fieldId, v)}
                  aria-invalid={!!errors[fieldId]}
                />
              );
            } else if (field.type === "select") {
              input = (
                <Select
                  value={(value as string) ?? ""}
                  onValueChange={v => handleFieldChange(fieldId, v)}
                >
                  <SelectTrigger
                    className={cn("col-span-3", {
                      "border-destructive": !!errors[fieldId]
                    })}
                  >
                    {value ? String(value) : "Select an option"}
                  </SelectTrigger>
                  <SelectContent>
                    {field.extra?.options?.map(option => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              );
            } else if (field.type === "array") {
              input = (
                <TagInput
                  tags={Array.isArray(value) ? value : []}
                  setTags={t => handleFieldChange(fieldId, t)}
                  placeholder={field.extra?.placeholder || "Add items..."}
                  className={cn("col-span-3", {
                    "border-destructive": !!errors[fieldId]
                  })}
                  draggable
                  validateTag={(tag: string) => {
                    if (field.extra?.listObjectType) {
                      if (
                        field.extra.listObjectType === "number" &&
                        isNaN(Number(tag))
                      )
                        return false;
                      if (
                        field.extra.listObjectType === "string" &&
                        field.extra.listObjectExtra?.regex &&
                        !new RegExp(field.extra.listObjectExtra.regex).test(tag)
                      )
                        return false;
                      if (
                        field.extra.listObjectType === "string" &&
                        field.extra.listObjectExtra?.minLength &&
                        tag.length < field.extra.listObjectExtra.minLength
                      )
                        return false;
                      if (
                        field.extra.listObjectType === "string" &&
                        field.extra.listObjectExtra?.maxLength &&
                        tag.length > field.extra.listObjectExtra.maxLength
                      )
                        return false;
                      if (
                        field.extra.listObjectType === "number" &&
                        field.extra.listObjectExtra?.minValue !== undefined &&
                        Number(tag) < field.extra.listObjectExtra.minValue
                      )
                        return false;
                      if (
                        field.extra.listObjectType === "number" &&
                        field.extra.listObjectExtra?.maxValue !== undefined &&
                        Number(tag) > field.extra.listObjectExtra.maxValue
                      )
                        return false;
                    }
                    return true;
                  }}
                />
              );
            } else if (field.type === "date") {
              input = (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      data-empty={!value}
                      className={cn(
                        "data-[empty=true]:text-muted-foreground col-span-3 text-left font-normal",
                        {
                          "border-destructive": !!errors[fieldId]
                        }
                      )}
                    >
                      <CalendarIcon />
                      {value ? (
                        format(value as string, "PPP")
                      ) : (
                        <span>{field.extra?.placeholder || "Pick a date"}</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={value ? new Date(value as string) : undefined}
                      onSelect={val =>
                        handleFieldChange(fieldId, val?.toISOString() || "")
                      }
                      captionLayout="dropdown"
                    />
                  </PopoverContent>
                </Popover>
              );
            } else if (field.type === "user") {
              if (users === undefined) {
                input = (
                  <Input id={fieldId} placeholder="Loading users..." disabled />
                );
              } else {
                input = (
                  <Popover
                    open={openPopovers[field._id]}
                    onOpenChange={() =>
                      setOpenPopovers(prev => ({
                        ...prev,
                        [field._id]: !prev[field._id]
                      }))
                    }
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="col-span-3 justify-between"
                      >
                        {value
                          ? users.find(user => user.id === value)?.email
                          : field.extra?.placeholder || "Select a user"}
                        <ChevronsUpDown className="opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="p-0">
                      <Command>
                        <CommandInput
                          placeholder="Search users..."
                          className="h-9"
                        />
                        <CommandList>
                          <CommandEmpty>No users found.</CommandEmpty>
                          <CommandGroup>
                            {users.map(user => (
                              <CommandItem
                                key={user.id}
                                value={user.id}
                                keywords={[
                                  ...(user.email ? [user.email] : []),
                                  ...(user.name ? [user.name] : [])
                                ]}
                                onSelect={currentValue => {
                                  handleFieldChange(fieldId, currentValue);
                                  setOpenPopovers(prev => ({
                                    ...prev,
                                    [field._id]: false
                                  }));
                                }}
                              >
                                {user.email}
                                <Check
                                  className={cn(
                                    "ml-auto",
                                    value === user.id
                                      ? "opacity-100"
                                      : "opacity-0"
                                  )}
                                />
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                );
              }
            } else {
              input = (
                <Input
                  id={fieldId}
                  type={
                    ["number", "email", "url"].includes(field.type)
                      ? field.type
                      : "text"
                  }
                  className={cn("col-span-3", {
                    "border-destructive": !!errors[fieldId]
                  })}
                  value={String(value ?? "")}
                  onChange={e =>
                    handleFieldChange(
                      fieldId,
                      field.type === "number"
                        ? Number(e.target.value)
                        : e.target.value
                    )
                  }
                  aria-invalid={!!errors[fieldId]}
                />
              );
            }

            return (
              <div
                key={fieldId}
                className="grid grid-cols-4 items-center gap-4"
              >
                <Label htmlFor={fieldId} className="text-right">
                  {label}
                </Label>
                <TooltipProvider>
                  <Tooltip open={!!errors[fieldId]}>
                    <TooltipTrigger asChild>{input}</TooltipTrigger>
                    <TooltipContent side="right">
                      {errors[fieldId]}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            );
          })}
        </div>

        {errors._ && <div className="text-sm text-red-500">{errors._}</div>}

        <AlertDialogFooter>
          <Button variant="outline" onClick={onClose} size="sm">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading} size="sm">
            {isLoading && <Loader2Icon className="animate-spin" />}
            Save
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
