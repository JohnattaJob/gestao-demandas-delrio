"use client";

import {
  RefreshCw, Plus, CalendarDays, ClipboardList, Clock3,
  PackageCheck, Layers, ArrowUpRight, X, CheckCircle2, History
} from "lucide-react";

import Pagination from "@/components/shared/Pagination";
import Stat from "@/components/shared/Stat";
import type {
  Area, Profile, MaterialOrderStatus, MaterialOrder,
  MaterialOrderItem, MaterialOrderHistory
} from "@/types";

type PaginationConfig = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
};

type Props = {
  ordersLoading: boolean;
  loadMaterialOrders: () => void;
  ordersError: string;
  setOrdersError: (value: string) => void;
  myOrderAreas: Area[];
  profile: Profile | null;
  setOrderAreaId: (value: string) => void;
  setShowNewMaterialOrder: (value: boolean) => void;
  applyOrdersPeriod: (preset: "all" | "month" | "last30" | "last90" | "year" | "custom") => void;
  ordersPeriodPreset: "all" | "month" | "last30" | "last90" | "year" | "custom";
  ordersStartDate: string;
  setOrdersStartDate: (value: string) => void;
  ordersEndDate: string;
  setOrdersEndDate: (value: string) => void;
  ordersStatusFilter: MaterialOrderStatus | "todos";
  setOrdersStatusFilter: (value: MaterialOrderStatus | "todos") => void;
  ordersAreaFilter: string;
  setOrdersAreaFilter: (value: string) => void;
  orderStatusLabels: Record<MaterialOrderStatus, string>;
  areas: Area[];
  ordersDateRangeInvalid: boolean;
  filteredMaterialOrders: MaterialOrder[];
  materialOrders: MaterialOrder[];
  pendingManagerOrders: number;
  pendingStockOrders: number;
  activeMaterialOrders: number;
  materialOrderItems: MaterialOrderItem[];
  orderRequesterName: (id: string) => string;
  orderAreaName: (id: string) => string;
  pageItems: <T,>(key: string, items: T[]) => T[];
  paginationProps: (key: string, total: number) => PaginationConfig;
  selectedOrder: MaterialOrder | null;
  selectedOrderItems: MaterialOrderItem[];
  selectedOrderHistory: MaterialOrderHistory[];
  setSelectedMaterialOrder: (id: string | null) => void;
  isManager: boolean;
  canManageStock: boolean;
  ordersSaving: boolean;
  runMaterialOrderAction: (functionName: string, orderId: string, reasonRequired?: boolean) => void | Promise<void>;
};

