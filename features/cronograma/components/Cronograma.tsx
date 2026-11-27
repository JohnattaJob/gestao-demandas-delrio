"use client";

import {
  AlertTriangle,
  CalendarDays,
  Clock3,
  ClipboardList
} from "lucide-react";

import Pagination from "@/components/shared/Pagination";
import Stat from "@/components/shared/Stat";
import StatusBadge from "@/components/ui/StatusBadge";
import type { Area, Status, Task } from "@/types";

type PaginationConfig = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
};

type Props = {
  scheduleOverdueCount: number;
  scheduleTodayCount: number;
  scheduleNextSevenCount: number;
  nonCancelledTaskCount: number;
  scheduleTasks: Task[];
  scheduleToday: string;
  schedulePeriod: string;
  setSchedulePeriod: (value: string) => void;
  scheduleOwnerFilter: string;
  setScheduleOwnerFilter: (value: string) => void;
  scheduleAreaFilter: string;
  setScheduleAreaFilter: (value: string) => void;
  scheduleStatusFilter: string;
  setScheduleStatusFilter: (value: string) => void;
  scheduleStartDate: string;
  setScheduleStartDate: (value: string) => void;
  scheduleEndDate: string;
  setScheduleEndDate: (value: string) => void;
  requestUsers: [string, string][];
  hasUnassignedTasks: boolean;
  areas: Area[];
  pageItems: <T,>(key: string, items: T[]) => T[];
  paginationProps: (key: string, total: number) => PaginationConfig;
  onSelectTask: (task: Task) => void;
};

