import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LoadMoreButtonProps {
  hasMore: boolean;
  loading: boolean;
  remaining?: number;
  onLoadMore: () => void;
}

export function LoadMoreButton({ hasMore, loading, remaining, onLoadMore }: LoadMoreButtonProps) {
  if (!hasMore && !loading) return null;
  return (
    <div className="flex justify-center pt-4 pb-2">
      <Button variant="outline" onClick={onLoadMore} disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Loading…
          </>
        ) : remaining !== undefined ? (
          `Load More (${remaining} remaining)`
        ) : (
          "Load More"
        )}
      </Button>
    </div>
  );
}
