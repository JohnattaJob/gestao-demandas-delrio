"use client";

import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Plus,
} from "lucide-react";

import Pagination from "@/components/shared/Pagination";
import Stat from "@/components/shared/Stat";
import TaskTable from "@/components/shared/TaskTable";
import type { Task } from "@/types";

type DashboardDateMode = "created" | "completed" | "due";

type DashboardOwner = {
  id: string;
  name: string;
  total: number;
  inProgress: number;
  done: number;
  late: number;
  cancelled: number;
};

type DashboardPagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
};

type DashboardProps = {
  dashboardDateMode: DashboardDateMode;
  setDashboardDateMode: (value: DashboardDateMode) => void;
  dashboardPeriod: string;
  setDashboardPeriod: (value: string) => void;
  dashboardStart: string;
  setDashboardStart: (value: string) => void;
  dashboardEnd: string;
  setDashboardEnd: (value: string) => void;
  dashboardDateLabel: string;
  dashboardTasks: Task[];
  dashboardInProgress: number;
  dashboardDone: number;
  dashboardLate: number;
  areaNames: string[];
  requestsByOwner: DashboardOwner[];
  dashboardOwnerItems: DashboardOwner[];
  dashboardOwnersPagination: DashboardPagination;
  unreadCounts: Record<string, number>;
  onNewRequest: () => void;
  onNavigate: (section: "Solicitações" | "Cronograma") => void;
  onSelectTask: (task: Task) => void;
};