export default function Cronograma({
  scheduleOverdueCount,
  scheduleTodayCount,
  scheduleNextSevenCount,
  nonCancelledTaskCount,
  scheduleTasks,
  scheduleToday,
  schedulePeriod,
  setSchedulePeriod,
  scheduleOwnerFilter,
  setScheduleOwnerFilter,
  scheduleAreaFilter,
  setScheduleAreaFilter,
  scheduleStatusFilter,
  setScheduleStatusFilter,
  scheduleStartDate,
  setScheduleStartDate,
  scheduleEndDate,
  setScheduleEndDate,
  requestUsers,
  hasUnassignedTasks,
  areas,
  pageItems,
  paginationProps,
  onSelectTask
}: Props) {
  return (
    <>
      <div className="pageHeading"><div><p className="eyebrow">PLANEJAMENTO</p><h1>Cronograma da equipe</h1><p className="sub">Acompanhe prazos, responsáveis e andamento das entregas.</p></div></div>
                <div className="stats" style={{marginBottom:18}}>
                  <Stat icon={<AlertTriangle/>} label="Atrasadas" value={scheduleOverdueCount} tone="red"/>
                  <Stat icon={<CalendarDays/>} label="Vencem hoje" value={scheduleTodayCount} tone="red"/>
                  <Stat icon={<Clock3/>} label="Próximos 7 dias" value={scheduleNextSevenCount} tone="violet"/>
                  <Stat icon={<ClipboardList/>} label="No cronograma" value={nonCancelledTaskCount} tone="blue"/>
                </div>
                <style>{`
                  .scheduleFilterCard{padding:22px 24px;margin-bottom:18px;border:1px solid #e7e8ef;background:linear-gradient(135deg,#fff 0%,#fcfbff 100%);box-shadow:0 5px 18px rgba(31,24,55,.035)}
                  .scheduleFilterTop{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:20px}
                  .scheduleFilterTitle{display:flex;align-items:center;gap:11px}
                  .scheduleFilterIcon{width:38px;height:38px;display:grid;place-items:center;border-radius:12px;background:#f2eaff;color:#7a1bd8;flex:none}
                  .scheduleFilterTitle h3{margin:0 0 4px;font-size:15px;font-weight:700;color:#20202b}
                  .scheduleFilterTitle p{margin:0;font-size:12px;color:#858397}
                  .scheduleFilterClear{border:0;background:transparent;color:#7624c7;font-size:12px;font-weight:700;padding:9px 10px;border-radius:8px;cursor:pointer;white-space:nowrap}
                  .scheduleFilterClear:hover{background:#f5edff}
                  .scheduleFilterGrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:14px;align-items:start}
                  .scheduleFieldLabel{display:block;margin:0 0 9px;color:#565568;font-size:11px;font-weight:700;letter-spacing:.035em;text-transform:uppercase}
                  .scheduleSelect{width:100%;height:43px;border:1px solid #e1e2ea;border-radius:10px;background:#fff;padding:0 12px;color:#292837;font-size:13px;font-weight:500;font-family:inherit;outline:none;transition:border-color .15s,box-shadow .15s;cursor:pointer}
                  .scheduleSelect:focus{border-color:#9b5cdb;box-shadow:0 0 0 3px rgba(122,27,216,.10)}
                  .scheduleFilterBottom{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:18px;padding-top:14px;border-top:1px solid #f0edf4;flex-wrap:wrap}
                  .scheduleFilterSummary{display:flex;align-items:center;gap:8px;color:#777487;font-size:12px}
                  .scheduleFilterSummary strong{color:#4b3a60;font-weight:700}
                  @media(max-width:900px){.scheduleFilterGrid{grid-template-columns:repeat(2,minmax(0,1fr))}}
                  @media(max-width:560px){.scheduleFilterCard{padding:18px}.scheduleFilterGrid{grid-template-columns:1fr;gap:16px}.scheduleFilterTop{margin-bottom:17px}}
                `}</style>
                <section className="panel scheduleFilterCard">
                  <div className="scheduleFilterTop">
                    <div className="scheduleFilterTitle"><span className="scheduleFilterIcon"><CalendarDays size={19}/></span><div><h3>Filtros do cronograma</h3><p>Personalize a agenda por prazo, responsável, área e status.</p></div></div>
                    <button className="secondary" style={{padding:"8px 12px",fontSize:12}} onClick={()=>{setScheduleOwnerFilter("Todos");setScheduleAreaFilter("Todas");setScheduleStatusFilter("Todos");setSchedulePeriod("all");setScheduleStartDate("");setScheduleEndDate("")}}>Limpar filtros</button>
                  </div>
                  <div className="scheduleFilterGrid">
                    <div><label className="scheduleFieldLabel" htmlFor="schedule-period">Período</label><select id="schedule-period" className="scheduleSelect" value={schedulePeriod} onChange={e=>setSchedulePeriod(e.target.value)}><option value="all">Todos os prazos</option><option value="7">Próximos 7 dias</option><option value="30">Próximos 30 dias</option><option value="overdue">Somente atrasadas</option><option value="custom">Personalizado</option></select></div>
                    <div><label className="scheduleFieldLabel" htmlFor="schedule-owner">Responsável</label><select id="schedule-owner" className="scheduleSelect" value={scheduleOwnerFilter} onChange={e=>setScheduleOwnerFilter(e.target.value)}><option value="Todos">Todos os colaboradores</option>{requestUsers.map(([id,name])=><option key={id} value={id}>{name}</option>)}{hasUnassignedTasks&&<option value="Sem responsável">Sem responsável</option>}</select></div>
                    <div><label className="scheduleFieldLabel" htmlFor="schedule-area">Área</label><select id="schedule-area" className="scheduleSelect" value={scheduleAreaFilter} onChange={e=>setScheduleAreaFilter(e.target.value)}><option value="Todas">Todas as áreas</option>{areas.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
                    <div><label className="scheduleFieldLabel" htmlFor="schedule-status">Status</label><select id="schedule-status" className="scheduleSelect" value={scheduleStatusFilter} onChange={e=>setScheduleStatusFilter(e.target.value)}><option value="Todos">Todos os status</option>{(["Recebida","Em análise","Aguardando aprovação","Em execução","Concluída","Cancelada"] as Status[]).map(st=><option key={st} value={st}>{st}</option>)}</select></div>
                    {schedulePeriod==="custom"&&<><div><label className="scheduleFieldLabel" htmlFor="schedule-start-date">Data inicial</label><input id="schedule-start-date" className="scheduleSelect" type="date" value={scheduleStartDate} onChange={e=>setScheduleStartDate(e.target.value)} max={scheduleEndDate||undefined}/></div><div><label className="scheduleFieldLabel" htmlFor="schedule-end-date">Data final</label><input id="schedule-end-date" className="scheduleSelect" type="date" value={scheduleEndDate} onChange={e=>setScheduleEndDate(e.target.value)} min={scheduleStartDate||undefined}/></div></>}
                  </div>
                  <div className="scheduleFilterBottom"><span className="scheduleFilterSummary"><CalendarDays size={14}/> Visualização: <strong>{schedulePeriod==="all"?"Todos os prazos":schedulePeriod==="7"?"Próximos 7 dias":schedulePeriod==="30"?"Próximos 30 dias":schedulePeriod==="overdue"?"Somente atrasadas":`Personalizado${scheduleStartDate||scheduleEndDate?` · ${scheduleStartDate?new Date(scheduleStartDate+"T12:00:00").toLocaleDateString("pt-BR"):"início livre"} até ${scheduleEndDate?new Date(scheduleEndDate+"T12:00:00").toLocaleDateString("pt-BR"):"sem limite"}`:" · informe as datas"}`}</strong></span><span className="scheduleFilterSummary">{scheduleTasks.length} resultado(s)</span></div>
                </section>
                <div className="panel"><div className="panelHead"><div><h3>Agenda de entregas</h3><p>Ordenada pelo prazo mais próximo. Selecione uma demanda para abrir seus detalhes.</p></div></div>
                  <div className="timeline">{pageItems("schedule",scheduleTasks).map(t=><button className="timelineItem" key={t.id} onClick={()=>onSelectTask(t)}><div className="dateBlock"><b>{t.due?.slice(8,10)||"—"}</b><small>{t.due?new Date(t.due+"T12:00:00").toLocaleDateString("pt-BR",{month:"short"}):"Sem prazo"}</small></div><div className="timelineInfo"><b>{t.title}</b><small>{t.owner} · {t.area} · #{t.protocol}</small></div><div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>{t.status!=="Concluída"&&t.status!=="Cancelada"&&t.due&&t.due<scheduleToday&&<span className="status red">Atrasada</span>}<StatusBadge status={t.status}/></div></button>)}{!scheduleTasks.length&&<div className="emptyTable">Nenhuma solicitação encontrada com os filtros selecionados.</div>}</div><Pagination {...paginationProps("schedule",scheduleTasks.length)}/>
                </div>
    </>
  );
}
