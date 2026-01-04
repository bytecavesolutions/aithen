"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

export function RefreshCacheButton() {
	const router = useRouter();
	const [isPending, startTransition] = useTransition();
	const [isRefreshing, setIsRefreshing] = useState(false);

	const handleRefresh = async () => {
		setIsRefreshing(true);
		try {
			const response = await fetch("/api/registry/cache/refresh", {
				method: "POST",
			});

			if (response.ok) {
				// Wait a moment for the sync to complete, then refresh the page
				await new Promise((resolve) => setTimeout(resolve, 500));
				startTransition(() => {
					router.refresh();
				});
			}
		} catch (error) {
			console.error("Failed to refresh cache:", error);
		} finally {
			setIsRefreshing(false);
		}
	};

	const loading = isPending || isRefreshing;

	return (
		<Button
			variant="outline"
			size="sm"
			onClick={handleRefresh}
			disabled={loading}
			className="h-8 gap-1.5 text-xs"
		>
			<RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
			<span className="hidden sm:inline">Refresh</span>
		</Button>
	);
}
