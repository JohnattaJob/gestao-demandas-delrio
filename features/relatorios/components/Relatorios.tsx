"use client";

import type { Dispatch, SetStateAction } from "react";
import { Activity, AlertTriangle, CalendarDays, CheckCircle2, ClipboardList, Clock3, Download, X } from "lucide-react";
import Pagination from "@/components/shared/Pagination";
import Stat from "@/components/shared/Stat";
import TaskTable from "@/components/shared/TaskTable";
import type { Status, Task } from "@/types";

type Area = { id: string; name: string };
type ReportDateMode = "created" | "completed" | "due";
type ReportArea = { name: string; total: number };
type ReportOwner = { id: string; name: string; total: number; done: number; inProgress: number; late: number };

type Props = {
  exportReports: () => void;
  reportDateMode: ReportDateMode;
  setReportDateMode: Dispatch<SetStateAction<ReportDateMode>>;
  reportAreaFilter: string;
  setReportAreaFilter: Dispatch<SetStateAction<string>>;
  reportOwnerFilter: string;
  setReportOwnerFilter: Dispatch<SetStateAction<string>>;
  reportStatusFilter: string;
  setReportStatusFilter: Dispatch<SetStateAction<string>>;
  reportPeriod: string;
  setReportPeriod: Dispatch<SetStateAction<string>>;
  reportStartDate: string;
  setReportStartDate: Dispatch<SetStateAction<string>>;
  reportEndDate: string;
  setReportEndDate: Dispatch<SetStateAction<string>>;
  areas: Area[];
  requestUsers: [string, string][];
  tasks: Task[];
  reportDateLabel: string;
  reportTasks: Task[];
  reportReceived: number;
  reportAnalysis: number;
  reportAwaitingApproval: number;
  reportExecuting: number;
  reportDone: number;
  reportCancelled: number;
  reportLate: number;
  reportOpenBase: number;
  reportCompletionBase: number;
  reportCompletionRate: number;
  reportOverdueRate: number;
  reportByArea: ReportArea[];
  reportByOwner: ReportOwner[];
  pageItems: <T,>(key: string, items: T[]) => T[];
  paginationProps: (key: string, total: number) => any;
  onSelectTask: (task: Task) => void;
  unreadCounts: Record<string, number>;
};

