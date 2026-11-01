import type { RoadieId } from "@/backend";
import { useRoadiePhoto } from "@/hooks/useQueries";
import { refToDataUrl } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ImageIcon } from "lucide-react";
import { useMemo } from "react";

/**
 * A roadie's photo, read on demand by id. The photo bytes are fetched once per
 * roadie (React Query caches them under the id) and converted to a displayable
 * data URL once per roadie, memoized so a re-render does not re-read the bytes.
 * A roadie with no stored photo shows the placeholder icon, never a broken
 * image.
 */
export function RoadiePhoto({
  id,
  name,
  className,
  iconClassName,
  ocid,
}: {
  id: RoadieId;
  name: string;
  className?: string;
  iconClassName?: string;
  ocid?: string;
}) {
  const { data: photo } = useRoadiePhoto(id);
  const src = useMemo(() => refToDataUrl(photo), [photo]);

  return (
    <span
      data-ocid={ocid}
      className={cn(
        "flex items-center justify-center overflow-hidden rounded-full border-2 border-primary bg-muted",
        className,
      )}
    >
      {src ? (
        <img src={src} alt={name} className="h-full w-full object-cover" />
      ) : (
        <ImageIcon
          className={cn("h-6 w-6 text-muted-foreground", iconClassName)}
          aria-hidden="true"
        />
      )}
    </span>
  );
}
