"use client";

import type { Dispatch, SetStateAction } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Download,
  History,
  Layers,
  Package,
  Plus,
  RefreshCw,
  Search,
} from "lucide-react";
import Pagination from "@/components/shared/Pagination";
import Stat from "@/components/shared/Stat";
import type { Task } from "@/types";

type Material = {
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

type StockMovement = {
  id: string;
  material_id: string;
  request_id: string | null;
  material_order_id: string | null;
  movement_type: "entrada" | "saida" | "reserva" | "cancelamento_reserva" | "ajuste";
  quantity: number;
  responsible_id: string | null;
  notes: string | null;
  created_at: string;
};

type StockSection = "materiais" | "alertas" | "consumo";

type PaginationData = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
};

type StockAlert = {
  material: Material;
  reserved: number;
  available: number;
  minimum: number;
  level: "critical" | "warning" | "limit";
  label: string;
};

type EstoqueProps = {
  canManageStock: boolean;
  stockSection: StockSection;
  setStockSection: Dispatch<SetStateAction<StockSection>>;
  loadStock: () => void;
  stockLoading: boolean;
  stockError: string;
  setStockError: Dispatch<SetStateAction<string>>;
  openNewMaterial: () => void;
  stockMaterials: Material[];
  setMovementError: Dispatch<SetStateAction<string>>;
  setMovementForm: Dispatch<SetStateAction<{
    material_id: string;
    movement_type: StockMovement["movement_type"];
    quantity: string;
    request_id: string;
    notes: string;
  }>>;
  setShowStockMovement: Dispatch<SetStateAction<boolean>>;
  stockMovementSummary: {
    total: number;
    entries: number;
    exits: number;
    reservations: number;
    reservationCancellations: number;
    adjustments: number;
  };
  reservedByMaterial: Record<string, number>;
  stockAlerts: StockAlert[];
  pageItems: <T,>(key: string, items: T[]) => T[];
  paginationProps: (key: string, total: number) => PaginationData;
  exportStockConsumption: () => void;
  filteredConsumptionMovements: StockMovement[];
  stockConsumptionMaterial: string;
  setStockConsumptionMaterial: Dispatch<SetStateAction<string>>;
  stockConsumptionStart: string;
  setStockConsumptionStart: Dispatch<SetStateAction<string>>;
  stockConsumptionEnd: string;
  setStockConsumptionEnd: Dispatch<SetStateAction<string>>;
  stockConsumptionSummary: {
    movements: number;
    materials: number;
    units: number;
  };
  stockConsumptionByMonth: {
    month: string;
    label: string;
    quantity: number;
  }[];
  stockConsumptionByMaterial: {
    material: Material | undefined;
    materialId: string;
    quantity: number;
  }[];
  filteredMaterials: Material[];
  stockSearch: string;
  setStockSearch: Dispatch<SetStateAction<string>>;
  materialImageUrls: Record<string, string>;
  openEditMaterial: (material: Material) => void;
  tasks: Task[];
  stockReportMaterial: string;
  setStockReportMaterial: Dispatch<SetStateAction<string>>;
  stockReportType: string;
  setStockReportType: Dispatch<SetStateAction<string>>;
  stockReportStart: string;
  setStockReportStart: Dispatch<SetStateAction<string>>;
  stockReportEnd: string;
  setStockReportEnd: Dispatch<SetStateAction<string>>;
  filteredStockMovements: StockMovement[];
  stockReportSummary: {
    total: number;
    entries: number;
    exits: number;
    adjustments: number;
    reservations: number;
  };
  exportStockMovements: () => void;
};

