import { api } from "~/convex/_generated/api";
import { Button } from "@/ui/button";
import { useRef, useState } from "react";
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowUpDown, FileImage, PlayCircle } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/ui/table";

function getMediaTypeFromContentType(
  contentType: string | null | undefined,
): "image" | "video" | "unknown" {
  if (!contentType) return "unknown";
  if (contentType.startsWith("image/")) return "image";
  if (contentType.startsWith("video/")) return "video";
  return "unknown";
}

const columns: ColumnDef<
  (typeof api.r2.listMetadata._returnType)["page"][number]
>[] = [
  {
    accessorKey: "bucket",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="pl-0"
        >
          Bucket
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      return (
        <a href={row.original.bucketLink} target="_blank" className="underline">
          {row.original.bucket}
        </a>
      );
    },
  },
  {
    accessorKey: "url",
    header: "Preview",
    cell: ({ row }) => {
      const videoRef = useRef<HTMLVideoElement>(null);
      const { url, contentType } = row.original;
      const mediaType = getMediaTypeFromContentType(contentType);

      const handleMouseEnter = () => {
        if (videoRef.current) {
          videoRef.current.play().catch((error) => {
            console.warn("Video autoplay prevented", error);
          });
        }
      };

      const handleMouseLeave = () => {
        if (videoRef.current) {
          videoRef.current.pause();
          videoRef.current.currentTime = 0;
        }
      };

      if (mediaType === "image" && url) {
        return (
          <img
            className="max-h-12 max-w-16 rounded-sm object-cover"
            src={url}
            alt="R2 object"
          />
        );
      }
      if (mediaType === "video" && url) {
        return (
          <div
            className="group relative flex h-12 w-16 cursor-pointer items-center justify-center"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <video
              ref={videoRef}
              src={`${url}#t=0.1`}
              className="h-full w-full rounded-sm bg-black object-cover"
              preload="metadata"
              muted
              loop
              playsInline
            />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/30 opacity-100 transition-opacity group-hover:opacity-0">
              <PlayCircle className="h-6 w-6 text-white/80" />
            </div>
          </div>
        );
      }
      return (
        <div className="flex h-12 w-16 items-center justify-center rounded-sm bg-muted">
          <FileImage className="h-6 w-6 text-muted-foreground" />
        </div>
      );
    },
  },
  {
    accessorKey: "key",
    header: "Key",
    cell: ({ row }) => {
      return (
        <a href={row.original.link} target="_blank" className="underline">
          {row.original.key}
        </a>
      );
    },
  },
  {
    accessorKey: "size",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="pl-0"
        >
          Size
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const size = parseFloat(row.getValue("size"));
      const formatted = new Intl.NumberFormat("en-US", {
        style: "unit",
        unit: "kilobyte",
        unitDisplay: "narrow",
        maximumFractionDigits: 0,
      }).format(size);
      return <div className="font-medium">{formatted}</div>;
    },
  },
  {
    accessorKey: "lastModified",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="pl-0"
        >
          Last Modified
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      return new Date(row.getValue("lastModified")).toLocaleString();
    },
  },
];

export const MetadataTable = ({
  data,
}: {
  data: (typeof api.r2.listMetadata._returnType)["page"];
}) => {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    rowCount: data.length,
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      sorting,
      columnFilters,
    },
  });

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                return (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() && "selected"}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                No results.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};
