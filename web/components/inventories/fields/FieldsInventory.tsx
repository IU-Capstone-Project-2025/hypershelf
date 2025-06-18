"use client";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { GlobalKeySequenceListener } from "@/components/util/GlobalKeySequenceListener";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { FieldType } from "@/convex/fields";
import { ValueType } from "@/convex/schema";
import { cn } from "@/lib/utils";
import {
  AlertDialogCancel,
  AlertDialogTrigger
} from "@radix-ui/react-alert-dialog";
import { useMutation, useQuery } from "convex/react";
import { WithoutSystemFields } from "convex/server";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Loader2, Lock, Plus } from "lucide-react";
import { DynamicIcon, IconName } from "lucide-react/dynamic";
import { useEffect, useState } from "react";
import { useLog } from "../../util/Log";
import { Debugger } from "../Debugger";
import { useLock } from "../useLock";
import { FieldForm } from "./FieldForm";
import { Skeleton } from "@/components/ui/skeleton";

const defaultNewField: WithoutSystemFields<Omit<FieldType, "slug">> = {
  name: "",
  type: "string",
  required: false,
  extra: {}
};

export function FieldsInventory() {
  const ingestLogs = useLog();
  const { fields, viewer } = useQuery(api.fields.getAll) ?? { fields: [] };
  const createField = useMutation(api.fields.createField);
  const updateField = useMutation(api.fields.updateField);
  const deleteField = useMutation(api.fields.deleteField);
  const makePerstent = useMutation(api.fields.makePersistent);

  const [expandedFieldId, setExpandedFieldId] = useState<
    Id<"fields"> | "new" | null
  >(null);
  const [editValues, setEditValues] = useState<WithoutSystemFields<
    Omit<FieldType, "slug">
  > | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDebug, setIsDebug] = useState(false);
  const [isConfirmLock, setIsConfirmLock] = useState(false);
  const [isLocking, setIsLocking] = useState(false);
  const [lockTimeout, setLockTimeout] = useState(0);

  const { lockedId, acquireLock, releaseLock } = useLock<"fields">(
    api.fields.acquireLock,
    api.fields.renewLock,
    api.fields.releaseLock,
    ingestLogs,
    30000,
    30
  );

  const handleExpand = (field: FieldType) => {
    if (field._id === expandedFieldId && lockedId) return;
    if (field.editing && field.editingBy !== viewer) return;
    if (expandedFieldId && lockedId) releaseLock();
    if (expandedFieldId === field._id) {
      setExpandedFieldId(null);
      setEditValues(null);
      return;
    }
    setExpandedFieldId(field._id);
    setEditValues(field);
  };

  const lockField = () => {
    if (expandedFieldId && expandedFieldId !== "new" && !lockedId) {
      acquireLock(expandedFieldId);
    }
  };

  const handleChange = (key: string, value: ValueType) => {
    setEditValues(prev => {
      if (!prev) return prev;
      const [parent, child] = key.split(".");
      if (child) {
        return {
          ...prev,
          extra: {
            ...prev.extra,
            [parent]: {
              ...((prev.extra?.[parent as keyof typeof prev.extra] as object) ||
                {}),
              [child]: value
            }
          }
        };
      }
      const isExtra = !["name", "type", "required", "hidden"].includes(parent);
      console.log(isExtra);
      return isExtra
        ? { ...prev, extra: { ...prev.extra, [key]: value } }
        : { ...prev, [key]: value };
    }) as void;
  };

  const handleSave = async (fieldId: Id<"fields">) => {
    if (!editValues) return;
    setIsSaving(true);
    try {
      const res = await updateField({
        fieldId,
        name: editValues.name,
        type: editValues.type,
        required: editValues.required,
        extra: editValues.extra || {},
        hidden: editValues.hidden || false
      });
      ingestLogs(res);
      if (res.success) {
        releaseLock();
        setExpandedFieldId(null);
        setEditValues(null);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateClick = () => {
    setEditValues(defaultNewField);
    setExpandedFieldId("new");
  };

  const handleCreateSave = async () => {
    if (!editValues) return;
    setIsSaving(true);
    try {
      const res = await createField({
        name: editValues.name,
        type: editValues.type,
        required: editValues.required,
        extra: editValues.extra || {},
        hidden: editValues.hidden || false
      });
      ingestLogs(res);
      if (res.success && res.fieldId) {
        setExpandedFieldId(null);
        setEditValues(null);
      }
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (lockTimeout > 0) {
      const timer = setTimeout(() => {
        setLockTimeout(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [lockTimeout]);

  if (!fields)
    return (
      <div className="mx-auto w-full max-w-2xl pb-8">
        <div className="flex flex-col gap-4 px-4 pt-6">
          <h1 className="font-title relative mb-2 text-2xl font-extrabold">
            Fields Management
            <div className="bg-brand absolute bottom-0 left-0 h-1 w-6"></div>
          </h1>
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="mb-4 h-19.5 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );

  return (
    <div className="mx-auto w-full max-w-2xl pb-8">
      <Debugger
        data={
          (expandedFieldId &&
            fields.find(f => f.field._id === expandedFieldId)?.field) ||
          fields
        }
        open={isDebug}
        setIsOpen={setIsDebug}
        rootName={
          (expandedFieldId &&
            `Field <${fields.find(f => f.field._id === expandedFieldId)?.field.name}>`) ||
          "Fields"
        }
        defaultExpanded={
          !!(
            expandedFieldId && fields.find(f => f.field._id === expandedFieldId)
          )
        }
      >
        {expandedFieldId &&
          fields.find(f => f.field._id === expandedFieldId) &&
          !(
            expandedFieldId &&
            fields.find(f => f.field._id === expandedFieldId)?.field.persistent
          ) && (
            <AlertDialog open={isConfirmLock} onOpenChange={setIsConfirmLock}>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  onClick={() => {
                    setLockTimeout(3);
                  }}
                >
                  <Lock />
                  Lock Field
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-2xl">
                    Lock Field
                  </AlertDialogTitle>
                </AlertDialogHeader>
                <p className="text-sm">
                  Locking this field will prevent it from deletion.
                </p>
                <p className="text-destructive text-sm font-bold">
                  This action cannot be undone. Are you sure you want to lock
                  this field?
                </p>
                <AlertDialogFooter>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      setIsLocking(true);
                      makePerstent({
                        fieldId: expandedFieldId as Id<"fields">
                      });
                      setIsLocking(false);
                      setIsConfirmLock(false);
                    }}
                    disabled={isLocking || lockTimeout > 0}
                    className={cn(lockTimeout > 0 && "cursor-not-allowed")}
                  >
                    {lockTimeout > 0 ? (
                      <span>
                        {lockTimeout}
                        &nbsp;
                      </span>
                    ) : isLocking ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <Lock />
                    )}
                    Lock Field
                  </Button>
                  <AlertDialogCancel asChild>
                    <Button variant="secondary">Cancel</Button>
                  </AlertDialogCancel>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
      </Debugger>
      <GlobalKeySequenceListener onMatch={() => setIsDebug(true)} />
      <div className="flex flex-col gap-4 px-4 pt-6">
        <h1 className="font-title relative mb-2 text-2xl font-extrabold">
          Fields Management
          <div className="bg-brand absolute bottom-0 left-0 h-1 w-6"></div>
        </h1>

        {expandedFieldId === "new" && (
          <AlertDialog open={expandedFieldId === "new"} onOpenChange={() => {}}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="font-title relative text-left text-2xl font-extrabold">
                  New Field
                  <div className="bg-brand absolute bottom-0 left-0 h-1 w-8"></div>
                </AlertDialogTitle>
              </AlertDialogHeader>
              <FieldForm
                idPrefix="new"
                values={editValues!}
                onChange={handleChange}
                lockField={() => {}}
                locked={true}
                onSave={handleCreateSave}
                onCancel={() => setExpandedFieldId(null)}
                isSaving={isSaving}
                isLockedBySomeoneElse={false}
              />
            </AlertDialogContent>
          </AlertDialog>
        )}

        {fields.map(({ field, editingBy }) => {
          const isExpanded = expandedFieldId === field._id;
          const values = isExpanded ? editValues! : field;
          return (
            <motion.div
              key={field._id}
              initial={false}
              animate={{
                boxShadow: isExpanded
                  ? "0 8px 32px rgba(0,0,0,0.25)"
                  : "0 1px 4px rgba(0,0,0,0.10)"
              }}
              className={cn(
                "relative rounded-lg border bg-black p-4 shadow-sm transition-all",
                {
                  "shadow-lg": isExpanded,
                  "border-brand border-2": field.editing && editingBy !== viewer
                }
              )}
            >
              {field.editing && editingBy !== viewer && (
                <div className="bg-brand text-background absolute top-0 right-0 -translate-y-full rounded-sm px-2 py-0.5 text-xs">
                  <span className="font-semibold">{editingBy?.email}</span>
                </div>
              )}
              <div
                className={cn("flex items-center", {
                  "cursor-pointer": !field.editing || editingBy === viewer,
                  "cursor-not-allowed": field.editing && editingBy !== viewer
                })}
                onClick={() => handleExpand(field)}
              >
                <span className="mr-3 text-2xl">
                  <DynamicIcon
                    name={(values.extra?.icon as IconName) || "circle"}
                  />
                </span>
                <div className="flex-1">
                  <div className="font-semibold">{field.name}</div>
                  <div className="text-muted-foreground text-sm">
                    {field.extra?.description}
                  </div>
                </div>
                <Button variant="ghost" size="icon">
                  <ChevronDown
                    className={cn(
                      "transition-transform",
                      isExpanded ? "rotate-180" : "rotate-0"
                    )}
                  />
                </Button>
              </div>
              <AnimatePresence initial={false}>
                {isExpanded && (
                  <FieldForm
                    idPrefix={field._id}
                    values={editValues!}
                    onChange={handleChange}
                    lockField={lockField}
                    locked={!!lockedId}
                    onSave={() => handleSave(field._id)}
                    onCancel={() => {
                      releaseLock();
                      setExpandedFieldId(null);
                      setEditValues(null);
                    }}
                    isSaving={isSaving}
                    onDelete={
                      field.persistent
                        ? undefined
                        : () => deleteField({ fieldId: field._id })
                    }
                    isLockedBySomeoneElse={
                      (field.editing && field.editingBy !== viewer) || false
                    }
                  />
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}

        <div className="flex">
          <Button
            variant="outline"
            className="w-full"
            onClick={handleCreateClick}
          >
            <Plus />
            Add Field
          </Button>
        </div>
      </div>
    </div>
  );
}
