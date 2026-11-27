export type Status =
  | "Recebida"
  | "Em análise"
  | "Aguardando aprovação"
  | "Em execução"
  | "Concluída"
  | "Cancelada";

export type Priority = "Baixa" | "Média" | "Alta" | "Urgente";

export type Area = {
  id: string;
  name: string;
};

export type Profile = {
  id: string;
  full_name: string;
  email: string | null;
  role: "admin" | "gestor" | "colaborador";
  area_id: string | null;
  area_ids?: string[];
  active: boolean;
  stock_manager: boolean;
};

export type AreaAssignment = {
  areaId: string;
  area: string;
  ownerId: string;
  owner: string;
  status: Status;
  isPrimary: boolean;
  completedAt: string | null;
};

export type Task = {
  id: string;
  protocol: number;
  title: string;
  area: string;
  areaId: string;
  owner: string;
  requester: string;
  requesterId: string;
  priority: Priority;
  status: Status;
  due: string;
  created: string;
  completedAt: string | null;
  description: string;
  ownerId: string | null;
  areaAssignments: AreaAssignment[];
};

export type AreaMember = {
  profile_id: string;
  full_name: string;
};

export type RequestComment = {
  id: string;
  request_id: string;
  author_id: string;
  body: string;
  created_at: string;
  author_name: string;
};

export type Material = {
  id: string;
  sku: string | null;
  name: string;
  description: string | null;
  unit: string;
  quantity: number;
  minimum_quantity: number;
  active: boolean;
  image_path: string | null;
};

export type StockMovement = {
  id: string;
  material_id: string;
  request_id: string | null;
  material_order_id: string | null;
  movement_type:
    | "entrada"
    | "saida"
    | "reserva"
    | "cancelamento_reserva"
    | "ajuste";
  quantity: number;
  responsible_id: string | null;
  notes: string | null;
  created_at: string;
};

export type MaterialOrderStatus =
  | "aguardando_aprovacao_gestor"
  | "aguardando_aprovacao_estoque"
  | "em_separacao"
  | "aguardando_retirada"
  | "concluido"
  | "rejeitado_gestor"
  | "rejeitado_estoque"
  | "cancelado";

export type MaterialOrder = {
  id: string;
  protocol: number;
  requester_id: string;
  area_id: string;
  purpose: string;
  needed_by: string;
  status: MaterialOrderStatus;
  manager_approver_id: string | null;
  stock_approver_id: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type MaterialOrderItem = {
  id: string;
  order_id: string;
  material_id: string;
  quantity: number;
  material?: {
    name: string;
    unit: string;
    sku: string | null;
  };
};

export type MaterialOrderHistory = {
  id: string;
  order_id: string;
  actor_id: string | null;
  action: string;
  previous_status: string | null;
  new_status: string | null;
  details: string | null;
  created_at: string;
  actor_name?: string;
};

export type AppNotification = {
  id: string;
  title: string;
  message: string;
  notification_type: string;
  material_order_id: string | null;
  is_read: boolean;
  created_at: string;
};

export type AuditLog = {
  id: string;
  actor_id: string | null;
  actor_name: string | null;
  actor_email: string | null;
  action: "INSERT" | "UPDATE" | "DELETE";
  table_name: string;
  record_id: string | null;
  old_values: Record<string, any> | null;
  new_values: Record<string, any> | null;
  created_at: string;
};