export default function PedidosMateriais(props: Props) {
  const {
    ordersLoading, loadMaterialOrders, ordersError, setOrdersError,
    myOrderAreas, profile, setOrderAreaId, setShowNewMaterialOrder,
    applyOrdersPeriod, ordersPeriodPreset, ordersStartDate,
    setOrdersStartDate, ordersEndDate, setOrdersEndDate,
    ordersStatusFilter, setOrdersStatusFilter, ordersAreaFilter,
    setOrdersAreaFilter, orderStatusLabels, areas,
    ordersDateRangeInvalid, filteredMaterialOrders, materialOrders,
    pendingManagerOrders, pendingStockOrders, activeMaterialOrders,
    materialOrderItems, orderRequesterName, orderAreaName,
    pageItems, paginationProps, selectedOrder, selectedOrderItems,
    selectedOrderHistory, setSelectedMaterialOrder, isManager,
    canManageStock, ordersSaving, runMaterialOrderAction
  } = props;

  return (
    <>
<div className="pageHeading"><div><p className="eyebrow">SUPRIMENTOS INTERNOS</p><h1>Pedidos de Materiais</h1><p className="sub">Solicite materiais, acompanhe aprovações e consulte a separação e entrega.</p></div><div style={{display:"flex",gap:10,flexWrap:"wrap"}}><button className="secondary" onClick={loadMaterialOrders} disabled={ordersLoading}><RefreshCw size={15}/> Atualizar</button><button className="primary" onClick={()=>{setOrdersError("");setOrderAreaId(myOrderAreas.some(a=>a.id===profile?.area_id)?profile?.area_id||"":myOrderAreas[0]?.id||"");setShowNewMaterialOrder(true)}} disabled={!myOrderAreas.length}><Plus size={16}/> Novo pedido</button></div></div>
          {ordersError&&<div className="errorBanner"><span>{ordersError}</span><button onClick={()=>setOrdersError("")}>Fechar</button></div>}
          <style>{`
             .ordersFilterCard{padding:22px 24px;margin-bottom:18px;border:1px solid #e7e8ef;background:linear-gradient(135deg,#fff 0%,#fcfbff 100%);box-shadow:0 5px 18px rgba(31,24,55,.035)}
             .ordersFilterTop{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:18px}
             .ordersFilterTitle{display:flex;align-items:center;gap:11px}
             .ordersFilterIcon{width:38px;height:38px;display:grid;place-items:center;border-radius:12px;background:#f2eaff;color:#7a1bd8;flex:none}
             .ordersFilterTitle h3{margin:0 0 4px;font-size:15px;font-weight:700;color:#20202b}
             .ordersFilterTitle p{margin:0;font-size:12px;color:#858397}
             .ordersFilterGrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:14px;align-items:start}
             .ordersFieldLabel{display:block;margin:0 0 9px;color:#565568;font-size:11px;font-weight:700;letter-spacing:.035em;text-transform:uppercase}
             .ordersDateInput{width:100%;height:43px;box-sizing:border-box;border:1px solid #e1e2ea;border-radius:10px;background:#fff;padding:0 12px;color:#292837;font-size:13px;font-weight:500;font-family:inherit;outline:none;transition:border-color .15s,box-shadow .15s}
             .ordersDateInput:focus{border-color:#9b5cdb;box-shadow:0 0 0 3px rgba(122,27,216,.10)}
             .ordersPeriodLabel{margin:0 0 12px;color:#565568;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase}
             .ordersPresetRow{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px}
             .ordersPresetButton{height:39px;padding:0 14px;border:1px solid #e1e2ea;border-radius:10px;background:#fff;color:#55536a;font-size:12px;font-weight:600;font-family:inherit;cursor:pointer;transition:all .15s}
             .ordersPresetButton:hover{border-color:#b98be8;color:#7624c7}
             .ordersPresetButton.active{border-color:#8b24e8;background:#f5edff;color:#7624c7;box-shadow:0 0 0 1px rgba(122,27,216,.08)}
             .ordersRefineSection{margin-top:20px;padding-top:17px;border-top:1px solid #eeeaf4}
             .ordersRefineHeading{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px}
             .ordersRefineHeading span{font-size:12px;font-weight:700;color:#383448}
             .ordersRefineHeading small{font-size:11px;color:#9692a5}
             .ordersExtraFilters{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
             .ordersFilterField{min-width:0}
             .ordersCustomDates{margin-top:16px;padding:14px;background:#faf8fd;border:1px solid #eeeaf4;border-radius:12px}
             .ordersSelect{width:100%;height:43px;box-sizing:border-box;border:1px solid #e1e2ea;border-radius:10px;background:#fff;padding:0 12px;color:#292837;font-size:13px;font-weight:500;font-family:inherit;outline:none}
             .ordersSelect:focus{border-color:#9b5cdb;box-shadow:0 0 0 3px rgba(122,27,216,.10)}
             .ordersFilterBottom{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:18px;padding-top:14px;border-top:1px solid #f0edf4;flex-wrap:wrap;color:#777487;font-size:12px}
             .ordersFilterBottom strong{color:#4b3a60;font-weight:700}
             .ordersFilterClear{border:0;background:transparent;color:#7624c7;font-size:12px;font-weight:700;padding:9px 10px;border-radius:8px;cursor:pointer;white-space:nowrap}
             .ordersFilterClear:hover{background:#f5edff}
             @media(max-width:640px){.ordersFilterCard{padding:18px}.ordersFilterGrid,.ordersExtraFilters{grid-template-columns:1fr;gap:12px}.ordersFilterTop{margin-bottom:17px}.ordersPresetRow{gap:7px}.ordersPresetButton{flex:1 1 auto;padding:0 11px}}
           `}</style>
           <section className="panel ordersFilterCard">
             <div className="ordersFilterTop"><div className="ordersFilterTitle"><span className="ordersFilterIcon"><CalendarDays size={19}/></span><div><h3>Filtrar pedidos</h3><p>Combine período, status e área solicitante para refinar a consulta.</p></div></div><button type="button" className="ordersFilterClear" onClick={()=>{applyOrdersPeriod("all");setOrdersStatusFilter("todos");setOrdersAreaFilter("todos")}}>Limpar filtros</button></div>
              <p className="ordersPeriodLabel">Período de análise</p>
              <div className="ordersPresetRow">
                <button type="button" className={`ordersPresetButton ${ordersPeriodPreset==="all"?"active":""}`} onClick={()=>applyOrdersPeriod("all")}>Todo o período</button>
                <button type="button" className={`ordersPresetButton ${ordersPeriodPreset==="month"?"active":""}`} onClick={()=>applyOrdersPeriod("month")}>Este mês</button>
                <button type="button" className={`ordersPresetButton ${ordersPeriodPreset==="last30"?"active":""}`} onClick={()=>applyOrdersPeriod("last30")}>Últimos 30 dias</button>
                <button type="button" className={`ordersPresetButton ${ordersPeriodPreset==="last90"?"active":""}`} onClick={()=>applyOrdersPeriod("last90")}>Últimos 90 dias</button>
                <button type="button" className={`ordersPresetButton ${ordersPeriodPreset==="year"?"active":""}`} onClick={()=>applyOrdersPeriod("year")}>Este ano</button>
                <button type="button" className={`ordersPresetButton ${ordersPeriodPreset==="custom"?"active":""}`} onClick={()=>applyOrdersPeriod("custom")}>Personalizado</button>
              </div>
              {ordersPeriodPreset==="custom"&&<div className="ordersFilterGrid ordersCustomDates">
                <div><label className="ordersFieldLabel" htmlFor="orders-start-date">Data inicial</label><input id="orders-start-date" className="ordersDateInput" type="date" value={ordersStartDate} onChange={e=>setOrdersStartDate(e.target.value)} max={ordersEndDate||undefined}/></div>
                <div><label className="ordersFieldLabel" htmlFor="orders-end-date">Data final</label><input id="orders-end-date" className="ordersDateInput" type="date" value={ordersEndDate} onChange={e=>setOrdersEndDate(e.target.value)} min={ordersStartDate||undefined}/></div>
              </div>}
              <div className="ordersRefineSection">
                <div className="ordersRefineHeading"><span>Refinar resultados</span><small>Filtros combináveis</small></div>
                <div className="ordersExtraFilters">
                  <div className="ordersFilterField"><label className="ordersFieldLabel" htmlFor="orders-status-filter">Status do pedido</label><select id="orders-status-filter" className="ordersSelect" value={ordersStatusFilter} onChange={e=>setOrdersStatusFilter(e.target.value as MaterialOrderStatus|"todos")}><option value="todos">Todos os status</option>{(Object.entries(orderStatusLabels) as [MaterialOrderStatus,string][]).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></div>
                  <div className="ordersFilterField"><label className="ordersFieldLabel" htmlFor="orders-area-filter">Área solicitante</label><select id="orders-area-filter" className="ordersSelect" value={ordersAreaFilter} onChange={e=>setOrdersAreaFilter(e.target.value)}><option value="todos">Todas as áreas</option>{areas.slice().sort((a,b)=>a.name.localeCompare(b.name,"pt-BR")).map(area=><option key={area.id} value={area.id}>{area.name}</option>)}</select></div>
                </div>
              </div><div className="ordersFilterBottom"><span>{ordersDateRangeInvalid?<strong style={{color:"#b42318"}}>A data inicial não pode ser posterior à data final.</strong>:<>Exibindo <strong>{filteredMaterialOrders.length}</strong> de <strong>{materialOrders.length}</strong> pedido(s).</>}</span></div>
           </section>
          <div className="stats"><Stat icon={<ClipboardList/>} label="Pedidos visíveis" value={filteredMaterialOrders.length} tone="blue"/><Stat icon={<Clock3/>} label="Aguardando gestor" value={pendingManagerOrders} tone="violet"/><Stat icon={<PackageCheck/>} label="Aguardando estoque" value={pendingStockOrders} tone="amber"/><Stat icon={<Layers/>} label="Em atendimento" value={activeMaterialOrders} tone="green"/></div>
          <div className="panel"><div className="panelHead"><div><h3>Pedidos cadastrados</h3><p>Os pedidos exibidos respeitam as permissões de acesso do seu perfil.</p></div><span className="muted">{filteredMaterialOrders.length} registro(s)</span></div>
            {ordersLoading?<div className="emptyTable">Carregando pedidos de materiais...</div>:!materialOrders.length?<div className="emptyTable">Nenhum pedido de materiais encontrado. Use “Novo pedido” para registrar a primeira solicitação.</div>:ordersDateRangeInvalid?<div className="emptyTable">Ajuste o período informado para consultar os pedidos.</div>:!filteredMaterialOrders.length?<div className="emptyTable">Nenhum pedido encontrado no período selecionado.</div>:<div className="tableWrap"><table><thead><tr><th>Pedido</th><th>Solicitante / Área</th><th>Necessário em</th><th>Materiais</th><th>Status</th><th style={{textAlign:"right"}}>Ação</th></tr></thead><tbody>{pageItems("orders",filteredMaterialOrders).map(order=>{const count=materialOrderItems.filter(item=>item.order_id===order.id).length;return <tr key={order.id}><td><div style={{display:"flex",flexDirection:"column",gap:3}}><b style={{whiteSpace:"nowrap"}}>#{order.protocol}</b><span className="muted" style={{fontSize:12}}>{new Date(order.created_at).toLocaleDateString("pt-BR")}</span></div></td><td><div style={{display:"flex",flexDirection:"column",gap:3,minWidth:130}}><b>{orderRequesterName(order.requester_id)}</b><span className="muted" style={{fontSize:12}}>{orderAreaName(order.area_id)}</span></div></td><td style={{whiteSpace:"nowrap"}}>{order.needed_by?new Date(order.needed_by+"T12:00:00").toLocaleDateString("pt-BR"):"—"}</td><td><span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",minWidth:28,padding:"4px 9px",borderRadius:20,background:"var(--surface-soft,#f4f2f8)",fontSize:12,fontWeight:700}}>{count}</span><span className="muted" style={{fontSize:12,marginLeft:7}}>{count===1?"material":"materiais"}</span></td><td><span className={`status ${order.status==="concluido"?"green":order.status.startsWith("rejeitado")||order.status==="cancelado"?"red":order.status.includes("aguardando")?"amber":"blue"}`}>{orderStatusLabels[order.status]}</span></td><td style={{textAlign:"right"}}><button className="textButton" style={{whiteSpace:"nowrap"}} onClick={()=>setSelectedMaterialOrder(order.id)}>Ver detalhes <ArrowUpRight size={14}/></button></td></tr>})}</tbody></table></div>}<Pagination {...paginationProps("orders",filteredMaterialOrders.length)}/>
          </div>
          {selectedOrder&&<div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setSelectedMaterialOrder(null)}}>
            <div className="modal" style={{width:"min(820px,100%)",maxWidth:820,maxHeight:"90vh",padding:26,overflowY:"auto"}}>
              <div className="modalHead">
                <div><p className="eyebrow">PEDIDO #{selectedOrder.protocol}</p><h2>Detalhes do pedido</h2><p>{orderRequesterName(selectedOrder.requester_id)} · {orderAreaName(selectedOrder.area_id)} · Necessário em {selectedOrder.needed_by?new Date(selectedOrder.needed_by+"T12:00:00").toLocaleDateString("pt-BR"):"data não informada"}</p></div>
                <button className="iconButton" onClick={()=>setSelectedMaterialOrder(null)} aria-label="Fechar detalhes"><X size={18}/></button>
              </div>
              <div className="detailGrid">
                <div><small>Status do pedido</small><span className={`status ${selectedOrder.status==="concluido"?"green":selectedOrder.status.startsWith("rejeitado")||selectedOrder.status==="cancelado"?"red":selectedOrder.status.includes("aguardando")?"amber":"blue"}`}>{orderStatusLabels[selectedOrder.status]}</span></div>
                <div><small>Data da solicitação</small><b>{new Date(selectedOrder.created_at).toLocaleDateString("pt-BR")}</b></div>
              </div>
              <div className="notice" style={{marginTop:16}}><b>Finalidade:</b> {selectedOrder.purpose}</div>
              <div style={{marginTop:20}}>
                <div className="panelHead"><div><h3>Materiais solicitados</h3><p>{selectedOrderItems.length} item(ns) neste pedido.</p></div></div>
                <div className="tableWrap"><table><thead><tr><th>Material</th><th>Código</th><th>Quantidade</th><th>Unidade</th></tr></thead><tbody>{pageItems("orderItems",selectedOrderItems).map(item=><tr key={item.id}><td><b>{item.material?.name||"Material"}</b></td><td>{item.material?.sku||"—"}</td><td>{Number(item.quantity).toLocaleString("pt-BR")}</td><td>{item.material?.unit||"un"}</td></tr>)}</tbody></table></div><Pagination {...paginationProps("orderItems",selectedOrderItems.length)}/>
              </div>
              {selectedOrder.rejection_reason&&<div className="errorBox" style={{marginTop:14}}>Justificativa: {selectedOrder.rejection_reason}</div>}
              <div style={{display:"flex",gap:9,flexWrap:"wrap",marginTop:20}}>
                {selectedOrder.status==="aguardando_aprovacao_gestor"&&isManager&&<><button className="primary" disabled={ordersSaving} onClick={()=>runMaterialOrderAction("approve_material_order_manager",selectedOrder.id)}><CheckCircle2 size={15}/> Aprovar pedido</button><button className="secondary" disabled={ordersSaving} onClick={()=>runMaterialOrderAction("reject_material_order_manager",selectedOrder.id,true)}>Rejeitar pedido</button></>}
                {selectedOrder.status==="aguardando_aprovacao_estoque"&&canManageStock&&<><button className="primary" disabled={ordersSaving} onClick={()=>runMaterialOrderAction("approve_material_order_stock",selectedOrder.id)}><CheckCircle2 size={15}/> Aprovar e reservar estoque</button><button className="secondary" disabled={ordersSaving} onClick={()=>runMaterialOrderAction("reject_material_order_stock",selectedOrder.id,true)}>Rejeitar pedido</button></>}
                {selectedOrder.status==="em_separacao"&&canManageStock&&<button className="primary" disabled={ordersSaving} onClick={()=>runMaterialOrderAction("release_material_order_for_pickup",selectedOrder.id)}><PackageCheck size={15}/> Liberar para retirada</button>}
                {selectedOrder.status==="aguardando_retirada"&&canManageStock&&<button className="primary" disabled={ordersSaving} onClick={()=>runMaterialOrderAction("complete_material_order",selectedOrder.id)}><CheckCircle2 size={15}/> Confirmar entrega</button>}
                {canManageStock&&["em_separacao","aguardando_retirada"].includes(selectedOrder.status)&&<button className="secondary" disabled={ordersSaving} onClick={()=>runMaterialOrderAction("cancel_material_order",selectedOrder.id,true)}>Cancelar pedido</button>}
              </div>
              <div style={{marginTop:24}}>
                <div className="panelHead"><div><h3><History size={16} style={{display:"inline",verticalAlign:"-3px",marginRight:6}}/>Histórico do pedido</h3><p>Registro cronológico das aprovações e movimentações.</p></div></div>
                {!selectedOrderHistory.length?<div className="emptyTable">Nenhum evento registrado.</div>:<div className="timeline">{pageItems("orderHistory",[...selectedOrderHistory].reverse()).map(event=><div className="timelineItem" key={event.id}><div className="timelineInfo"><b>{event.details||event.action.replaceAll("_"," ")}</b><small>{event.actor_name||"Usuário"} · {new Date(event.created_at).toLocaleString("pt-BR")}</small></div>{event.new_status&&<span className="status blue">{orderStatusLabels[event.new_status as MaterialOrderStatus]||event.new_status}</span>}</div>)}</div>}<Pagination {...paginationProps("orderHistory",selectedOrderHistory.length)}/>
              </div>
              <div className="modalActions"><button className="secondary" onClick={()=>setSelectedMaterialOrder(null)}>Fechar</button></div>
            </div>
          </div>}
    </>
  );
}
