"use client";

import { useHeaderContent } from "@/components/util/HeaderContext";
import { useLog } from "@/components/util/Log";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from "@/components/ui/tooltip";
import { api } from "@/convex/_generated/api";
import { FieldType } from "@/convex/fields";
import { AssetType, UserType, ValueType } from "@/convex/schema";
import { cn } from "@/lib/utils";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
  VisibilityState
} from "@tanstack/react-table";
import { useQuery } from "convex/react";
import { format } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDown,
  ArrowUpDown,
  ChevronDown,
  CircleCheck,
  CirclePlus,
  MoreHorizontal,
  Pencil,
  Search,
  TriangleAlert
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLock } from "../useLock";
import { AssetForm } from "./AssetForm";
import { Debugger } from "../Debugger";
import { GlobalKeySequenceListener } from "@/components/util/GlobalKeySequenceListener";
import { FunctionReturnType, WithoutSystemFields } from "convex/server";
import { Skeleton } from "@/components/ui/skeleton";

function Unset({ required }: { required?: boolean }) {
  return (
    <Tooltip>
      <TooltipTrigger>
        <div
          className={cn(
            "select-none",
            required
              ? "rounded-md bg-red-500 px-4 py-0.5 font-bold text-white"
              : "text-muted-foreground/50 italic"
          )}
        >
          unset
        </div>
      </TooltipTrigger>
      {required && (
        <TooltipContent>
          This field is required and must be filled out.
        </TooltipContent>
      )}
    </Tooltip>
  );
}

