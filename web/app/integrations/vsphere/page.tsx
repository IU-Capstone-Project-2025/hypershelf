"use client";

import { renderField } from "@/components/inventories/assets/AssetsInventory";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { CloudOff, ShieldAlert } from "lucide-react";
import { DynamicIcon, IconName } from "lucide-react/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";
import { useLoading } from "@/components/util/LoadingContext";

export default function VSphereIntegrationPage() {
  const searchParams = useSearchParams();
  const dns = searchParams.get("dns");

  const assets = useQuery(api.assets.getAll);
  const fields = useQuery(api.fields.getAll);
  const users = useQuery(api.users.getAll);

  const router = useRouter();

  const { setIsLoading } = useLoading();

  const fieldMappings = useMemo(() => {
    if (!fields) return { hostname: null, ip: null } as const;
    const hostnameField = fields.fields.find(f => f.field.slug === "hostname");
    const ipField = fields.fields.find(f => f.field.slug === "ip");
    return {
      hostname: hostnameField ? hostnameField.field._id : null,
      ip: ipField ? ipField.field._id : null
    } as const;
  }, [fields]);

  const asset = useMemo(() => {
    if (!assets) return null;
    return assets.assets.find(a => {
      if (!a.asset.metadata || !fieldMappings.hostname || !fieldMappings.ip)
        return false;
      return a.asset.metadata[fieldMappings.hostname] === dns;
    });
  }, [assets, dns, fieldMappings]);

  useEffect(() => {
    window.parent.postMessage(
      {
        type: "HYPERSHELF",
        action: "UPDATE_HEIGHT",
        data: {
          height: asset ? 250 : 100
        }
      },
      "*"
    );

    if (asset) {
      window.parent.postMessage(
        {
          type: "HYPERSHELF",
          action: "ASSET_FOUND",
          data: {
            href: `/#${asset.asset._id}`
          }
        },
        "*"
      );
    }
  }, [asset]);

  const isLoading = !assets || !fields || !users;

  useEffect(() => {
    setIsLoading(isLoading);
  }, [isLoading, setIsLoading]);

  if ((assets && !assets.viewer) || (fields && !fields.viewer)) {
    router.push(`/signin/?ergo=/integrations/vsphere/?dns=${dns}`);
    return null;
  }

  return (
    <>
      {!isLoading && (!fieldMappings.hostname || !fieldMappings.ip) && (
        <div className="mt-2 flex h-full w-full items-center justify-center gap-2 font-bold text-red-500">
          <ShieldAlert className="h-5 w-5" />
          Hypershelf schema is invalid
        </div>
      )}

      {!isLoading && fieldMappings.hostname && fieldMappings.ip && !asset && (
        <div className="text-muted-foreground mt-2 flex h-full w-full items-center justify-center gap-2 font-bold">
          <CloudOff className="h-5 w-5" />
          This asset is not in the inventory
        </div>
      )}

      {!isLoading && asset && (
        <div className="grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
          {fields!.fields.map(({ field }) => {
            if (!asset.asset.metadata || field.hidden) return null;
            return (
              <div
                key={field._id}
                className="bg-secondary border-border flex items-center gap-2 rounded-md border px-2 py-1"
              >
                <DynamicIcon
                  name={(field.extra?.icon || "circle") as IconName}
                  className="h-4 w-4"
                />
                <strong>{field.name}:</strong>{" "}
                {renderField(
                  field,
                  (
                    asset.asset.metadata as NonNullable<
                      typeof asset.asset.metadata
                    >
                  )[field._id],
                  users!,
                  "size-4"
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
