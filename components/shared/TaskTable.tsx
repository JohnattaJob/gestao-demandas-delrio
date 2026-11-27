import { MessageCircle } from "lucide-react";
import type { Task } from "@/types";
import StatusBadge from "@/components/ui/StatusBadge";

type TaskTableProps = {
  tasks: Task[];
  onSelect: (task: Task) => void;
  unreadCounts?: Record<string, number>;
};

export default function TaskTable({
  tasks,
  onSelect,
  unreadCounts = {},
}: TaskTableProps) {
  if (!tasks.length) {
    return (
      <div className="emptyTable">
        Nenhuma solicitação cadastrada no Supabase.
      </div>
    );
  }

  return (
    <div className="tableWrap">
      <table>
        <thead>
          <tr>
            <th>Solicitação</th>
            <th>Áreas</th>
            <th>Responsáveis</th>
            <th>Prioridade</th>
            <th>Prazo</th>
            <th>Status geral</th>
          </tr>
        </thead>

        <tbody>
          {tasks.map((task) => (
            <tr key={task.id} onClick={() => onSelect(task)}>
              <td>
                <b>#{task.protocol}</b>
                <span>{task.title}</span>

                {(unreadCounts[task.id] || 0) > 0 && (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      marginTop: 5,
                      padding: "4px 8px",
                      borderRadius: 20,
                      background: "#f2e8ff",
                      color: "#7020c5",
                      fontSize: 10,
                      fontWeight: 700,
                    }}
                  >
                    <MessageCircle size={11} />
                    {unreadCounts[task.id]} não lida(s)
                  </span>
                )}
              </td>

              <td>
                {task.areaAssignments.map((assignment) => assignment.area).join(" · ") || task.area}
              </td>

              <td>
                {task.areaAssignments.map((assignment) => assignment.owner).join(" · ") || task.owner}
              </td>

              <td>
                <span className={`priority ${task.priority.toLowerCase()}`}>
                  {task.priority}
                </span>
              </td>

              <td>
                {new Date(`${task.due}T12:00:00`).toLocaleDateString("pt-BR")}
              </td>

              <td>
                <StatusBadge status={task.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
