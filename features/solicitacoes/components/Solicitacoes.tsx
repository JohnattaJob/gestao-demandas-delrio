"use client";

import {
  Search,
  Plus,
} from "lucide-react";

import TaskTable from "@/components/shared/TaskTable";
import Pagination from "@/components/shared/Pagination";
import type { Status, Task } from "@/types";

type RequestUser = [string, string];

type RequestPagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
};

type SolicitacoesProps = {
  search: string;
  onSearchChange: (value: string) => void;
  requestUserFilter: string;
  onRequestUserFilterChange: (value: string) => void;
  requestStatusFilter: Status | "Todos";
  onRequestStatusFilterChange: (value: Status | "Todos") => void;
  requestUsers: RequestUser[];
  hasUnassigned: boolean;
  filtered: Task[];
  unreadCounts: Record<string, number>;
  onClearFilters: () => void;
  onNewRequest: () => void;
  onSelectTask: (task: Task) => void;
  pagination: RequestPagination;
};

const statuses: Status[] = [
  "Recebida",
  "Em análise",
  "Aguardando aprovação",
  "Em execução",
  "Concluída",
  "Cancelada",
];

export default function Solicitacoes({
  search,
  onSearchChange,
  requestUserFilter,
  onRequestUserFilterChange,
  requestStatusFilter,
  onRequestStatusFilterChange,
  requestUsers,
  hasUnassigned,
  filtered,
  unreadCounts,
  onClearFilters,
  onNewRequest,
  onSelectTask,
  pagination,
}: SolicitacoesProps) {
  return (
    <>
      <div className="pageHeading">
        <div>
          <p className="eyebrow">GESTÃO OPERACIONAL</p>
          <h1>Solicitações</h1>
          <p className="sub">
            Cadastre, distribua e acompanhe as demandas.
          </p>
        </div>

        <button className="primary" onClick={onNewRequest}>
          <Plus size={17} /> Nova solicitação
        </button>
      </div>

      <style>{`
        .requestFilterCard {
          padding: 22px 24px;
          margin-bottom: 18px;
          border: 1px solid #e7e8ef;
          background: linear-gradient(135deg,#fff 0%,#fcfbff 100%);
          box-shadow: 0 5px 18px rgba(31,24,55,.035);
        }

        .requestFilterTop {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 20px;
        }

        .requestFilterTitle {
          display: flex;
          align-items: center;
          gap: 11px;
        }

        .requestFilterIcon {
          width: 38px;
          height: 38px;
          display: grid;
          place-items: center;
          border-radius: 12px;
          background: #f2eaff;
          color: #7a1bd8;
          flex: none;
        }

        .requestFilterTitle h3 {
          margin: 0 0 4px;
          font-size: 15px;
          font-weight: 700;
          color: #20202b;
        }

        .requestFilterTitle p {
          margin: 0;
          font-size: 12px;
          color: #858397;
        }

        .requestFilterClear {
          border: 0;
          background: transparent;
          color: #7624c7;
          font-size: 12px;
          font-weight: 700;
          padding: 9px 10px;
          border-radius: 8px;
          cursor: pointer;
          white-space: nowrap;
        }

        .requestFilterClear:hover {
          background: #f5edff;
        }

        .requestFilterGrid {
          display: grid;
          grid-template-columns: minmax(0,1.4fr) minmax(190px,.85fr) minmax(190px,.85fr);
          gap: 14px;
          align-items: end;
        }

        .requestFilterField label {
          display: block;
          margin: 0 0 9px;
          color: #565568;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: .035em;
          text-transform: uppercase;
        }

        .requestFilterControl {
          width: 100%;
          height: 43px;
          border: 1px solid #e1e2ea;
          border-radius: 10px;
          background: #fff;
          padding: 0 12px;
          color: #292837;
          font-size: 13px;
          font-weight: 500;
          font-family: inherit;
          outline: none;
          transition: border-color .15s,box-shadow .15s;
          box-sizing: border-box;
        }

        .requestFilterControl:focus {
          border-color: #9b5cdb;
          box-shadow: 0 0 0 3px rgba(122,27,216,.10);
        }

        .requestFilterSearch {
          position: relative;
        }

        .requestFilterSearch > svg {
          position: absolute;
          left: 13px;
          top: 50%;
          transform: translateY(-50%);
          color: #89869a;
          pointer-events: none;
        }

        .requestFilterSearch .requestFilterControl {
          padding-left: 40px;
        }

        .requestFilterBottom {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 8px;
          margin-top: 18px;
          padding-top: 14px;
          border-top: 1px solid #f0edf4;
          color: #777487;
          font-size: 12px;
        }

        .requestFilterBottom strong {
          color: #4b3a60;
          font-weight: 700;
        }

        @media(max-width:760px) {
          .requestFilterCard {
            padding: 18px;
          }

          .requestFilterGrid {
            grid-template-columns: 1fr;
            gap: 16px;
          }

          .requestFilterTop {
            margin-bottom: 17px;
          }
        }
      `}</style>

      <section className="panel requestFilterCard">
        <div className="requestFilterTop">
          <div className="requestFilterTitle">
            <span className="requestFilterIcon">
              <Search size={19} />
            </span>

            <div>
              <h3>Filtros das solicitações</h3>
              <p>
                Encontre demandas por palavra-chave ou responsável.
              </p>
            </div>
          </div>

          <button
            type="button"
            className="secondary"
            style={{ padding: "8px 12px", fontSize: 12 }}
            onClick={onClearFilters}
          >
            Limpar filtros
          </button>
        </div>

        <div className="requestFilterGrid">
          <div className="requestFilterField">
            <label htmlFor="request-search">
              Buscar solicitações
            </label>

            <div className="requestFilterSearch">
              <Search size={16} />

              <input
                id="request-search"
                className="requestFilterControl"
                placeholder="Título, área, responsável ou status..."
                value={search}
                onChange={(event) => onSearchChange(event.target.value)}
              />
            </div>
          </div>

          <div className="requestFilterField">
            <label htmlFor="request-user-filter">
              Responsável
            </label>

            <select
              id="request-user-filter"
              className="requestFilterControl"
              value={requestUserFilter}
              onChange={(event) =>
                onRequestUserFilterChange(event.target.value)
              }
            >
              <option value="Todos">Todos os usuários</option>

              {requestUsers.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}

              {hasUnassigned && (
                <option value="Sem responsável">
                  Sem responsável
                </option>
              )}
            </select>
          </div>

          <div className="requestFilterField">
            <label htmlFor="request-status-filter">
              Status
            </label>

            <select
              id="request-status-filter"
              className="requestFilterControl"
              value={requestStatusFilter}
              onChange={(event) =>
                onRequestStatusFilterChange(
                  event.target.value as Status | "Todos"
                )
              }
            >
              <option value="Todos">Todos os status</option>

              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="requestFilterBottom">
          <span>
            <strong>{filtered.length}</strong> registro(s) encontrado(s)
          </span>
        </div>
      </section>

      <div className="panel">
        <TaskTable
          tasks={filtered.slice(
            (pagination.page - 1) * pagination.pageSize,
            pagination.page * pagination.pageSize
          )}
          onSelect={onSelectTask}
          unreadCounts={unreadCounts}
        />

        <Pagination {...pagination} />
      </div>
    </>
  );
}