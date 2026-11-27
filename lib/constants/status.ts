import type { Priority, Status } from "@/types";

export const statusToDb: Record<Status, string> = {
  "Recebida": "recebida",
  "Em análise": "em_analise",
  "Aguardando aprovação": "aguardando_aprovacao",
  "Em execução": "em_execucao",
  "Concluída": "concluida",
  "Cancelada": "cancelada",
};

export const dbToStatus: Record<string, Status> = {
  recebida: "Recebida",
  em_analise: "Em análise",
  aguardando_aprovacao: "Aguardando aprovação",
  em_execucao: "Em execução",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

export const priorityToDb: Record<Priority, string> = {
  "Baixa": "baixa",
  "Média": "media",
  "Alta": "alta",
  "Urgente": "urgente",
};

export const dbToPriority: Record<string, Priority> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  urgente: "Urgente",
};

export const statusClass: Record<Status, string> = {
  "Recebida": "gray",
  "Em análise": "blue",
  "Aguardando aprovação": "amber",
  "Em execução": "violet",
  "Concluída": "green",
  "Cancelada": "red",
};

export const defaultAreas = [
  "Criação",
  "Trade Marketing",
  "Eventos e Ações",
  "Materiais e Estoque",
  "E-commerce",
  "Planejamento e Marketing",
  "Social Media",
] as const;