export default function Estoque({
  canManageStock,
  stockSection,
  setStockSection,
  loadStock,
  stockLoading,
  stockError,
  setStockError,
  openNewMaterial,
  stockMaterials,
  setMovementError,
  setMovementForm,
  setShowStockMovement,
  stockMovementSummary,
  reservedByMaterial,
  stockAlerts,
  pageItems,
  paginationProps,
  exportStockConsumption,
  filteredConsumptionMovements,
  stockConsumptionMaterial,
  setStockConsumptionMaterial,
  stockConsumptionStart,
  setStockConsumptionStart,
  stockConsumptionEnd,
  setStockConsumptionEnd,
  stockConsumptionSummary,
  stockConsumptionByMonth,
  stockConsumptionByMaterial,
  filteredMaterials,
  stockSearch,
  setStockSearch,
  materialImageUrls,
  openEditMaterial,
  tasks,
  stockReportMaterial,
  setStockReportMaterial,
  stockReportType,
  setStockReportType,
  stockReportStart,
  setStockReportStart,
  stockReportEnd,
  setStockReportEnd,
  filteredStockMovements,
  stockReportSummary,
  exportStockMovements,
}: EstoqueProps) {
  return (
    <>

          <div className="pageHeading">
            <div><p className="eyebrow">MATERIAIS</p><h1>Estoque</h1><p className="sub">Controle de materiais promocionais, disponibilidade e movimentações.</p></div>
            {canManageStock && <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
              <button className="secondary" onClick={()=>loadStock()} disabled={stockLoading}><RefreshCw size={15}/> Atualizar</button>
              {stockSection==="materiais" && <><button className="secondary" onClick={openNewMaterial}><Plus size={16}/> Novo material</button>
              <button className="primary" onClick={()=>{setMovementError("");setMovementForm(old=>({...old,material_id:old.material_id||stockMaterials[0]?.id||""}));setShowStockMovement(true)}} disabled={!stockMaterials.length}><ArrowUpRight size={16}/> Nova movimentação</button></>}
            </div>}
          </div>
          {stockError && <div className="errorBanner"><span>{stockError}</span><button onClick={()=>setStockError("")}>Fechar</button></div>}
          {!canManageStock && <div className="notice" style={{marginBottom:16}}>Você possui acesso de consulta ao estoque. Para cadastrar materiais ou registrar movimentações, solicite ao administrador a permissão “Gerenciar Estoque”.</div>}
          {canManageStock && <nav aria-label="Seções do estoque" style={{display:"flex",gap:8,flexWrap:"wrap",padding:6,marginBottom:18,border:"1px solid #e7e8ef",borderRadius:12,background:"#fff"}}>{[{id:"materiais",label:"Materiais",icon:<Package size={16}/>},{id:"alertas",label:"Alertas de estoque",icon:<AlertTriangle size={16}/>},{id:"consumo",label:"Análise de consumo",icon:<BarChart3 size={16}/>}].map(item=><button key={item.id} type="button" aria-pressed={stockSection===item.id} onClick={()=>setStockSection(item.id as "materiais"|"alertas"|"consumo")} style={{display:"inline-flex",alignItems:"center",justifyContent:"center",gap:8,padding:"10px 14px",border:stockSection===item.id?"1px solid #d8c2ef":"1px solid transparent",borderRadius:9,background:stockSection===item.id?"#f5edff":"transparent",color:stockSection===item.id?"#7020c5":"#686579",fontSize:13,fontWeight:stockSection===item.id?700:600,cursor:"pointer"}}>{item.icon}{item.label}</button>)}</nav>}
          {canManageStock && stockSection==="materiais" && <>
            <div className="stats">
              <Stat icon={<Package/>} label="Materiais ativos" value={stockMaterials.length} tone="blue"/>
              <Stat icon={<AlertTriangle/>} label="Abaixo do mínimo" value={stockMaterials.filter(m=>Number(m.quantity)-(reservedByMaterial[m.id]||0)<=Number(m.minimum_quantity)).length} tone="red"/>
              <Stat icon={<Layers/>} label="Materiais com reserva" value={stockMaterials.filter(m=>(reservedByMaterial[m.id]||0)>0).length} tone="violet"/>
              <Stat icon={<CheckCircle2/>} label="Com saldo disponível" value={stockMaterials.filter(m=>Number(m.quantity)-(reservedByMaterial[m.id]||0)>0).length} tone="green"/>
            </div>
            <div className="panel" style={{marginTop:18}}>
              <div className="panelHead"><div><h3>Movimentações dos últimos 30 dias</h3><p>Quantidade de registros por tipo de movimentação no período.</p></div><span className="muted">{stockMovementSummary.total} registro(s)</span></div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(145px,1fr))",gap:12}}>
                <Stat icon={<ArrowUpRight/>} label="Entradas" value={stockMovementSummary.entries} tone="green"/>
                <Stat icon={<Activity/>} label="Saídas" value={stockMovementSummary.exits} tone="blue"/>
                <Stat icon={<Layers/>} label="Reservas" value={stockMovementSummary.reservations} tone="violet"/>
                <Stat icon={<RefreshCw/>} label="Cancelamentos de reserva" value={stockMovementSummary.reservationCancellations} tone="amber"/>
                <Stat icon={<History/>} label="Ajustes" value={stockMovementSummary.adjustments} tone="blue"/>
              </div>
            </div>
          </>}
          {canManageStock && stockSection==="alertas" && <>
            <div className="panel" style={{marginTop:18}}>
              <div className="panelHead">
                <div><h3>Alertas de estoque</h3><p>Materiais sem saldo disponível ou com saldo no limite/abaixo do estoque mínimo.</p></div>
                <span className="muted">{stockAlerts.length} alerta(s)</span>
              </div>
              {stockAlerts.length === 0 ? <div className="emptyTable">Nenhum alerta. Todos os materiais estão acima do estoque mínimo.</div> : (
                <div style={{display:"grid",gap:10}}>
                  {pageItems("stockAlerts",stockAlerts).map(alert => {
                    const color = alert.level === "critical" ? "#b42318" : alert.level === "warning" ? "#b54708" : "#7a5b00";
                    const background = alert.level === "critical" ? "#fff1f0" : alert.level === "warning" ? "#fff7ed" : "#fffbeb";
                    return <div key={alert.material.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:16,flexWrap:"wrap",padding:"13px 15px",border:"1px solid #eaecf0",borderRadius:10}}>
                      <div style={{display:"flex",alignItems:"center",gap:10,minWidth:220,flex:"1 1 240px"}}>
                        <span style={{width:9,height:9,borderRadius:99,background:color,flexShrink:0}}/>
                        <div><b style={{display:"block",fontSize:14}}>{alert.material.name}</b><span className="muted" style={{fontSize:12}}>{alert.material.sku || "Sem código"}</span></div>
                      </div>
                      <span style={{fontSize:12,fontWeight:600,color,background,padding:"6px 9px",borderRadius:20}}>{alert.label}</span>
                      <div style={{display:"flex",gap:18,flexWrap:"wrap",fontSize:12,color:"#475467"}}>
                        <span>Disponível: <b>{alert.available.toLocaleString("pt-BR",{maximumFractionDigits:2})} {alert.material.unit}</b></span>
                        <span>Reservado: <b>{alert.reserved.toLocaleString("pt-BR",{maximumFractionDigits:2})} {alert.material.unit}</b></span>
                        <span>Mínimo: <b>{alert.minimum.toLocaleString("pt-BR",{maximumFractionDigits:2})} {alert.material.unit}</b></span>
                      </div>
                    </div>;
                  })}
                </div>
              )}<Pagination {...paginationProps("stockAlerts",stockAlerts.length)}/>
            </div>
          </>}
          {canManageStock && stockSection==="consumo" && <>
            <style>{`
              .stockReportGrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(185px,1fr));gap:14px;align-items:start}
              .stockReportFieldLabel{display:block;margin:0 0 9px;color:#565568;font-size:11px;font-weight:700;letter-spacing:.035em;text-transform:uppercase}
              .stockReportControl{width:100%;height:43px;box-sizing:border-box;border:1px solid #e1e2ea;border-radius:10px;background:#fff;padding:0 12px;color:#292837;font-size:13px;font-weight:500;font-family:inherit;outline:none;transition:border-color .15s,box-shadow .15s}
              .stockReportControl:focus{border-color:#9b5cdb;box-shadow:0 0 0 3px rgba(122,27,216,.10)}
              @media(max-width:700px){.stockReportGrid{grid-template-columns:repeat(2,minmax(0,1fr))}}
              @media(max-width:520px){.stockReportGrid{grid-template-columns:1fr}}
            `}</style>
            <section className="panel" style={{marginBottom:18,padding:22,border:"1px solid #e7e8ef",background:"linear-gradient(135deg,#fff 0%,#fcfbff 100%)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:14,flexWrap:"wrap",marginBottom:18}}>
              <div style={{display:"flex",alignItems:"center",gap:11}}><span style={{width:38,height:38,display:"grid",placeItems:"center",borderRadius:12,background:"#f2eaff",color:"#7a1bd8"}}><BarChart3 size={19}/></span><div><h3 style={{margin:"0 0 4px",fontSize:15}}>Análise de consumo</h3><p style={{margin:0,fontSize:12,color:"#858397"}}>Acompanhe as saídas efetivas de materiais por período e identifique os itens de maior consumo.</p></div></div>
              <button className="secondary" onClick={exportStockConsumption} disabled={!filteredConsumptionMovements.length}><Download size={15}/> Exportar CSV</button>
            </div>
            <div className="stockReportGrid" style={{marginBottom:18}}>
              <div><label className="stockReportFieldLabel" htmlFor="consumption-material">Material</label><select id="consumption-material" className="stockReportControl" value={stockConsumptionMaterial} onChange={e=>setStockConsumptionMaterial(e.target.value)}><option value="Todos">Todos os materiais</option>{stockMaterials.map(material=><option key={material.id} value={material.id}>{material.name}</option>)}</select></div>
              <div><label className="stockReportFieldLabel" htmlFor="consumption-start">Data inicial</label><input id="consumption-start" className="stockReportControl" type="date" value={stockConsumptionStart} max={stockConsumptionEnd||undefined} onChange={e=>setStockConsumptionStart(e.target.value)}/></div>
              <div><label className="stockReportFieldLabel" htmlFor="consumption-end">Data final</label><input id="consumption-end" className="stockReportControl" type="date" value={stockConsumptionEnd} min={stockConsumptionStart||undefined} onChange={e=>setStockConsumptionEnd(e.target.value)}/></div>
              <div style={{display:"flex",alignItems:"end"}}><button className="secondary" style={{width:"100%",height:43}} onClick={()=>{setStockConsumptionMaterial("Todos");setStockConsumptionStart("");setStockConsumptionEnd("")}}>Limpar filtros</button></div>
            </div>
            <div className="stats" style={{marginBottom:18}}><Stat icon={<History/>} label="Saídas registradas" value={stockConsumptionSummary.movements} tone="blue"/><Stat icon={<Package/>} label="Materiais consumidos" value={stockConsumptionSummary.materials} tone="violet"/><Stat icon={<Layers/>} label="Unidades de medida distintas" value={stockConsumptionSummary.units} tone="green"/></div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:16}}>
              <div style={{border:"1px solid #eeeaf3",borderRadius:12,padding:16,minWidth:0}}><h4 style={{fontSize:13,margin:"0 0 5px"}}>Evolução mensal</h4><p style={{fontSize:11,color:"#858397",margin:"0 0 18px"}}>Número de saídas registradas nos últimos seis meses disponíveis no filtro.</p>
                {!stockConsumptionByMonth.length?<div className="emptyTable">Sem saídas no período selecionado.</div>:<div style={{display:"grid",gap:13}}>{stockConsumptionByMonth.map(item=>{const max=Math.max(...stockConsumptionByMonth.map(entry=>entry.quantity),1);return <div key={item.month}><div style={{display:"flex",justifyContent:"space-between",gap:10,fontSize:12,marginBottom:6}}><span style={{color:"#565568",textTransform:"capitalize"}}>{item.label}</span><b>{item.quantity.toLocaleString("pt-BR",{maximumFractionDigits:0})}</b></div><div style={{height:9,background:"#f0edf5",borderRadius:99,overflow:"hidden"}}><div style={{height:"100%",width:`${Math.max(2,item.quantity/max*100)}%`,background:"linear-gradient(90deg,#9b5cdb,#7624c7)",borderRadius:99}}/></div></div>})}</div>}
              </div>
              <div style={{border:"1px solid #eeeaf3",borderRadius:12,padding:16,minWidth:0}}><h4 style={{fontSize:13,margin:"0 0 5px"}}>Materiais mais consumidos</h4><p style={{fontSize:11,color:"#858397",margin:"0 0 18px"}}>Ranking por quantidade total de saídas no período.</p>
                {!stockConsumptionByMaterial.length?<div className="emptyTable">Sem consumo registrado no período.</div>:<div style={{display:"grid",gap:13}}>{stockConsumptionByMaterial.slice(0,5).map((item,index)=>{const max=Math.max(...stockConsumptionByMaterial.map(entry=>entry.quantity),1);return <div key={item.materialId}><div style={{display:"flex",justifyContent:"space-between",gap:10,fontSize:12,marginBottom:6}}><span style={{color:"#565568",minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{index+1}. {item.material?.name||"Material não encontrado"}</span><b style={{whiteSpace:"nowrap"}}>{item.quantity.toLocaleString("pt-BR",{maximumFractionDigits:2})} {item.material?.unit||""}</b></div><div style={{height:9,background:"#f0edf5",borderRadius:99,overflow:"hidden"}}><div style={{height:"100%",width:`${Math.max(2,item.quantity/max*100)}%`,background:"#7a1bd8",borderRadius:99}}/></div></div>})}</div>}
              </div>
            </div>
            <div style={{marginTop:18,border:"1px solid #eeeaf3",borderRadius:12,overflow:"hidden"}}><div style={{padding:"14px 16px",display:"flex",justifyContent:"space-between",gap:10,flexWrap:"wrap",borderBottom:"1px solid #eeeaf3"}}><div><h4 style={{fontSize:13,margin:"0 0 4px"}}>Detalhamento do consumo</h4><p style={{fontSize:11,color:"#858397",margin:0}}>Cada linha representa uma movimentação efetiva do tipo saída.</p></div><span className="muted">{filteredConsumptionMovements.length} registro(s)</span></div>
              {!filteredConsumptionMovements.length?<div className="emptyTable">Nenhum consumo encontrado para os filtros selecionados.</div>:<div className="tableWrap"><table><thead><tr><th>Data</th><th>Material</th><th>Quantidade</th><th>Origem</th><th>Observações</th></tr></thead><tbody>{pageItems("stockConsumption",filteredConsumptionMovements).map(movement=>{const material=stockMaterials.find(item=>item.id===movement.material_id);const request=tasks.find(item=>item.id===movement.request_id);return <tr key={movement.id}><td>{new Date(movement.created_at).toLocaleString("pt-BR")}</td><td>{material?.name||"Material não encontrado"}</td><td><b>{Math.abs(Number(movement.quantity)||0).toLocaleString("pt-BR",{maximumFractionDigits:2})} {material?.unit||""}</b></td><td>{request?"Solicitação #"+request.protocol:movement.material_order_id?"Pedido de materiais":"Movimentação manual"}</td><td>{movement.notes||"—"}</td></tr>})}</tbody></table></div>}<Pagination {...paginationProps("stockConsumption",filteredConsumptionMovements.length)}/>
            </div><p style={{fontSize:11,color:"#858397",margin:"12px 0 0"}}>Critério: somente movimentações do tipo saída entram no cálculo. Reservas, cancelamentos de reserva e ajustes não são considerados consumo.</p>
          </section>
          </>}
          {stockSection==="materiais" && <div className="panel">
            <div className="panelHead"><div><h3>Materiais cadastrados</h3><p>{canManageStock?"Estoque físico, reservas e saldo disponível.":"Consulta dos saldos físicos cadastrados."}</p></div><span className="muted">{filteredMaterials.length} material(is)</span></div>
            <div className="toolbar">
              <div className="search"><Search size={17}/><input placeholder="Buscar material ou código..." value={stockSearch} onChange={e=>setStockSearch(e.target.value)}/></div>
              <span className="muted">{stockLoading?"Carregando estoque...":`${stockMaterials.length} ativo(s)`}</span>
            </div>
            {stockLoading ? <div className="emptyTable">Carregando materiais...</div> : !filteredMaterials.length ? <div className="emptyTable">Nenhum material cadastrado. {canManageStock?"Use “Novo material” para começar.":""}</div> :
              <div className="tableWrap"><table><thead><tr><th>Material</th><th>Código</th><th>Estoque físico</th>{canManageStock&&<><th>Reservado</th><th>Disponível</th></>}<th>Estoque mínimo</th><th>Situação</th>{canManageStock&&<th>Ação</th>}</tr></thead><tbody>
                {pageItems("materials",filteredMaterials).map(m=>{
                  const reserved = reservedByMaterial[m.id] || 0;
                  const available = Number(m.quantity)-reserved;
                  const low = canManageStock && available <= Number(m.minimum_quantity);
                  return <tr key={m.id}>
                    <td><div style={{display:"flex",alignItems:"center",gap:10}}>{materialImageUrls[m.id]?<img src={materialImageUrls[m.id]} alt="" style={{width:44,height:44,objectFit:"cover",borderRadius:8,border:"1px solid #e7e8ef",flexShrink:0}}/>:<span style={{width:44,height:44,borderRadius:8,background:"#f5f1fa",display:"grid",placeItems:"center",color:"#8a62b1",flexShrink:0}}><Package size={18}/></span>}<div><b style={{display:"block",fontSize:15,fontWeight:700,color:"#7A1BD8",lineHeight:1.35}}>{m.name}</b>{m.description&&<span style={{display:"block",fontSize:12,fontWeight:400,color:"#858397",marginTop:4,lineHeight:1.45}}>{m.description}</span>}</div></div></td>
                    <td>{m.sku||"—"}</td>
                    <td>{Number(m.quantity).toLocaleString("pt-BR",{maximumFractionDigits:2})} {m.unit}</td>
                    {canManageStock&&<><td>{reserved.toLocaleString("pt-BR",{maximumFractionDigits:2})} {m.unit}</td><td><b>{available.toLocaleString("pt-BR",{maximumFractionDigits:2})} {m.unit}</b></td></>}
                    <td>{Number(m.minimum_quantity).toLocaleString("pt-BR",{maximumFractionDigits:2})} {m.unit}</td>
                    <td><span className={`status ${low?"red":"green"}`}>{low?"Estoque baixo":"Regular"}</span></td>
                    {canManageStock&&<td><div style={{display:"flex",alignItems:"center",gap:10}}><button className="textButton" onClick={()=>openEditMaterial(m)}>Editar</button><button className="textButton" onClick={()=>{setMovementForm({material_id:m.id,movement_type:"entrada",quantity:"",request_id:"",notes:""});setShowStockMovement(true)}}>Movimentar</button></div></td>}
                  </tr>;
                })}
              </tbody></table></div>}<Pagination {...paginationProps("materials",filteredMaterials.length)}/>
          </div>}
          {canManageStock && stockSection==="materiais" && <>
            <style>{`
              .stockReportFilters{padding:22px 24px;margin:18px 0;border:1px solid #e7e8ef;background:linear-gradient(135deg,#fff 0%,#fcfbff 100%);box-shadow:0 5px 18px rgba(31,24,55,.035)}
              .stockReportTop{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:20px}
              .stockReportTitle{display:flex;align-items:center;gap:11px}
              .stockReportIcon{width:38px;height:38px;display:grid;place-items:center;border-radius:12px;background:#f2eaff;color:#7a1bd8;flex:none}
              .stockReportTitle h3{margin:0 0 4px;font-size:15px;font-weight:700;color:#20202b}
              .stockReportTitle p{margin:0;font-size:12px;color:#858397}
              .stockReportClear{border:0;background:transparent;color:#7624c7;font-size:12px;font-weight:700;padding:9px 10px;border-radius:8px;cursor:pointer;white-space:nowrap}
              .stockReportClear:hover{background:#f5edff}
              .stockReportGrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(185px,1fr));gap:14px;align-items:start}
              .stockReportFieldLabel{display:block;margin:0 0 9px;color:#565568;font-size:11px;font-weight:700;letter-spacing:.035em;text-transform:uppercase}
              .stockReportControl{width:100%;height:43px;border:1px solid #e1e2ea;border-radius:10px;background:#fff;padding:0 12px;color:#292837;font-size:13px;font-weight:500;font-family:inherit;outline:none;transition:border-color .15s,box-shadow .15s}
              .stockReportControl:focus{border-color:#9b5cdb;box-shadow:0 0 0 3px rgba(122,27,216,.10)}
              .stockReportBottom{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:18px;padding-top:14px;border-top:1px solid #f0edf4;flex-wrap:wrap}
              .stockReportSummary{display:flex;align-items:center;gap:8px;color:#777487;font-size:12px}
              .stockReportKpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:14px;margin:0 0 18px}
              .stockReportPanel{padding:22px 24px}
              .stockReportPanelHead{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:18px}
              .stockReportPanelHead h3{margin:0 0 4px;font-size:15px}
              .stockReportPanelHead p{margin:0;color:#858397;font-size:12px}
              @media(max-width:1100px){.stockReportKpis{grid-template-columns:repeat(3,minmax(0,1fr))}}
              @media(max-width:700px){.stockReportFilters,.stockReportPanel{padding:18px}.stockReportKpis{grid-template-columns:repeat(2,minmax(0,1fr))}.stockReportTop{flex-direction:column}}
              @media(max-width:420px){.stockReportKpis{grid-template-columns:1fr}}
            `}</style>
            <section className="panel stockReportFilters">
              <div className="stockReportTop">
                <div className="stockReportTitle"><span className="stockReportIcon"><CalendarDays size={19}/></span><div><h3>Relatório de movimentações</h3><p>Consulte e refine as entradas, saídas, ajustes e movimentações de reservas.</p></div></div>
                <button className="secondary" style={{padding:"8px 12px",fontSize:12}} onClick={()=>{setStockReportMaterial("Todos");setStockReportType("Todos");setStockReportStart("");setStockReportEnd("")}}>Limpar filtros</button>
              </div>
              <div className="stockReportGrid">
                <div><label className="stockReportFieldLabel" htmlFor="stock-report-material">Material</label><select id="stock-report-material" className="stockReportControl" value={stockReportMaterial} onChange={e=>setStockReportMaterial(e.target.value)}><option value="Todos">Todos os materiais</option>{stockMaterials.map(material=><option key={material.id} value={material.id}>{material.name}</option>)}</select></div>
                <div><label className="stockReportFieldLabel" htmlFor="stock-report-type">Tipo de movimentação</label><select id="stock-report-type" className="stockReportControl" value={stockReportType} onChange={e=>setStockReportType(e.target.value)}><option value="Todos">Todos os tipos</option><option value="entrada">Entrada</option><option value="saida">Saída</option><option value="ajuste">Ajuste</option><option value="reserva">Reserva</option><option value="cancelamento_reserva">Cancelamento de reserva</option></select></div>
                <div><label className="stockReportFieldLabel" htmlFor="stock-report-start">Data inicial</label><input id="stock-report-start" className="stockReportControl" type="date" value={stockReportStart} max={stockReportEnd||undefined} onChange={e=>setStockReportStart(e.target.value)}/></div>
                <div><label className="stockReportFieldLabel" htmlFor="stock-report-end">Data final</label><input id="stock-report-end" className="stockReportControl" type="date" value={stockReportEnd} min={stockReportStart||undefined} onChange={e=>setStockReportEnd(e.target.value)}/></div>
              </div>
              <div className="stockReportBottom">
                <span className="stockReportSummary"><CalendarDays size={14}/> {filteredStockMovements.length} movimentação(ões) no resultado</span>
                <span className="stockReportSummary">Período personalizado conforme as datas selecionadas</span>
              </div>
            </section>
            <div className="stockReportKpis">
              <Stat icon={<History/>} label="Total de registros" value={stockReportSummary.total} tone="blue"/>
              <Stat icon={<ArrowUpRight/>} label="Entradas" value={stockReportSummary.entries} tone="green"/>
              <Stat icon={<Activity/>} label="Saídas" value={stockReportSummary.exits} tone="blue"/>
              <Stat icon={<RefreshCw/>} label="Ajustes" value={stockReportSummary.adjustments} tone="amber"/>
              <Stat icon={<Layers/>} label="Reservas e cancelamentos" value={stockReportSummary.reservations} tone="violet"/>
            </div>
            <section className="panel stockReportPanel">
              <div className="stockReportPanelHead">
                <div><h3>Detalhamento das movimentações</h3><p>Registros que compõem os indicadores acima.</p></div>
                <button className="secondary" onClick={exportStockMovements} disabled={!filteredStockMovements.length}><Download size={15}/> Exportar CSV</button>
              </div>
              {!filteredStockMovements.length ? <div className="emptyTable">Nenhuma movimentação encontrada para os filtros selecionados.</div> :
                <div className="tableWrap"><table><thead><tr><th>Data</th><th>Material</th><th>Tipo</th><th>Quantidade</th><th>Origem</th><th>Observações</th></tr></thead><tbody>
                  {pageItems("stockMovements",filteredStockMovements).map(m=>{
                    const material=stockMaterials.find(item=>item.id===m.material_id);
                    const request=tasks.find(item=>item.id===m.request_id);
                    const labels:Record<string,string>={entrada:"Entrada",saida:"Saída",reserva:"Reserva",cancelamento_reserva:"Cancelamento de reserva",ajuste:"Ajuste"};
                    return <tr key={m.id}>
                      <td>{new Date(m.created_at).toLocaleString("pt-BR")}</td>
                      <td>{material?.name||"Material não encontrado"}</td>
                      <td>{labels[m.movement_type]||m.movement_type}</td>
                      <td><b>{m.movement_type==="ajuste"&&Number(m.quantity)>0?"+":""}{Number(m.quantity).toLocaleString("pt-BR",{maximumFractionDigits:2})} {material?.unit||""}</b></td>
                      <td>{request?"Solicitação #"+request.protocol:m.material_order_id?"Pedido de materiais":"Movimentação manual"}</td>
                      <td>{m.notes||"—"}</td>
                    </tr>;
                  })}
                </tbody></table></div>}<Pagination {...paginationProps("stockMovements",filteredStockMovements.length)}/>
            </section>
          </>}
    </>
  );
}