export default function Dashboard({
  dashboardDateMode,
  setDashboardDateMode,
  dashboardPeriod,
  setDashboardPeriod,
  dashboardStart,
  setDashboardStart,
  dashboardEnd,
  setDashboardEnd,
  dashboardDateLabel,
  dashboardTasks,
  dashboardInProgress,
  dashboardDone,
  dashboardLate,
  areaNames,
  requestsByOwner,
  dashboardOwnerItems,
  dashboardOwnersPagination,
  unreadCounts,
  onNewRequest,
  onNavigate,
  onSelectTask,
}: DashboardProps) {
  return (
    <>
      <div className="pageHeading">
        <div>
          <p className="eyebrow">VISÃO GERAL</p>
          <h1>Dashboard</h1>
          <p className="sub">Acompanhe as demandas e a operação do Marketing DelRio.</p>
        </div>
        <button className="primary" onClick={onNewRequest}>
          <Plus size={17} /> Nova solicitação
        </button>
      </div>

      <style>{`
        .dashFilterCard{padding:22px 24px;margin-bottom:18px;border:1px solid #e7e8ef;background:linear-gradient(135deg,#fff 0%,#fcfbff 100%);box-shadow:0 5px 18px rgba(31,24,55,.035)}
        .dashFilterTop{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:20px}
        .dashFilterTitle{display:flex;align-items:center;gap:11px}
        .dashFilterIcon{width:38px;height:38px;display:grid;place-items:center;border-radius:12px;background:#f2eaff;color:#7a1bd8;flex:none}
        .dashFilterTitle h3{margin:0 0 4px;font-size:15px;font-weight:700;color:#20202b}
        .dashFilterTitle p{margin:0;font-size:12px;color:#858397}
        .dashClear{border:0;background:transparent;color:#7624c7;font-size:12px;font-weight:700;padding:9px 10px;border-radius:8px;cursor:pointer;white-space:nowrap}
        .dashClear:hover{background:#f5edff}
        .dashFilterGrid{display:grid;grid-template-columns:minmax(210px,.85fr) minmax(0,1.6fr);gap:22px;align-items:start}
        .dashFieldLabel{display:block;margin:0 0 9px;color:#565568;font-size:11px;font-weight:700;letter-spacing:.035em;text-transform:uppercase}
        .dashDateSelect,.dashDateInput{width:100%;height:43px;border:1px solid #e1e2ea;border-radius:10px;background:#fff;padding:0 12px;color:#292837;font-size:13px;font-weight:500;font-family:inherit;outline:none;transition:border-color .15s,box-shadow .15s}
        .dashDateSelect:focus,.dashDateInput:focus{border-color:#9b5cdb;box-shadow:0 0 0 3px rgba(122,27,216,.10)}
        .dashPeriodOptions{display:flex;flex-wrap:wrap;gap:7px}
        .dashPeriodButton{border:1px solid #e5e2eb;background:#fff;color:#686579;border-radius:9px;padding:10px 12px;font-size:12px;font-weight:600;cursor:pointer;transition:all .15s}
        .dashPeriodButton:hover{border-color:#c7a5e8;color:#7022bd}
        .dashPeriodButton.active{border-color:#7a1bd8;background:#f5edff;color:#7020c5;box-shadow:inset 0 0 0 1px rgba(122,27,216,.06)}
        .dashCustomDates{display:grid;grid-template-columns:repeat(2,minmax(150px,1fr));gap:12px;margin-top:16px;padding:14px;background:#faf8fd;border:1px solid #eee8f5;border-radius:12px}
        .dashFilterBottom{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:18px;padding-top:14px;border-top:1px solid #f0edf4;flex-wrap:wrap}
        .dashFilterSummary{display:flex;align-items:center;gap:8px;color:#777487;font-size:12px}
        .dashFilterSummary strong{color:#4b3a60;font-weight:700}
        .dashFilterNote{margin:12px 0 0;padding:10px 12px;border-radius:9px;background:#fff9eb;color:#8a641c;font-size:11px;line-height:1.5}
        .dashFilterError{margin:10px 0 0;color:#b42318;font-size:12px}
        @media(max-width:760px){.dashFilterCard{padding:18px}.dashFilterGrid{grid-template-columns:1fr;gap:17px}.dashFilterTop{margin-bottom:17px}.dashCustomDates{grid-template-columns:1fr 1fr}}
        @media(max-width:440px){.dashCustomDates{grid-template-columns:1fr}.dashPeriodButton{flex:1 1 calc(50% - 7px)}}
      `}</style>

      <section className="panel dashFilterCard">
        <div className="dashFilterTop">
          <div className="dashFilterTitle">
            <span className="dashFilterIcon"><CalendarDays size={19} /></span>
            <div>
              <h3>Filtros do Dashboard</h3>
              <p>Personalize a análise das solicitações por data e período.</p>
            </div>
          </div>
          <button
            className="dashClear"
            onClick={() => {
              setDashboardPeriod("all");
              setDashboardDateMode("created");
              setDashboardStart("");
              setDashboardEnd("");
            }}
          >
            Limpar filtros
          </button>
        </div>

        <div className="dashFilterGrid">
          <div>
            <label className="dashFieldLabel" htmlFor="dashboard-date-mode">Considerar data</label>
            <select
              id="dashboard-date-mode"
              className="dashDateSelect"
              value={dashboardDateMode}
              onChange={event => setDashboardDateMode(event.target.value as DashboardDateMode)}
            >
              <option value="created">Data de abertura</option>
              <option value="completed">Data de conclusão</option>
              <option value="due">Data do prazo</option>
            </select>
          </div>

          <div>
            <span className="dashFieldLabel">Período de análise</span>
            <div className="dashPeriodOptions">
              {[
                { value: "all", label: "Todo o período" },
                { value: "month", label: "Este mês" },
                { value: "30", label: "Últimos 30 dias" },
                { value: "90", label: "Últimos 90 dias" },
                { value: "year", label: "Este ano" },
                { value: "custom", label: "Personalizado" },
              ].map(option => (
                <button
                  key={option.value}
                  type="button"
                  className={`dashPeriodButton ${dashboardPeriod === option.value ? "active" : ""}`}
                  aria-pressed={dashboardPeriod === option.value}
                  onClick={() => setDashboardPeriod(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {dashboardPeriod === "custom" && (
          <div className="dashCustomDates">
            <div>
              <label className="dashFieldLabel" htmlFor="dashboard-start">Data inicial</label>
              <input
                id="dashboard-start"
                className="dashDateInput"
                type="date"
                value={dashboardStart}
                onChange={event => setDashboardStart(event.target.value)}
              />
            </div>
            <div>
              <label className="dashFieldLabel" htmlFor="dashboard-end">Data final</label>
              <input
                id="dashboard-end"
                className="dashDateInput"
                type="date"
                value={dashboardEnd}
                min={dashboardStart || undefined}
                onChange={event => setDashboardEnd(event.target.value)}
              />
            </div>
          </div>
        )}

        {dashboardPeriod === "custom" && dashboardStart && dashboardEnd && dashboardStart > dashboardEnd && (
          <p className="dashFilterError">A data inicial não pode ser posterior à data final.</p>
        )}

        {dashboardDateMode === "completed" && (
          <p className="dashFilterNote">
            A análise por conclusão utiliza a data registrada quando a solicitação foi concluída.
            Solicitações concluídas antes da ativação desse registro podem não aparecer nesse filtro.
          </p>
        )}

        <div className="dashFilterBottom">
          <span className="dashFilterSummary">
            <CalendarDays size={14} /> Critério: <strong>{dashboardDateLabel}</strong>
          </span>
          <span className="dashFilterSummary">
            {dashboardTasks.length} solicitação(ões) no resultado
          </span>
        </div>
      </section>

      <div className="stats">
        <Stat icon={<ClipboardList />} label="Total de solicitações" value={dashboardTasks.length} tone="blue" />
        <Stat icon={<Activity />} label="Em andamento" value={dashboardInProgress} tone="violet" />
        <Stat icon={<CheckCircle2 />} label="Concluídas" value={dashboardDone} tone="green" />
        <Stat icon={<AlertTriangle />} label="Atrasadas" value={dashboardLate} tone="red" />
      </div>

      <div className="gridMain">
        <div className="panel">
          <div className="panelHead">
            <div>
              <h3>Solicitações recentes</h3>
              <p>Demandas dentro do período selecionado</p>
            </div>
            <button className="textButton" onClick={() => onNavigate("Solicitações")}>
              Ver todas <ArrowUpRight size={15} />
            </button>
          </div>
          <TaskTable
            tasks={[...dashboardTasks].sort((a, b) => b.created.localeCompare(a.created)).slice(0, 5)}
            onSelect={onSelectTask}
            unreadCounts={unreadCounts}
          />
        </div>

        <div className="panel">
          <div className="panelHead">
            <div>
              <h3>Distribuição por área</h3>
              <p>Volume de solicitações no período</p>
            </div>
          </div>
          <div className="areaBars">
            {areaNames.map(area => {
              const total = dashboardTasks.filter(task => task.area === area).length;
              return (
                <div className="barRow" key={area}>
                  <div><span>{area}</span><b>{total}</b></div>
                  <div className="track">
                    <i style={{ width: `${dashboardTasks.length ? total / dashboardTasks.length * 100 : 0}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 18 }}>
        <div className="panelHead">
          <div>
            <h3>Solicitações por colaborador</h3>
            <p>Distribuição das demandas por responsável pela execução</p>
          </div>
          <span className="muted">{requestsByOwner.length} colaborador(es)</span>
        </div>

        {!requestsByOwner.length ? (
          <div className="emptyTable">Ainda não há solicitações atribuídas a colaboradores.</div>
        ) : (
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Colaborador responsável</th>
                  <th>Total atribuídas</th>
                  <th>Em andamento</th>
                  <th>Concluídas</th>
                  <th>Atrasadas</th>
                  <th>Canceladas</th>
                </tr>
              </thead>
              <tbody>
                {dashboardOwnerItems.map(person => (
                  <tr key={person.id}>
                    <td><b>{person.name}</b></td>
                    <td><b>{person.total}</b></td>
                    <td>{person.inProgress}</td>
                    <td>{person.done}</td>
                    <td>{person.late}</td>
                    <td>{person.cancelled}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {requestsByOwner.length > 0 && (
          <Pagination {...dashboardOwnersPagination} />
        )}
      </div>

      <div className="panel">
        <div className="panelHead">
          <div>
            <h3>Próximos prazos</h3>
            <p>Demandas que exigem acompanhamento</p>
          </div>
          <button className="textButton" onClick={() => onNavigate("Cronograma")}>
            Abrir cronograma <ArrowUpRight size={15} />
          </button>
        </div>
        <TaskTable
          tasks={[...dashboardTasks]
            .filter(task => task.status !== "Concluída" && task.status !== "Cancelada")
            .sort((a, b) => a.due.localeCompare(b.due))
            .slice(0, 4)}
          onSelect={onSelectTask}
          unreadCounts={unreadCounts}
        />
      </div>
    </>
  );
}