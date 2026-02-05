import { cn } from "@/lib/utils";

const statusColors: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  AWAITING_SCHEDULE: "bg-blue-100 text-blue-800",
  SCHEDULED: "bg-indigo-100 text-indigo-800",
  CONFIRMED: "bg-green-100 text-green-800",
  IN_PROGRESS: "bg-purple-100 text-purple-800",
  COMPLETED: "bg-gray-100 text-gray-800",
  CANCELLED: "bg-red-100 text-red-800",
};

export function Badge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        statusColors[status] || "bg-gray-100 text-gray-800",
        className
      )}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}
