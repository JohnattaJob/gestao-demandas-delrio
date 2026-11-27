import type { Status } from "@/types";
import { statusClass } from "@/lib/constants/status";

type StatusBadgeProps = {
  status: Status;
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className={`status ${statusClass[status]}`}>
      {status}
    </span>
  );
}