export function renderField(
  field: WithoutSystemFields<Omit<FieldType, "slug">>,
  value: ValueType,
  users: FunctionReturnType<typeof api.users.getAll>,
  checkmarkClassname?: string
) {
  if (field.type === "boolean")
    return value ? (
      <CircleCheck
        className={cn("size-5 text-green-500", checkmarkClassname)}
      />
    ) : (
      <CirclePlus
        className={cn("size-5 rotate-45 text-red-500", checkmarkClassname)}
      />
    );

  if (field.type === "user" && value) {
    const user = users.find(u => u.id === value);
    return user?.email;
  }

  if (field.type === "date" && value) {
    return format(new Date(value as string), "PPP");
  }

  if (
    value == null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  )
    return <Unset required={field.required} />;

  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

export function AssetsInventory() {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});
  const [globalFilter, setGlobalFilter] = useState("");
  const [editingAsset, setEditingAsset] = useState<AssetType | null>(null);
  const [showSearchInput, setShowSearchInput] = useState(false);
  const [isDebug, setIsDebug] = useState(false);

  const headerRef = useRef<HTMLTableRowElement>(null);

  const ingestLogs = useLog();
  const { viewer, assets } = useQuery(api.assets.getAll) ?? {};
  const { fields } = useQuery(api.fields.getAll) ?? {};
  const users = useQuery(api.users.getAll) ?? [];

  const formFields = useMemo(() => fields?.map(f => f.field) ?? [], [fields]);
  const flawedRows = useMemo(() => {
    if (!assets) return [];
    return assets
      .filter(asset => {
        return formFields.some(field => {
          const value = asset.asset.metadata?.[field._id];
          return (
            field.required &&
            field.type !== "boolean" &&
            (value === null ||
              value === undefined ||
              value === "" ||
              (Array.isArray(value) && value.length === 0))
          );
        });
      })
      .map(asset => asset.asset._id);
  }, [assets, formFields]);

  const { acquireLock, releaseLock } = useLock<"assets">(
    api.assets.acquireLock,
    api.assets.renewLock,
    api.assets.releaseLock,
    ingestLogs,
    30000,
    30
  );

  const startEditing = useCallback(
    (asset: AssetType) => {
      if (editingAsset) releaseLock();
      acquireLock(asset._id);
      setEditingAsset(asset);
    },
    [editingAsset, acquireLock, releaseLock]
  );

  const { setContent: setHeaderContent } = useHeaderContent();

  function buildColumns(
    fields: FieldType[],
    startEditing: (asset: AssetType) => void,
    viewer: string | null | undefined
  ): ColumnDef<{ asset: AssetType; editingBy: UserType | null }>[] {
    // TODO: live fields validation
    const columns: ColumnDef<{
      asset: AssetType;
      editingBy: UserType | null;
    }>[] = [
      {
        id: "edit",
        header: () => (
          <>
            <div className="border-border absolute top-0 right-0 bottom-0 left-0 -z-10 m-[-1px] rounded-md border bg-black/40 backdrop-blur-2xl transition-all duration-150" />
            <div className="flex items-center">
              <AnimatePresence>
                {showSearchInput && (
                  <motion.div
                    key="search-input"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ type: "spring", stiffness: 300, damping: 15 }}
                    className="absolute top-full left-0 mt-1"
                  >
                    <Input
                      placeholder="Search assets..."
                      value={globalFilter}
                      onChange={event => setGlobalFilter(event.target.value)}
                      onBlur={() => !globalFilter && setShowSearchInput(false)}
                      onKeyUp={event => {
                        if (
                          (event.key === "Enter" || event.key === "Escape") &&
                          !globalFilter
                        ) {
                          event.preventDefault();
                          setShowSearchInput(false);
                        }
                      }}
                      className="!border-border !h-8 max-w-sm !bg-black/40 !text-xs !ring-0 backdrop-blur-2xl"
                      autoComplete="off"
                      autoFocus={true}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowSearchInput(prev => !prev)}
                className="size-5"
              >
                <Search className="size-4" />
              </Button>
            </div>
          </>
        ),
        cell: ({ row }) => (
          <>
            {flawedRows.includes(row.original.asset._id) && (
              <TriangleAlert className="absolute top-0.5 left-0.5 size-2.5 text-red-500" />
            )}
            {row.original.asset.editing && (
              <div className="bg-brand text-background absolute top-0 left-0 rounded-sm px-2 py-0 text-[0.6rem]">
                <span className="font-semibold">
                  {row.original.editingBy?.email || "Unknown"}
                </span>
              </div>
            )}
            {(!row.original.asset.editing ||
              row.original.editingBy?._id === viewer) && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => startEditing(row.original.asset)}
                className="size-7"
              >
                <Pencil className="size-4" />
              </Button>
            )}
          </>
        ),
        enableSorting: false,
        enableHiding: false
      },
      {
        id: "createdAt",
        accessorFn: ({ asset }) => asset.createdAt,
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => column.toggleSorting()}
          >
            Created At
            {column.getIsSorted() ? (
              <ArrowDown
                className={cn(
                  "ml-2 h-4 w-4 transition-transform duration-200 ease-in-out",
                  column.getIsSorted() === "desc" ? "rotate-180" : ""
                )}
              />
            ) : (
              <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />
            )}
          </Button>
        ),
        cell: ({ row }) => {
          const v = row.getValue("createdAt") as number | undefined;
          return v ? new Date(v).toLocaleString() : <Unset />;
        },
        enableSorting: true
      },
      {
        id: "updatedAt",
        accessorFn: ({ asset }) => asset.updatedAt,
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => column.toggleSorting()}
          >
            Updated At
            {column.getIsSorted() ? (
              <ArrowDown
                className={cn(
                  "ml-2 h-4 w-4 transition-transform duration-200 ease-in-out",
                  column.getIsSorted() === "desc" ? "rotate-180" : ""
                )}
              />
            ) : (
              <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />
            )}
          </Button>
        ),
        cell: ({ row }) => {
          const v = row.getValue("updatedAt") as number | undefined;
          return v ? new Date(v).toLocaleString() : <Unset />;
        },
        enableSorting: true
      },
      {
        id: "actions",
        enableHiding: false,
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                View details ({row.original.asset._id})
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      }
    ];

    const dynamicCols = fields
      .filter(f => !f.hidden)
      .map(f => {
        const isHidden = f.extra?.hideFromSearch === true;
        return {
          id: f.slug,
          accessorFn: ({ asset }) => asset.metadata?.[f._id] ?? null,
          header: ({ column }) =>
            typeof f.name === "string" ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => column.toggleSorting()}
                className={cn(
                  "!h-auto py-0.5",
                  !column.getCanSort() ? "cursor-default !bg-transparent" : ""
                )}
              >
                {f.name}
                {column.getCanSort() &&
                  (column.getIsSorted() ? (
                    <ArrowDown
                      className={cn(
                        "ml-2 h-4 w-4 transition-transform duration-200 ease-in-out",
                        column.getIsSorted() === "desc" ? "rotate-180" : ""
                      )}
                    />
                  ) : (
                    <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />
                  ))}
              </Button>
            ) : (
              f.slug
            ),
          cell: ({ row }) => {
            const val = row.getValue(f.slug) as ValueType | undefined;
            return renderField(f, val, users);
          },
          enableHiding: !isHidden,
          enableSorting: ["string", "number", "boolean", "select"].includes(
            f.type
          )
        } satisfies ColumnDef<{ asset: AssetType; editingBy: UserType | null }>;
      });

    columns.splice(1, 0, ...dynamicCols);
    return columns;
  }

  const table = useReactTable<{ asset: AssetType; editingBy: UserType | null }>(
    {
      data: assets ?? [],
      columns: buildColumns(formFields, startEditing, viewer),
      onSortingChange: setSorting,
      getCoreRowModel: getCoreRowModel(),
      getPaginationRowModel: getPaginationRowModel(),
      getSortedRowModel: getSortedRowModel(),
      getFilteredRowModel: getFilteredRowModel(),
      onColumnVisibilityChange: setColumnVisibility,
      onRowSelectionChange: setRowSelection,
      manualPagination: true,
      state: {
        sorting,
        columnVisibility,
        rowSelection,
        globalFilter
      }
    }
  );

  useEffect(() => {
    // TODO: actual views logic
    setHeaderContent(
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="!h-auto py-0 text-xs !ring-0 hover:!bg-transparent"
          >
            Developers <ChevronDown />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent></DropdownMenuContent>
      </DropdownMenu>
    );
    return () => setHeaderContent(null);
  }, [setHeaderContent]);

  if (viewer === undefined || assets === undefined) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {Array.from({ length: 10 }).map((_, index) => (
                <TableHead key={index}>
                  <Skeleton className="h-4 w-26 rounded" />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 10 }).map((_, rowIndex) => (
              <TableRow key={rowIndex}>
                {Array.from({ length: 10 }).map((_, cellIndex) => (
                  <TableCell key={cellIndex}>
                    <Skeleton className="h-4 w-full rounded" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <>
      <div className="w-fit">
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map(headerGroup => (
                <TableRow
                  key={headerGroup.id}
                  className="sticky top-11 z-50 h-8"
                  ref={headerRef}
                >
                  {headerGroup.headers.map(header => (
                    <TableHead key={header.id} className="!h-auto">
                      <div className="flex items-center justify-center">
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map(row => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className={cn("relative", {
                      "inset-ring-brand rounded-md inset-ring-2":
                        row.original.asset.editing,
                      "bg-red-500/20 hover:!bg-red-500/30": flawedRows.includes(
                        row.original.asset._id
                      )
                    })}
                  >
                    {row.getVisibleCells().map(cell => (
                      <TableCell key={cell.id} className="px-2">
                        <div className="flex items-center justify-center">
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </div>
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell className="h-24 text-center">
                    No results.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <AssetForm
        open={!!editingAsset}
        asset={editingAsset}
        fields={formFields}
        onClose={() => {
          setEditingAsset(null);
          releaseLock();
        }}
      />

      <Debugger
        data={editingAsset || assets}
        open={isDebug}
        setIsOpen={setIsDebug}
        rootName={editingAsset ? `Asset <${editingAsset._id}>` : "Assets"}
        defaultExpanded={!!editingAsset}
      />
      <GlobalKeySequenceListener onMatch={() => setIsDebug(true)} />
    </>
  );
}
