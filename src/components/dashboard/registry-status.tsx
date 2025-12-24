"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface RegistryStatusProps {
  isHealthy: boolean;
}

export function RegistryStatus({ isHealthy }: RegistryStatusProps) {
  return (
    <Badge
      variant={isHealthy ? "default" : "destructive"}
      className="flex items-center gap-1.5"
    >
      {isHealthy ? (
        <>
          <CheckCircle2 className="h-3.5 w-3.5" />
          Registry Online
        </>
      ) : (
        <>
          <XCircle className="h-3.5 w-3.5" />
          Registry Offline
        </>
      )}
    </Badge>
  );
}