export default function Relatorios({
  exportReports, reportDateMode, setReportDateMode, reportAreaFilter, setReportAreaFilter,
  reportOwnerFilter, setReportOwnerFilter, reportStatusFilter, setReportStatusFilter,
  reportPeriod, setReportPeriod, reportStartDate, setReportStartDate, reportEndDate,
  setReportEndDate, areas, requestUsers, tasks, reportDateLabel, reportTasks,
  reportReceived, reportAnalysis, reportAwaitingApproval, reportExecuting, reportDone,
  reportCancelled, reportLate, reportOpenBase, reportCompletionBase, reportCompletionRate,
  reportOverdueRate, reportByArea, reportByOwner, pageItems, paginationProps,
  onSelectTask, unreadCounts
}: Props) {
  return (
    <>
          <div className="pageHeading" style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:16,flexWrap:"wrap"}}><div><p className="eyebrow">ANÁLISE GERENCIAL</p><h1>Relatórios</h1><p className="sub">Acompanhe resultados, produtividade e distribuição das demandas.</p></div><button type="button" className="secondary" onClick={exportReports}><Download size={16}/> Exportar relatório</button></div>
          <style>{`
            .reportKpiGrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-top:18px}
            .reportFilterCard{padding:22px 24px;margin-bottom:18px;border:1px solid #e7e8ef;background:linear-gradient(135deg,#fff 0%,#fcfbff 100%);box-shadow:0 5px 18px rgba(31,24,55,.035)}
            .reportFilterTop{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:20px}
            .reportFilterTitle{display:flex;align-items:center;gap:11px}.reportFilterIcon{width:38px;height:38px;display:grid;place-items:center;border-radius:12px;background:#f2eaff;color:#7a1bd8;flex:none}
            .reportFilterTitle h3{margin:0 0 4px;font-size:15px;font-weight:700;color:#20202b}.reportFilterTitle p{margin:0;font-size:12px;color:#858397}
            .reportClear{border:0;background:transparent;color:#7624c7;font-size:12px;font-weight:700;padding:9px 10px;border-radius:8px;cursor:pointer;white-space:nowrap}.reportClear:hover{background:#f5edff}
            .reportFilterGrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(185px,1fr));gap:14px;align-items:start}
            .reportFieldLabel{display:block;margin:0 0 9px;color:#565568;font-size:11px;font-weight:700;letter-spacing:.035em;text-transform:uppercase}
            .reportSelect,.reportDate{width:100%;height:43px;border:1px solid #e1e2ea;border-radius:10px;background:#fff;padding:0 12px;color:#292837;font-size:13px;font-weight:500;font-family:inherit;outline:none;transition:border-color .15s,box-shadow .15s}.reportSelect:focus,.reportDate:focus{border-color:#9b5cdb;box-shadow:0 0 0 3px rgba(122,27,216,.10)}
            .reportPeriodOptions{display:flex;flex-wrap:wrap;gap:7px}.reportPeriodButton{border:1px solid #e5e2eb;background:#fff;color:#686579;border-radius:9px;padding:10px 12px;font-size:12px;font-weight:600;cursor:pointer}.reportPeriodButton.active{border-color:#7a1bd8;background:#f5edff;color:#7020c5}
            .reportCustomDates{display:grid;grid-template-columns:repeat(2,minmax(150px,1fr));gap:12px;margin-top:16px;padding:14px;background:#faf8fd;border:1px solid #eee8f5;border-radius:12px}
            .reportFilterBottom{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:18px;padding-top:14px;border-top:1px solid #f0edf4;flex-wrap:wrap}.reportSummary{display:flex;align-items:center;gap:8px;color:#777487;font-size:12px}
            .reportPanel{padding:22px 24px}.reportPanelHead{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:18px}.reportPanelHead h3{margin:0 0 4px;font-size:15px}.reportPanelHead p{margin:0;color:#858397;font-size:12px}
            .reportBars{display:grid;gap:15px}.reportBarRow>div:first-child{display:flex;justify-content:space-between;gap:12px;margin-bottom:7px;color:#555267;font-size:12px}.reportBarTrack{height:9px;background:#f0edf5;border-radius:99px;overflow:hidden}.reportBarTrack i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,#9b5cdb,#7624c7)}
            .reportRate{display:flex;align-items:center;gap:16px}.reportRate strong{font-size:30px;color:#272235}.reportRate span{font-size:12px;color:#858397}
            @media(max-width:900px){.reportKpiGrid{grid-template-columns:repeat(2,minmax(0,1fr))}}
            @media(max-width:600px){.reportFilterCard,.reportPanel{padding:18px}.reportCustomDates{grid-template-columns:1fr}.reportPeriodButton{flex:1 1 calc(50% - 7px)}}
          `}</style>
          <section className="panel reportFilterCard">
            <div className="reportFilterTop"><div className="reportFilterTitle"><span className="reportFilterIcon"><CalendarDays size={19}/></span><div><h3>Filtros dos relatórios</h3><p>Selecione o período e refine os dados que deseja analisar.</p></div></div><button className="secondary" style={{padding:"8px 12px",fontSize:12}} onClick={()=>{setReportDateMode("created");setReportPeriod("all");setReportStartDate("");setReportEndDate("");setReportAreaFilter("Todas");setReportOwnerFilter("Todos");setReportStatusFilter("Todos")}}>Limpar filtros</button></div>
            <div className="reportFilterGrid">
              <div><label className="reportFieldLabel" htmlFor="report-date-mode">Considerar data</label><select id="report-date-mode" className="reportSelect" value={reportDateMode} onChange={e=>setReportDateMode(e.target.value as "created"|"completed"|"due")}><option value="created">Data de abertura</option><option value="completed">Data de conclusão</option><option value="due">Data do prazo</option></select></div>
              <div><label className="reportFieldLabel" htmlFor="report-area">Área</label><select id="report-area" className="reportSelect" value={reportAreaFilter} onChange={e=>setReportAreaFilter(e.target.value)}><option value="Todas">Todas as áreas</option>{areas.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
              <div><label className="reportFieldLabel" htmlFor="report-owner">Responsável</label><select id="report-owner" className="reportSelect" value={reportOwnerFilter} onChange={e=>setReportOwnerFilter(e.target.value)}><option value="Todos">Todos os colaboradores</option>{requestUsers.map(([id,name])=><option key={id} value={id}>{name}</option>)}{tasks.some(t=>t.areaAssignments.length>0&&t.areaAssignments.every(a=>!a.ownerId))&&<option value="Sem responsável">Sem responsável</option>}</select></div>
              <div><label className="reportFieldLabel" htmlFor="report-status">Status</label><select id="report-status" className="reportSelect" value={reportStatusFilter} onChange={e=>setReportStatusFilter(e.target.value)}><option value="Todos">Todos os status</option>{(["Recebida","Em análise","Aguardando aprovação","Em execução","Concluída","Cancelada"] as Status[]).map(status=><option key={status} value={status}>{status}</option>)}</select></div>
            </div>
            <div style={{marginTop:17}}><span className="reportFieldLabel">Período de análise</span><div className="reportPeriodOptions">{[{value:"all",label:"Todo o período"},{value:"month",label:"Este mês"},{value:"30",label:"Últimos 30 dias"},{value:"90",label:"Últimos 90 dias"},{value:"year",label:"Este ano"},{value:"custom",label:"Personalizado"}].map(option=><button key={option.value} type="button" className={`reportPeriodButton ${reportPeriod===option.value?"active":""}`} aria-pressed={reportPeriod===option.value} onClick={()=>setReportPeriod(option.value)}>{option.label}</button>)}</div></div>
            {reportPeriod==="custom"&&<div className="reportCustomDates"><div><label className="reportFieldLabel" htmlFor="report-start">Data inicial</label><input id="report-start" className="reportDate" type="date" value={reportStartDate} onChange={e=>setReportStartDate(e.target.value)}/></div><div><label className="reportFieldLabel" htmlFor="report-end">Data final</label><input id="report-end" className="reportDate" type="date" min={reportStartDate||undefined} value={reportEndDate} onChange={e=>setReportEndDate(e.target.value)}/></div></div>}
            {reportPeriod==="custom"&&reportStartDate&&reportEndDate&&reportStartDate>reportEndDate&&<p style={{color:"#b42318",fontSize:12,marginTop:10}}>A data inicial não pode ser posterior à data final.</p>}
            {reportDateMode==="completed"&&<p className="dashFilterNote">A análise por conclusão utiliza a data registrada quando a solicitação foi concluída. Solicitações concluídas antes da ativação desse registro podem não aparecer nesse filtro.</p>}
            <div className="reportFilterBottom"><span className="reportSummary"><CalendarDays size={14}/> Critério: <strong>{reportDateLabel}</strong></span><span className="reportSummary">{reportTasks.length} solicitação(ões) no resultado</span></div>
          </section>
          <div className="reportKpiGrid"><Stat icon={<ClipboardList/>} label="Total de solicitações" value={reportTasks.length} tone="blue"/><Stat icon={<Clock3/>} label="Recebidas" value={reportReceived} tone="blue"/><Stat icon={<Activity/>} label="Em análise" value={reportAnalysis} tone="violet"/><Stat icon={<Clock3/>} label="Aguardando aprovação" value={reportAwaitingApproval} tone="violet"/><Stat icon={<Activity/>} label="Em execução" value={reportExecuting} tone="violet"/><Stat icon={<CheckCircle2/>} label="Concluídas" value={reportDone} tone="green"/><Stat icon={<X/>} label="Canceladas" value={reportCancelled} tone="red"/><Stat icon={<AlertTriangle/>} label="Atrasadas" value={reportLate} tone="red"/></div>
          <div className="gridMain" style={{marginTop:18}}>
            <section className="panel reportPanel"><div className="reportPanelHead"><div><h3>Distribuição por status</h3><p>Volume de solicitações em cada etapa</p></div></div><div className="reportBars">{(["Recebida","Em análise","Aguardando aprovação","Em execução","Concluída","Cancelada"] as Status[]).map(status=>{const count=reportTasks.filter(t=>t.status===status).length;return <div className="reportBarRow" key={status}><div><span>{status}</span><b>{count}</b></div><div className="reportBarTrack"><i style={{width:`${reportTasks.length?count/reportTasks.length*100:0}%`}}/></div></div>})}</div></section>
            <section className="panel reportPanel"><div className="reportPanelHead"><div><h3>Distribuição por área</h3><p>Participação de cada área no volume total</p></div></div>{!reportByArea.length?<div className="emptyTable">Não há solicitações no período selecionado.</div>:<div className="reportBars">{reportByArea.map(item=><div className="reportBarRow" key={item.name}><div><span>{item.name}</span><b>{item.total}</b></div><div className="reportBarTrack"><i style={{width:`${reportTasks.length?item.total/reportTasks.length*100:0}%`}}/></div></div>)}</div>}</section>
          </div>
          <div className="gridMain" style={{marginTop:18}}>
            <section className="panel reportPanel"><div className="reportPanelHead"><div><h3>Desempenho da equipe</h3><p>Solicitações atribuídas por responsável</p></div></div>{!reportByOwner.length?<div className="emptyTable">Não há solicitações atribuídas no período.</div>:<div className="tableWrap"><table><thead><tr><th>Responsável</th><th>Total</th><th>Concluídas</th><th>Em andamento</th><th>Atrasadas</th></tr></thead><tbody>{pageItems("reportOwners",reportByOwner).map(person=><tr key={person.id}><td><b>{person.name}</b></td><td>{person.total}</td><td>{person.done}</td><td>{person.inProgress}</td><td>{person.late}</td></tr>)}</tbody></table></div>}<Pagination {...paginationProps("reportOwners",reportByOwner.length)}/></section>
            <section className="panel reportPanel"><div className="reportPanelHead"><div><h3>Taxa de conclusão</h3><p>Percentual de demandas concluídas no resultado filtrado</p></div></div><div className="reportRate"><strong>{reportCompletionRate}%</strong><span>{reportDone} de {reportCompletionBase} solicitações válidas concluídas</span></div><div className="reportBarTrack" style={{marginTop:16,height:12}}><i style={{display:"block",height:"100%",width:`${reportCompletionRate}%`,borderRadius:99,background:"linear-gradient(90deg,#9b5cdb,#7624c7)"}}/></div><div style={{marginTop:22,paddingTop:18,borderTop:"1px solid #f0edf4"}}><div className="reportPanelHead"><div><h3>Solicitações em atraso</h3><p>{reportLate} de {reportOpenBase} solicitações abertas estão com prazo vencido</p></div><strong style={{fontSize:24,color:"#b42318"}}>{reportOverdueRate}%</strong></div><div className="reportBarTrack" style={{height:10}}><i style={{display:"block",height:"100%",width:`${reportOverdueRate}%`,borderRadius:99,background:"#d92d20"}}/></div></div></section>
          </div>
          <section className="panel reportPanel" style={{marginTop:18}}><div className="reportPanelHead"><div><h3>Detalhamento das solicitações</h3><p>Consulte os registros que compõem os indicadores acima.</p></div></div><TaskTable tasks={pageItems("reportTasks",[...reportTasks].sort((a,b)=>b.created.localeCompare(a.created)))} onSelect={onSelectTask} unreadCounts={unreadCounts}/><Pagination {...paginationProps("reportTasks",reportTasks.length)}/></section>
    </>
  );
}
