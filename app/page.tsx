"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import {
  Activity, BarChart3, CalendarDays, CheckCircle2, ChevronDown, ClipboardList,
  Clock3, Download, LayoutDashboard, LogOut, Menu, Package, Plus, Search, Settings,
  Users, X, AlertTriangle, Layers, ArrowUpRight, RefreshCw, ClipboardCheck, PackageCheck, History
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Status = "Recebida" | "Em anÃ¡lise" | "Aguardando aprovaÃ§Ã£o" | "Em execuÃ§Ã£o" | "ConcluÃ­da" | "Cancelada";
type Priority = "Baixa" | "MÃ©dia" | "Alta" | "Urgente";
type Area = { id: string; name: string };
type Profile = { id: string; full_name: string; email: string | null; role: "admin" | "gestor" | "colaborador"; area_id: string | null; area_ids?: string[]; active: boolean; stock_manager: boolean };
type Task = { id: string; protocol: number; title: string; area: string; areaId: string; owner: string; requester: string; requesterId: string; priority: Priority; status: Status; due: string; created: string; completedAt: string | null; description: string; ownerId: string | null };
type AreaMember = { profile_id: string; full_name: string };
type Material = {
  id: string;
  sku: string | null;
  name: string;
  description: string | null;
  unit: string;
  quantity: number;
  minimum_quantity: number;
  active: boolean;
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
type MaterialOrderStatus = "aguardando_aprovacao_gestor" | "aguardando_aprovacao_estoque" | "em_separacao" | "aguardando_retirada" | "concluido" | "rejeitado_gestor" | "rejeitado_estoque" | "cancelado";
type MaterialOrder = { id:string; protocol:number; requester_id:string; area_id:string; purpose:string; needed_by:string; status:MaterialOrderStatus; manager_approver_id:string|null; stock_approver_id:string|null; rejection_reason:string|null; created_at:string; updated_at:string };
type MaterialOrderItem = { id:string; order_id:string; material_id:string; quantity:number; material?:{name:string;unit:string;sku:string|null} };
type MaterialOrderHistory = { id:string; order_id:string; actor_id:string|null; action:string; previous_status:string|null; new_status:string|null; details:string|null; created_at:string; actor_name?:string };

const statusToDb: Record<Status,string> = { "Recebida":"recebida", "Em anÃ¡lise":"em_analise", "Aguardando aprovaÃ§Ã£o":"aguardando_aprovacao", "Em execuÃ§Ã£o":"em_execucao", "ConcluÃ­da":"concluida", "Cancelada":"cancelada" };
const dbToStatus: Record<string,Status> = { recebida:"Recebida", em_analise:"Em anÃ¡lise", aguardando_aprovacao:"Aguardando aprovaÃ§Ã£o", em_execucao:"Em execuÃ§Ã£o", concluida:"ConcluÃ­da", cancelada:"Cancelada" };
const priorityToDb: Record<Priority,string> = { "Baixa":"baixa", "MÃ©dia":"media", "Alta":"alta", "Urgente":"urgente" };
const dbToPriority: Record<string,Priority> = { baixa:"Baixa", media:"MÃ©dia", alta:"Alta", urgente:"Urgente" };
const statusClass: Record<Status,string> = { "Recebida":"gray", "Em anÃ¡lise":"blue", "Aguardando aprovaÃ§Ã£o":"amber", "Em execuÃ§Ã£o":"violet", "ConcluÃ­da":"green", "Cancelada":"red" };
const defaultAreas = ["CriaÃ§Ã£o","Trade Marketing","Eventos e AÃ§Ãµes","Materiais e Estoque","E-commerce","Planejamento e Marketing","Social Media"];

export default function Home() {
  const [session,setSession] = useState<Session|null>(null);
  const [authLoading,setAuthLoading] = useState(true);
  const [email,setEmail] = useState("");
  const [password,setPassword] = useState("");
  const [loginLoading,setLoginLoading] = useState(false);
  const [loginError,setLoginError] = useState("");
  const [profile,setProfile] = useState<Profile|null>(null);
  const [areas,setAreas] = useState<Area[]>([]);
  const [tasks,setTasks] = useState<Task[]>([]);
  const [members,setMembers] = useState<Profile[]>([]);
  const [areaMembers,setAreaMembers] = useState<AreaMember[]>([]);
  const [selectedAreaMembers,setSelectedAreaMembers] = useState<AreaMember[]>([]);
  const [dataLoading,setDataLoading] = useState(false);
  const [dataError,setDataError] = useState("");
  const [active,setActive] = useState("Dashboard");
  const [search,setSearch] = useState("");
  const [requestUserFilter,setRequestUserFilter] = useState("Todos");
  const [scheduleOwnerFilter,setScheduleOwnerFilter] = useState("Todos");
  const [scheduleAreaFilter,setScheduleAreaFilter] = useState("Todas");
  const [scheduleStatusFilter,setScheduleStatusFilter] = useState("Todos");
  const [schedulePeriod,setSchedulePeriod] = useState("all");
  const [scheduleStartDate,setScheduleStartDate] = useState("");
  const [scheduleEndDate,setScheduleEndDate] = useState("");
  const [reportDateMode,setReportDateMode] = useState<"created"|"completed"|"due">("created");
  const [reportPeriod,setReportPeriod] = useState("all");
  const [reportStartDate,setReportStartDate] = useState("");
  const [reportEndDate,setReportEndDate] = useState("");
  const [reportAreaFilter,setReportAreaFilter] = useState("Todas");
  const [reportOwnerFilter,setReportOwnerFilter] = useState("Todos");
  const [reportStatusFilter,setReportStatusFilter] = useState("Todos");
  const [dashboardDateMode,setDashboardDateMode] = useState<"created"|"completed"|"due">("created");
  const [dashboardPeriod,setDashboardPeriod] = useState("all");
  const [dashboardStart,setDashboardStart] = useState("");
  const [dashboardEnd,setDashboardEnd] = useState("");
  const [showNew,setShowNew] = useState(false);
  const [mobileMenu,setMobileMenu] = useState(false);
  const [selected,setSelected] = useState<Task|null>(null);
  const [selectedMember,setSelectedMember] = useState<Profile|null>(null);
  const [memberSaving,setMemberSaving] = useState(false);
  const [memberMessage,setMemberMessage] = useState("");
  const [memberTaskStatus,setMemberTaskStatus] = useState("Todas");
  const [deleteConfirm,setDeleteConfirm] = useState(false);
  const [deletingTask,setDeletingTask] = useState(false);
  const [completeConfirm,setCompleteConfirm] = useState(false);
  const [memberForm,setMemberForm] = useState({full_name:"",role:"colaborador" as Profile["role"],area_ids:[] as string[],active:true,stock_manager:false});
  const [saving,setSaving] = useState(false);
  const [form,setForm] = useState({title:"",areaId:"",ownerId:"",priority:"MÃ©dia" as Priority,due:"",description:""});
  const isManager = profile?.role === "admin" || profile?.role === "gestor";
  const canManageStock = profile?.role === "admin" || profile?.stock_manager === true;

  const [stockMaterials,setStockMaterials] = useState<Material[]>([]);
  const [stockMovements,setStockMovements] = useState<StockMovement[]>([]);
  const [stockLoading,setStockLoading] = useState(false);
  const [stockError,setStockError] = useState("");
  const [stockSaving,setStockSaving] = useState(false);
  const [showNewMaterial,setShowNewMaterial] = useState(false);
  const [showStockMovement,setShowStockMovement] = useState(false);
  const [stockSearch,setStockSearch] = useState("");
  const [stockReportMaterial,setStockReportMaterial] = useState("Todos");
  const [stockReportType,setStockReportType] = useState("Todos");
  const [stockReportStart,setStockReportStart] = useState("");
  const [stockReportEnd,setStockReportEnd] = useState("");
  const [materialForm,setMaterialForm] = useState({name:"",sku:"",description:"",unit:"un",minimum_quantity:"0"});
  const [movementForm,setMovementForm] = useState({material_id:"",movement_type:"entrada" as StockMovement["movement_type"],quantity:"",request_id:"",notes:""});
  const [materialOrders,setMaterialOrders] = useState<MaterialOrder[]>([]);
  const [materialOrderItems,setMaterialOrderItems] = useState<MaterialOrderItem[]>([]);
  const [materialOrderHistory,setMaterialOrderHistory] = useState<MaterialOrderHistory[]>([]);
  const [ordersLoading,setOrdersLoading] = useState(false);
  const [ordersSaving,setOrdersSaving] = useState(false);
  const [ordersError,setOrdersError] = useState("");
  const [showNewMaterialOrder,setShowNewMaterialOrder] = useState(false);
  const [selectedMaterialOrder,setSelectedMaterialOrder] = useState<string|null>(null);
  const [orderAreaId,setOrderAreaId] = useState("");
  const [orderPurpose,setOrderPurpose] = useState("");
  const [orderNeededBy,setOrderNeededBy] = useState("");
  const [orderDraftItems,setOrderDraftItems] = useState<{material_id:string;quantity:string}[]>([{material_id:"",quantity:"1"}]);

  useEffect(() => {
    if (!supabase) { setAuthLoading(false); setLoginError("As variÃ¡veis do Supabase nÃ£o foram encontradas. Confira o arquivo .env.local e reinicie o servidor."); return; }
    supabase.auth.getSession().then(({data}) => { setSession(data.session); setAuthLoading(false); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event,nextSession) => { setSession(nextSession); setProfile(null); });
    return () => listener.subscription.unsubscribe();
  },[]);

  const loadData = useCallback(async (user: User) => {
    if (!supabase) return;
    setDataLoading(true); setDataError("");
    try {
      const profileResult = await supabase.from("profiles").select("id,full_name,email,role,area_id,active,stock_manager").eq("id",user.id).single();
      if (profileResult.error) throw profileResult.error;
      if (!profileResult.data.active) throw new Error("Seu usuÃ¡rio estÃ¡ inativo. Procure o administrador do sistema.");
      const p = profileResult.data as Profile;
      const [areaResult, requestResult, memberResult, profileAreasResult] = await Promise.all([
        supabase.from("areas").select("id,name").eq("active",true).order("name"),
        supabase.from("requests").select("id,protocol,title,description,area_id,requester_id,owner_id,priority,status,due_date,created_at,completed_at,deleted_at, area:areas!requests_area_id_fkey(name), owner:profiles!requests_owner_id_fkey(full_name), requester:profiles!requests_requester_id_fkey(full_name)").is("deleted_at",null).order("created_at",{ascending:false}),
        supabase.from("profiles").select("id,full_name,email,role,area_id,active,stock_manager").eq("active",true).order("full_name"),
        supabase.from("profile_areas").select("profile_id,area_id")
      ]);
      if (areaResult.error) throw areaResult.error;
      if (requestResult.error) throw requestResult.error;
      if (memberResult.error && (p.role === "admin" || p.role === "gestor")) throw memberResult.error;
      if (profileAreasResult.error) throw profileAreasResult.error;
      const areaLinks = (profileAreasResult.data || []) as {profile_id:string;area_id:string}[];
      const idsForProfile = (id:string) => areaLinks.filter(link => link.profile_id === id).map(link => link.area_id);
      setProfile({...p, area_ids: idsForProfile(p.id)});
      setAreas((areaResult.data||[]) as Area[]);
      setMembers(((memberResult.data||[]) as Profile[]).map(member => ({...member, area_ids: idsForProfile(member.id)})));
      const mapped = (requestResult.data||[]).map((r:any):Task => ({
        id:r.id, protocol:Number(r.protocol), title:r.title, area:r.area?.name||"Ãrea nÃ£o definida", areaId:r.area_id,
        owner:r.owner?.full_name||"NÃ£o atribuÃ­do", ownerId:r.owner_id, requester:r.requester?.full_name||"Solicitante", requesterId:r.requester_id,
        priority:dbToPriority[r.priority]||"MÃ©dia", status:dbToStatus[r.status]||"Recebida",
        due:r.due_date, created:r.created_at?.slice(0,10)||"", completedAt:r.completed_at||null, description:r.description||""
      }));
      setTasks(mapped);
    } catch (error:any) {
      setDataError(error.message || "NÃ£o foi possÃ­vel carregar os dados do Supabase.");
    } finally { setDataLoading(false); }
  },[]);

  const loadStock = useCallback(async () => {
    if (!supabase) return;
    setStockLoading(true);
    setStockError("");
    try {
      const { data: materialsData, error: materialsError } = await supabase
        .from("materials")
        .select("id,sku,name,description,unit,quantity,minimum_quantity,active")
        .eq("active", true)
        .order("name");
      if (materialsError) throw materialsError;
      const materialRows = (materialsData || []) as Material[];
      setStockMaterials(materialRows);

      if (canManageStock) {
        const { data: movementsData, error: movementsError } = await supabase
          .from("stock_movements")
          .select("id,material_id,request_id,material_order_id,movement_type,quantity,responsible_id,notes,created_at")
          .order("created_at", { ascending: false });
        if (movementsError) throw movementsError;
        setStockMovements((movementsData || []) as StockMovement[]);
      } else {
        setStockMovements([]);
      }

      setMovementForm(old => ({
        ...old,
        material_id: old.material_id && materialRows.some(m => m.id === old.material_id)
          ? old.material_id
          : materialRows[0]?.id || ""
      }));
    } catch (error:any) {
      setStockError(error.message || "NÃ£o foi possÃ­vel carregar o estoque.");
    } finally {
      setStockLoading(false);
    }
  },[canManageStock]);

  const loadMaterialOrders = useCallback(async () => {
    if (!supabase) return;
    setOrdersLoading(true);
    setOrdersError("");
    try {
      const [ordersResult, materialsResult] = await Promise.all([
        supabase.from("material_orders").select("*").order("created_at",{ascending:false}),
        supabase.from("materials").select("id,sku,name,description,unit,quantity,minimum_quantity,active").eq("active",true).order("name")
      ]);
      if (ordersResult.error) throw ordersResult.error;
      if (materialsResult.error) throw materialsResult.error;
      const rows = (ordersResult.data || []) as MaterialOrder[];
      setMaterialOrders(rows);
      setStockMaterials((materialsResult.data || []) as Material[]);
      if (!rows.length) {
        setMaterialOrderItems([]);
        setMaterialOrderHistory([]);
      } else {
        const ids = rows.map(order=>order.id);
        const [itemsResult,historyResult] = await Promise.all([
          supabase.from("material_order_items").select("id,order_id,material_id,quantity,material:materials(name,unit,sku)").in("order_id",ids),
          supabase.from("material_order_history").select("id,order_id,actor_id,action,previous_status,new_status,details,created_at").in("order_id",ids).order("created_at",{ascending:false})
        ]);
        if (itemsResult.error) throw itemsResult.error;
        if (historyResult.error) throw historyResult.error;
        const historyRows = (historyResult.data || []) as MaterialOrderHistory[];
        const actorIds = [...new Set(historyRows.map(item=>item.actor_id).filter(Boolean))] as string[];
        let actorMap:Record<string,string> = {};
        if (actorIds.length) {
          const {data:actors,error:actorsError} = await supabase.from("profiles").select("id,full_name").in("id",actorIds);
          if (!actorsError) actorMap = Object.fromEntries((actors||[]).map((actor:any)=>[actor.id,actor.full_name]));
        }
        setMaterialOrderItems((itemsResult.data || []).map((item: any) => ({
          ...item,
          material: Array.isArray(item.material)
            ? item.material[0] ?? undefined
            : item.material
        })) as MaterialOrderItem[]);
        setMaterialOrderHistory(historyRows.map(item=>({...item,actor_name:item.actor_id?(actorMap[item.actor_id]||"UsuÃ¡rio"):"Sistema"})));
      }
    } catch (error:any) {
      setOrdersError(error.message || "NÃ£o foi possÃ­vel carregar os pedidos de materiais.");
    } finally {
      setOrdersLoading(false);
    }
  },[]);

  useEffect(() => { if (session?.user) loadData(session.user); },[session,loadData]);
  useEffect(() => { if (active === "Estoque" && profile) loadStock(); },[active,profile,loadStock]);
  useEffect(() => { if (active === "Pedidos de Materiais" && profile) loadMaterialOrders(); },[active,profile,loadMaterialOrders]);
  useEffect(() => { setDeleteConfirm(false); setCompleteConfirm(false); }, [selected?.id]);
  useEffect(() => { if (areas.length && !form.areaId) setForm(old=>({...old,areaId:areas[0].id})); },[areas,form.areaId]);

  useEffect(() => {
    let active = true;
    async function loadAreaMembers() {
      if (!supabase || !form.areaId) {
        setAreaMembers([]);
        return;
      }
      setAreaMembers([]);
      setForm(old => old.areaId === form.areaId ? { ...old, ownerId: "" } : old);
      const { data, error } = await supabase.rpc("get_area_members", { target_area: form.areaId });
      if (!active) return;
      if (error) {
        setAreaMembers([]);
        setDataError(`NÃ£o foi possÃ­vel carregar os responsÃ¡veis da Ã¡rea: ${error.message}`);
        return;
      }
      const available = (data || []) as AreaMember[];
      setAreaMembers(available);
      setForm(old => {
        if (old.areaId !== form.areaId) return old;
        if (available.length === 1) return { ...old, ownerId: available[0].profile_id };
        return { ...old, ownerId: "" };
      });
    }
    loadAreaMembers();
    return () => { active = false; };
  }, [form.areaId]);

  useEffect(() => {
    let active = true;
    async function loadSelectedAreaMembers() {
      if (!supabase || !selected?.areaId || !isManager) {
        setSelectedAreaMembers([]);
        return;
      }
      const { data, error } = await supabase.rpc("get_area_members", { target_area: selected.areaId });
      if (!active) return;
      if (error) {
        setSelectedAreaMembers([]);
        setDataError(`NÃ£o foi possÃ­vel carregar os responsÃ¡veis da solicitaÃ§Ã£o: ${error.message}`);
        return;
      }
      setSelectedAreaMembers((data || []) as AreaMember[]);
    }
    loadSelectedAreaMembers();
    return () => { active = false; };
  }, [selected?.areaId, isManager]);

  async function signIn(e:FormEvent) {
    e.preventDefault(); if (!supabase) return;
    setLoginLoading(true); setLoginError("");
    const {error} = await supabase.auth.signInWithPassword({email:email.trim(),password});
    if (error) setLoginError(error.message === "Invalid login credentials" ? "E-mail ou senha incorretos." : error.message);
    setLoginLoading(false);
  }
  async function signOut() { if (supabase) await supabase.auth.signOut(); setTasks([]); setMembers([]); setProfile(null); }

  const filtered = useMemo(() => tasks.filter(t => {
    const matchesSearch = [t.title,t.owner,t.area,t.status,String(t.protocol)].join(" ").toLowerCase().includes(search.toLowerCase());
    const matchesUser = requestUserFilter === "Todos"
      || (requestUserFilter === "Sem responsÃ¡vel" && !t.ownerId)
      || t.ownerId === requestUserFilter;
    return matchesSearch && matchesUser;
  }),[tasks,search,requestUserFilter]);
  const requestUsers = useMemo(() => {
    const unique = new Map<string,string>();
    tasks.forEach(task => { if (task.ownerId) unique.set(task.ownerId, task.owner); });
    return [...unique.entries()].sort((a,b) => a[1].localeCompare(b[1], "pt-BR"));
  },[tasks]);
  const dashboardDateRange = useMemo(() => {
    const now = new Date();
    const localDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
    if (dashboardPeriod === "month") return { start: localDate(new Date(now.getFullYear(),now.getMonth(),1)), end: localDate(new Date(now.getFullYear(),now.getMonth()+1,0)) };
    if (dashboardPeriod === "30") { const start = new Date(now); start.setDate(start.getDate()-29); return { start: localDate(start), end: localDate(now) }; }
    if (dashboardPeriod === "90") { const start = new Date(now); start.setDate(start.getDate()-89); return { start: localDate(start), end: localDate(now) }; }
    if (dashboardPeriod === "year") return { start: `${now.getFullYear()}-01-01`, end: `${now.getFullYear()}-12-31` };
    if (dashboardPeriod === "custom") return { start: dashboardStart, end: dashboardEnd };
    return { start: "", end: "" };
  },[dashboardPeriod,dashboardStart,dashboardEnd]);
  const dashboardTasks = useMemo(() => {
    if (dashboardPeriod === "all") return tasks;
    const {start,end} = dashboardDateRange;
    if (!start || !end || start > end) return [];
    return tasks.filter(task => {
      const rawDate = dashboardDateMode === "created" ? task.created : dashboardDateMode === "due" ? task.due : task.completedAt?.slice(0,10) || "";
      return !!rawDate && rawDate >= start && rawDate <= end;
    });
  },[tasks,dashboardPeriod,dashboardDateRange,dashboardDateMode]);
  const dashboardDateLabel = dashboardDateMode === "created" ? "data de abertura" : dashboardDateMode === "due" ? "data do prazo" : "data de conclusÃ£o";
  const late = tasks.filter(t => t.status!=="ConcluÃ­da" && t.status!=="Cancelada" && t.due && new Date(t.due+"T23:59:00") < new Date()).length;
  const done = tasks.filter(t=>t.status==="ConcluÃ­da").length;
  const inProgress = tasks.filter(t=>t.status==="Em execuÃ§Ã£o"||t.status==="Em anÃ¡lise"||t.status==="Aguardando aprovaÃ§Ã£o").length;
  const areaNames = areas.length ? areas.map(a=>a.name) : defaultAreas;
  const dashboardLate = dashboardTasks.filter(t => t.status!=="ConcluÃ­da" && t.status!=="Cancelada" && t.due && new Date(t.due+"T23:59:00") < new Date()).length;
  const dashboardDone = dashboardTasks.filter(t=>t.status==="ConcluÃ­da").length;
  const dashboardInProgress = dashboardTasks.filter(t=>t.status==="Em execuÃ§Ã£o"||t.status==="Em anÃ¡lise"||t.status==="Aguardando aprovaÃ§Ã£o").length;
  const requestsByOwner = useMemo(() => {
    const grouped = new Map<string,{id:string;name:string;total:number;inProgress:number;done:number;late:number;cancelled:number}>();
    dashboardTasks.forEach(task => {
      if (!task.ownerId) return;
      const current = grouped.get(task.ownerId) || {id:task.ownerId,name:task.owner,total:0,inProgress:0,done:0,late:0,cancelled:0};
      current.total += 1;
      if (task.status === "Em anÃ¡lise" || task.status === "Aguardando aprovaÃ§Ã£o" || task.status === "Em execuÃ§Ã£o") current.inProgress += 1;
      if (task.status === "ConcluÃ­da") current.done += 1;
      if (task.status === "Cancelada") current.cancelled += 1;
      if (task.status !== "ConcluÃ­da" && task.status !== "Cancelada" && task.due && new Date(task.due+"T23:59:00") < new Date()) current.late += 1;
      grouped.set(task.ownerId,current);
    });
    return [...grouped.values()].sort((a,b)=>b.total-a.total || a.name.localeCompare(b.name,"pt-BR"));
  },[dashboardTasks]);
  const reportDateRange = useMemo(() => {
    const now = new Date();
    const localDate = (date:Date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
    if (reportPeriod === "month") return {start:localDate(new Date(now.getFullYear(),now.getMonth(),1)),end:localDate(new Date(now.getFullYear(),now.getMonth()+1,0))};
    if (reportPeriod === "30" || reportPeriod === "90") { const start=new Date(now); start.setDate(start.getDate()-Number(reportPeriod)+1); return {start:localDate(start),end:localDate(now)}; }
    if (reportPeriod === "year") return {start:`${now.getFullYear()}-01-01`,end:`${now.getFullYear()}-12-31`};
    if (reportPeriod === "custom") return {start:reportStartDate,end:reportEndDate};
    return {start:"",end:""};
  },[reportPeriod,reportStartDate,reportEndDate]);
  const reportTasks = useMemo(() => tasks.filter(task => {
    if (reportAreaFilter !== "Todas" && task.areaId !== reportAreaFilter) return false;
    if (reportOwnerFilter === "Sem responsÃ¡vel" && task.ownerId) return false;
    if (reportOwnerFilter !== "Todos" && reportOwnerFilter !== "Sem responsÃ¡vel" && task.ownerId !== reportOwnerFilter) return false;
    if (reportStatusFilter !== "Todos" && task.status !== reportStatusFilter) return false;
    if (reportPeriod === "all") return true;
    const {start,end}=reportDateRange;
    if (!start || !end || start > end) return false;
    const rawDate = reportDateMode === "created" ? task.created : reportDateMode === "due" ? task.due : task.completedAt?.slice(0,10) || "";
    return !!rawDate && rawDate >= start && rawDate <= end;
  }),[tasks,reportAreaFilter,reportOwnerFilter,reportStatusFilter,reportPeriod,reportDateRange,reportDateMode]);
  const reportToday = (() => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; })();
  const reportReceived = reportTasks.filter(t=>t.status==="Recebida").length;
  const reportAnalysis = reportTasks.filter(t=>t.status==="Em anÃ¡lise").length;
  const reportAwaitingApproval = reportTasks.filter(t=>t.status==="Aguardando aprovaÃ§Ã£o").length;
  const reportExecuting = reportTasks.filter(t=>t.status==="Em execuÃ§Ã£o").length;
  const reportDone = reportTasks.filter(t=>t.status==="ConcluÃ­da").length;
  const reportLate = reportTasks.filter(t=>t.status!=="ConcluÃ­da"&&t.status!=="Cancelada"&&t.due&&t.due<reportToday).length;
  const reportOpenBase = reportTasks.filter(t=>t.status!=="ConcluÃ­da"&&t.status!=="Cancelada").length;
  const reportOverdueRate = reportOpenBase ? Math.round(reportLate/reportOpenBase*100) : 0;
  const reportCancelled = reportTasks.filter(t=>t.status==="Cancelada").length;
  const reportCompletionBase = reportTasks.filter(t=>t.status!=="Cancelada").length;
  const reportCompletionRate = reportCompletionBase ? Math.round(reportDone/reportCompletionBase*100) : 0;
  const reportByArea = areaNames.map(name=>({name,total:reportTasks.filter(t=>t.area===name).length})).filter(x=>x.total>0).sort((a,b)=>b.total-a.total);
  const reportByOwner = (() => {
    const grouped = new Map<string,{id:string;name:string;total:number;done:number;inProgress:number;late:number}>();
    reportTasks.forEach(task=>{const key=task.ownerId||"unassigned";const item=grouped.get(key)||{id:key,name:task.ownerId?task.owner:"Sem responsÃ¡vel",total:0,done:0,inProgress:0,late:0};item.total++;if(task.status==="ConcluÃ­da")item.done++;if(task.status==="Em execuÃ§Ã£o"||task.status==="Em anÃ¡lise"||task.status==="Aguardando aprovaÃ§Ã£o")item.inProgress++;if(task.status!=="ConcluÃ­da"&&task.status!=="Cancelada"&&task.due&&new Date(task.due+"T23:59:00")<new Date())item.late++;grouped.set(key,item);});
    return [...grouped.values()].sort((a,b)=>b.total-a.total||a.name.localeCompare(b.name,"pt-BR"));
  })();
  const reportDateLabel = reportDateMode==="created"?"data de abertura":reportDateMode==="completed"?"data de conclusÃ£o":"data do prazo";
  const exportReports = () => {
    const csvCell = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const periodLabel = ({all:"Todo o período",month:"Este mês","30":"Últimos 30 dias","90":"Últimos 90 dias",year:"Este ano",custom:"Personalizado"} as Record<string,string>)[reportPeriod] || reportPeriod;
    const formatDate = (value:string) => value ? new Date(value+"T12:00:00").toLocaleDateString("pt-BR") : "—";
    const rows: string[][] = [
      ["RELATÓRIO GERENCIAL"],
      ["Critério da data",reportDateLabel],
      ["Período",periodLabel],
      ["Data inicial",reportPeriod==="custom"?formatDate(reportStartDate):"—"],
      ["Data final",reportPeriod==="custom"?formatDate(reportEndDate):"—"],
      ["Área",reportAreaFilter==="Todas"?"Todas as áreas":areas.find(area=>area.id===reportAreaFilter)?.name||"Área selecionada"],
      ["Responsável",reportOwnerFilter==="Todos"?"Todos os colaboradores":reportOwnerFilter==="Sem responsável"?"Sem responsável":requestUsers.find(([id])=>id===reportOwnerFilter)?.[1]||"Responsável selecionado"],
      ["Status",reportStatusFilter],
      [],
      ["INDICADORES"],
      ["Indicador","Quantidade / percentual"],
      ["Total de solicitações",String(reportTasks.length)],
      ["Recebidas",String(reportReceived)],
      ["Em análise",String(reportAnalysis)],
      ["Aguardando aprovação",String(reportAwaitingApproval)],
      ["Em execução",String(reportExecuting)],
      ["Concluídas",String(reportDone)],
      ["Canceladas",String(reportCancelled)],
      ["Atrasadas",String(reportLate)],
      ["Taxa de conclusão",reportCompletionRate+"%"],
      ["Taxa de atraso",reportOverdueRate+"%"],
      [],
      ["DISTRIBUIÇÃO POR ÁREA"],
      ["Área","Solicitações"],
      ...reportByArea.map(item=>[item.name,String(item.total)]),
      [],
      ["DESEMPENHO DA EQUIPE"],
      ["Responsável","Total","Concluídas","Em andamento","Atrasadas"],
      ...reportByOwner.map(person=>[person.name,String(person.total),String(person.done),String(person.inProgress),String(person.late)]),
      [],
      ["DETALHAMENTO DAS SOLICITAÇÕES"],
      ["Protocolo","Solicitação","Área","Responsável","Solicitante","Prioridade","Status","Data de abertura","Prazo","Data de conclusão"],
      ...[...reportTasks].sort((a,b)=>b.created.localeCompare(a.created)).map(task=>[
        String(task.protocol),task.title,task.area,task.owner,task.requester,task.priority,task.status,
        formatDate(task.created),formatDate(task.due),formatDate(task.completedAt?.slice(0,10)||"")
      ])
    ];
    const csv = "\uFEFF" + rows.map(row=>row.map(csvCell).join(";")).join("\r\n");
    const blob = new Blob([csv],{type:"text/csv;charset=utf-8;"});
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `relatorio-gerencial-${reportToday}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };
  const scheduleToday = (() => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; })();
  const scheduleTasks = useMemo(() => tasks.filter(task => {
    if (scheduleOwnerFilter === "Sem responsÃ¡vel" && task.ownerId) return false;
    if (scheduleOwnerFilter !== "Todos" && scheduleOwnerFilter !== "Sem responsÃ¡vel" && task.ownerId !== scheduleOwnerFilter) return false;
    if (scheduleAreaFilter !== "Todas" && task.areaId !== scheduleAreaFilter) return false;
    if (scheduleStatusFilter !== "Todos" && task.status !== scheduleStatusFilter) return false;
    if (schedulePeriod === "overdue") return task.status !== "ConcluÃ­da" && task.status !== "Cancelada" && !!task.due && task.due < scheduleToday;
    if (schedulePeriod === "custom") {
      if (!task.due) return false;
      if (scheduleStartDate && task.due < scheduleStartDate) return false;
      if (scheduleEndDate && task.due > scheduleEndDate) return false;
      return true;
    }
    if (schedulePeriod === "7" || schedulePeriod === "30") {
      const limit = new Date(); limit.setDate(limit.getDate() + Number(schedulePeriod));
      const end = `${limit.getFullYear()}-${String(limit.getMonth()+1).padStart(2,"0")}-${String(limit.getDate()).padStart(2,"0")}`;
      return !!task.due && task.due >= scheduleToday && task.due <= end && task.status !== "ConcluÃ­da" && task.status !== "Cancelada";
    }
    return true;
  }).sort((a,b) => (a.due || "9999-99-99").localeCompare(b.due || "9999-99-99")), [tasks,scheduleOwnerFilter,scheduleAreaFilter,scheduleStatusFilter,schedulePeriod,scheduleStartDate,scheduleEndDate,scheduleToday]);
  const scheduleOverdueCount = tasks.filter(t=>t.status!=="ConcluÃ­da"&&t.status!=="Cancelada"&&t.due&&t.due<scheduleToday).length;
  const scheduleTodayCount = tasks.filter(t=>t.status!=="ConcluÃ­da"&&t.status!=="Cancelada"&&t.due===scheduleToday).length;
  const scheduleNextSevenCount = tasks.filter(t=>t.status!=="ConcluÃ­da"&&t.status!=="Cancelada"&&t.due&&t.due>=scheduleToday&&t.due<=(()=>{const d=new Date();d.setDate(d.getDate()+7);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`})()).length;
  const selectedMemberTasks = useMemo(() => selectedMember ? tasks.filter(t => t.ownerId === selectedMember.id) : [], [tasks, selectedMember]);
  const visibleMemberTasks = useMemo(() => memberTaskStatus === "Todas" ? selectedMemberTasks : selectedMemberTasks.filter(t => t.status === memberTaskStatus), [selectedMemberTasks, memberTaskStatus]);
  const memberTasksLate = selectedMemberTasks.filter(t => t.status !== "ConcluÃ­da" && t.status !== "Cancelada" && t.due && new Date(t.due + "T23:59:00") < new Date()).length;
  const memberTasksInProgress = selectedMemberTasks.filter(t => t.status === "Em execuÃ§Ã£o" || t.status === "Em anÃ¡lise" || t.status === "Aguardando aprovaÃ§Ã£o").length;
  const memberTasksDone = selectedMemberTasks.filter(t => t.status === "ConcluÃ­da").length;
  const filteredMaterials = useMemo(() => stockMaterials.filter(m =>
    [m.name,m.sku || "",m.description || ""].join(" ").toLowerCase().includes(stockSearch.toLowerCase())
  ),[stockMaterials,stockSearch]);
  const reservedByMaterial = useMemo(() => {
    const totals: Record<string,number> = {};
    stockMovements.forEach(m => {
      const sign = m.movement_type === "reserva" ? 1 : m.movement_type === "cancelamento_reserva" ? -1 : 0;
      if (sign) totals[m.material_id] = (totals[m.material_id] || 0) + sign * Number(m.quantity);
    });
    return totals;
  },[stockMovements]);
  const stockMovementSummary = useMemo(() => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recent = stockMovements.filter(m => new Date(m.created_at).getTime() >= cutoff);
    const count = (type: StockMovement["movement_type"]) => recent.filter(m => m.movement_type === type).length;
    return {
      total: recent.length,
      entries: count("entrada"),
      exits: count("saida"),
      reservations: count("reserva"),
      reservationCancellations: count("cancelamento_reserva"),
      adjustments: count("ajuste")
    };
  },[stockMovements]);
  const filteredStockMovements = useMemo(() => stockMovements.filter(movement => {
    if (stockReportMaterial !== "Todos" && movement.material_id !== stockReportMaterial) return false;
    if (stockReportType !== "Todos" && movement.movement_type !== stockReportType) return false;
    const movementDate = movement.created_at.slice(0,10);
    if (stockReportStart && movementDate < stockReportStart) return false;
    if (stockReportEnd && movementDate > stockReportEnd) return false;
    return true;
  }),[stockMovements,stockReportMaterial,stockReportType,stockReportStart,stockReportEnd]);
  const stockReportSummary = useMemo(() => {
    const count = (type: StockMovement["movement_type"]) => filteredStockMovements.filter(movement => movement.movement_type === type).length;
    return {
      total: filteredStockMovements.length,
      entries: count("entrada"),
      exits: count("saida"),
      adjustments: count("ajuste"),
      reservations: count("reserva") + count("cancelamento_reserva")
    };
  },[filteredStockMovements]);
  const stockAlerts = useMemo(() => stockMaterials
    .map(material => {
      const reserved = reservedByMaterial[material.id] || 0;
      const available = Number(material.quantity) - reserved;
      const minimum = Number(material.minimum_quantity);
      if (available <= 0) return { material, reserved, available, minimum, level: "critical" as const, label: "Sem saldo disponível" };
      if (available < minimum) return { material, reserved, available, minimum, level: "warning" as const, label: "Abaixo do mínimo" };
      if (available === minimum) return { material, reserved, available, minimum, level: "limit" as const, label: "No limite mínimo" };
      return null;
    })
    .filter((alert): alert is NonNullable<typeof alert> => alert !== null)
    .sort((a,b) => {
      const priority = { critical: 0, warning: 1, limit: 2 };
      return priority[a.level] - priority[b.level] || a.material.name.localeCompare(b.material.name, "pt-BR");
    }),[stockMaterials,reservedByMaterial]);
  const myOrderAreas = profile?.role === "admin" ? areas : areas.filter(area => (profile?.area_ids||[]).includes(area.id) || profile?.area_id === area.id);
  const orderAreaName = (id:string) => areas.find(area=>area.id===id)?.name || "Ãrea nÃ£o identificada";
  const orderRequesterName = (id:string) => members.find(member=>member.id===id)?.full_name || (id===profile?.id?profile.full_name:"Solicitante");
  const orderStatusLabels:Record<MaterialOrderStatus,string> = {
    aguardando_aprovacao_gestor:"Aguardando aprovaÃ§Ã£o do gestor",
    aguardando_aprovacao_estoque:"Aguardando aprovaÃ§Ã£o do estoque",
    em_separacao:"Em separaÃ§Ã£o",
    aguardando_retirada:"Aguardando retirada",
    concluido:"ConcluÃ­do",
    rejeitado_gestor:"Rejeitado pelo gestor",
    rejeitado_estoque:"Rejeitado pelo estoque",
    cancelado:"Cancelado"
  };
  const selectedOrder = materialOrders.find(order=>order.id===selectedMaterialOrder) || null;
  const selectedOrderItems = materialOrderItems.filter(item=>item.order_id===selectedMaterialOrder);
  const selectedOrderHistory = materialOrderHistory.filter(item=>item.order_id===selectedMaterialOrder);
  const pendingManagerOrders = materialOrders.filter(order=>order.status==="aguardando_aprovacao_gestor").length;
  const pendingStockOrders = materialOrders.filter(order=>order.status==="aguardando_aprovacao_estoque").length;
  const activeMaterialOrders = materialOrders.filter(order=>["em_separacao","aguardando_retirada"].includes(order.status)).length;

  async function createMaterialOrder() {
    if (!supabase || !profile) return;
    const cleanItems = orderDraftItems.map(item=>({material_id:item.material_id,quantity:Number(item.quantity)}));
    if (!orderAreaId || !myOrderAreas.some(area=>area.id===orderAreaId)) { setOrdersError("Selecione uma Ã¡rea Ã  qual vocÃª esteja vinculado."); return; }
    if (!orderPurpose.trim()) { setOrdersError("Informe a finalidade do pedido."); return; }
    if (!orderNeededBy) { setOrdersError("Informe quando os materiais serÃ£o necessÃ¡rios."); return; }
    if (!cleanItems.length || cleanItems.some(item=>!item.material_id || !Number.isFinite(item.quantity) || item.quantity<=0)) { setOrdersError("Selecione os materiais e informe quantidades maiores que zero."); return; }
    if (new Set(cleanItems.map(item=>item.material_id)).size!==cleanItems.length) { setOrdersError("Cada material deve aparecer apenas uma vez. Ajuste a quantidade na mesma linha."); return; }
    setOrdersSaving(true); setOrdersError("");
    const {data,error} = await supabase.rpc("create_material_order",{
      p_area_id:orderAreaId,
      p_purpose:orderPurpose.trim(),
      p_needed_by:orderNeededBy,
      p_items:cleanItems
    });
    if (error) setOrdersError(error.message);
    else {
      setShowNewMaterialOrder(false);
      setOrderPurpose(""); setOrderNeededBy(""); setOrderDraftItems([{material_id:"",quantity:"1"}]);
      const result = Array.isArray(data)?data[0]:data;
      setSelectedMaterialOrder(result?.order_id||null);
      await loadMaterialOrders();
    }
    setOrdersSaving(false);
  }

  async function runMaterialOrderAction(functionName:string, orderId:string, reasonRequired=false) {
    if (!supabase) return;
    let reason = "";
    if (reasonRequired) {
      reason = window.prompt(functionName==="cancel_material_order"?"Informe o motivo do cancelamento:":"Informe o motivo da rejeiÃ§Ã£o:")?.trim() || "";
      if (!reason) { setOrdersError("A justificativa Ã© obrigatÃ³ria para esta operaÃ§Ã£o."); return; }
    }
    if (functionName==="complete_material_order" && !window.confirm("Confirmar a entrega? Esta aÃ§Ã£o darÃ¡ baixa no estoque fÃ­sico e encerrarÃ¡ as reservas.")) return;
    setOrdersSaving(true); setOrdersError("");
    const args:any = {p_order_id:orderId};
    if (reasonRequired) args.p_reason=reason;
    const {error} = await supabase.rpc(functionName,args);
    if (error) setOrdersError(error.message);
    else await loadMaterialOrders();
    setOrdersSaving(false);
  }

  async function createTask() {
    if (!supabase || !profile || !form.title.trim() || !form.due || !form.areaId) return;
    if (areaMembers.length === 0) {
      setDataError("A Ã¡rea selecionada nÃ£o possui responsÃ¡veis ativos.");
      return;
    }
    if (areaMembers.length > 1 && !form.ownerId) {
      setDataError("Selecione o responsÃ¡vel pela solicitaÃ§Ã£o.");
      return;
    }
    if (form.ownerId && !areaMembers.some(member => member.profile_id === form.ownerId)) {
      setDataError("O responsÃ¡vel selecionado nÃ£o pertence Ã  Ã¡rea escolhida.");
      return;
    }

    setSaving(true);
    setDataError("");
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      area_id: form.areaId,
      requester_id: profile.id,
      owner_id: form.ownerId || null,
      priority: priorityToDb[form.priority] as any,
      status: "recebida",
      due_date: form.due
    };
    const { error } = await supabase.from("requests").insert(payload);
    if (error) {
      setDataError(error.message);
    } else {
      setShowNew(false);
      setForm(old => ({ ...old, title: "", ownerId: "", priority: "MÃ©dia", due: "", description: "" }));
      if (session?.user) await loadData(session.user);
    }
    setSaving(false);
  }
  async function createMaterial() {
    if (!supabase || !canManageStock) return;
    const name = materialForm.name.trim();
    const minimum = Number(materialForm.minimum_quantity || 0);
    if (!name) { setStockError("Informe o nome do material."); return; }
    if (!Number.isFinite(minimum) || minimum < 0) { setStockError("Informe um estoque mÃ­nimo vÃ¡lido."); return; }

    setStockSaving(true);
    setStockError("");
    const { error } = await supabase.from("materials").insert({
      name,
      sku: materialForm.sku.trim() || null,
      description: materialForm.description.trim() || null,
      unit: materialForm.unit.trim() || "un",
      quantity: 0,
      minimum_quantity: minimum,
      active: true
    });
    if (error) {
      setStockError(error.message);
    } else {
      setShowNewMaterial(false);
      setMaterialForm({name:"",sku:"",description:"",unit:"un",minimum_quantity:"0"});
      await loadStock();
    }
    setStockSaving(false);
  }

  async function createStockMovement() {
    if (!supabase || !canManageStock) return;
    const amount = Number(movementForm.quantity);
    if (!movementForm.material_id) { setStockError("Selecione um material."); return; }
    if (!Number.isFinite(amount) || amount < 0 || (movementForm.movement_type !== "ajuste" && amount <= 0)) {
      setStockError(movementForm.movement_type === "ajuste"
        ? "Informe um saldo fÃ­sico contado vÃ¡lido (zero ou maior)."
        : "Informe uma quantidade maior que zero.");
      return;
    }
    setStockSaving(true);
    setStockError("");
    const { data, error } = await supabase.rpc("register_stock_movement", {
      p_material_id: movementForm.material_id,
      p_movement_type: movementForm.movement_type,
      p_quantity: amount,
      p_request_id: null,
      p_notes: movementForm.notes.trim() || null
    });
    if (error) {
      setStockError(error.message);
    } else {
      setShowStockMovement(false);
      setMovementForm(old => ({...old,quantity:"",request_id:"",notes:""}));
      await loadStock();
      if (movementForm.movement_type === "ajuste" && data === null) {
        setStockError("Nenhum ajuste foi necessÃ¡rio: o saldo informado jÃ¡ corresponde ao estoque registrado.");
      }
    }
    setStockSaving(false);
  }

  function exportStockMovements() {
    const labels:Record<string,string> = {entrada:"Entrada",saida:"Saída",reserva:"Reserva",cancelamento_reserva:"Cancelamento de reserva",ajuste:"Ajuste"};
    const rows = filteredStockMovements.map(movement => {
      const material = stockMaterials.find(item => item.id === movement.material_id);
      const request = tasks.find(item => item.id === movement.request_id);
      return [
        new Date(movement.created_at).toLocaleString("pt-BR"),
        material?.name || "Material não encontrado",
        material?.sku || "",
        labels[movement.movement_type] || movement.movement_type,
        Number(movement.quantity).toLocaleString("pt-BR",{maximumFractionDigits:2}) + " " + (material?.unit || ""),
        request ? "Solicitação #" + request.protocol : movement.material_order_id ? "Pedido de materiais" : "Movimentação manual",
        movement.notes || ""
      ];
    });
    const csvCell = (value:string) => '"' + String(value).replace(/"/g,'""') + '"';
    const csv = [["Data","Material","SKU","Tipo","Quantidade","Origem","Observações"],...rows]
      .map(row => row.map(csvCell).join(";")).join("\r\n");
    const blob = new Blob(["\uFEFF",csv],{type:"text/csv;charset=utf-8;"});
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "relatorio-movimentacoes-estoque.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function saveMember() {
    if (!supabase || !selectedMember || profile?.role !== "admin") return;
    setMemberSaving(true); setMemberMessage(""); setDataError("");
    const { error } = await supabase.rpc("admin_update_profile_areas", {
      target_profile: selectedMember.id,
      new_full_name: memberForm.full_name.trim(),
      new_role: memberForm.role,
      new_area_ids: memberForm.area_ids,
      new_active: memberForm.active
    });
    if (error) {
      setMemberMessage(`NÃ£o foi possÃ­vel salvar o cadastro: ${error.message}`);
      setMemberSaving(false);
      return;
    }

    const { error: stockPermissionError } = await supabase.rpc("admin_set_stock_permission", {
      target_profile: selectedMember.id,
      enabled: memberForm.role === "admin" ? false : memberForm.stock_manager
    });

    if (stockPermissionError) {
      setMemberMessage(`O cadastro foi atualizado, mas nÃ£o foi possÃ­vel salvar a permissÃ£o de estoque: ${stockPermissionError.message}`);
      if (session?.user) await loadData(session.user);
      setMemberSaving(false);
      return;
    }

    setMemberMessage("Cadastro e permissÃ£o atualizados com sucesso.");
    if (session?.user) await loadData(session.user);
    setSelectedMember(null);
    setMemberSaving(false);
  }

  async function deleteTask(task:Task) {
    if (!supabase || !profile) return;
    const canDelete = isManager || task.requesterId === profile.id;
    if (!canDelete) {
      setDataError("VocÃª sÃ³ pode excluir solicitaÃ§Ãµes abertas por vocÃª. Gestores e administradores podem excluir qualquer solicitaÃ§Ã£o.");
      return;
    }
    setDeletingTask(true);
    setDataError("");
    const { error } = await supabase.rpc("soft_delete_request", { target_request: task.id });
    if (error) {
      setDataError(`NÃ£o foi possÃ­vel excluir a solicitaÃ§Ã£o: ${error.message}`);
    } else {
      setDeleteConfirm(false);
      setSelected(null);
      if (session?.user) await loadData(session.user);
    }
    setDeletingTask(false);
  }

  async function updateTask(task:Task, patch:Partial<Task>) {
    if (!supabase || !profile) return;

    const canUpdateStatus = isManager || (task.ownerId === profile.id && task.requesterId !== profile.id);
    if (patch.status && !canUpdateStatus) {
      setDataError("Somente o responsÃ¡vel pela demanda ou um gestor pode alterar o status. O solicitante nÃ£o pode alterar o status da prÃ³pria solicitaÃ§Ã£o.");
      return;
    }
    if ((patch.priority !== undefined || patch.ownerId !== undefined) && !isManager) {
      setDataError("Somente gestores e administradores podem alterar a prioridade ou o responsÃ¡vel.");
      return;
    }

    const update:any = {};
    if (patch.status) update.status = statusToDb[patch.status];
    if (patch.priority && isManager) update.priority = priorityToDb[patch.priority];
    if (patch.ownerId !== undefined && isManager) update.owner_id = patch.ownerId;
    if (!Object.keys(update).length) return;

    setDataError("");
    const {error} = await supabase.from("requests").update(update).eq("id",task.id);
    if (error) {
      setDataError(error.message);
    } else {
      setSelected(null);
      if(session?.user) await loadData(session.user);
    }
  }

  if (authLoading) return <div className="authScreen"><div className="authCard"><div className="brandMark"><Layers size={22}/></div><h1>GestÃ£o de Demandas DelRio</h1><p>Verificando sua sessÃ£o...</p></div></div>;
  if (!session) return <div className="authScreen"><form className="authCard" onSubmit={signIn}><div className="authBrand"><div className="brandMark"><Layers size={22}/></div><div><b>DELRIO</b><small>GESTÃƒO DE DEMANDAS</small></div></div><p className="eyebrow">AMBIENTE DE MARKETING</p><h1>Acesse sua conta</h1><p className="authSub">Entre com seu e-mail e senha cadastrados no sistema.</p><label>E-mail<input type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} placeholder="seuemail@delrio.com.br" required/></label><label>Senha<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Digite sua senha" required/></label>{loginError&&<div className="errorBox">{loginError}</div>}<button className="primary authSubmit" disabled={loginLoading}>{loginLoading?"Entrando...":"Entrar"}</button><small className="authFoot">Acesso restrito Ã  equipe autorizada.</small></form></div>;

  const nav = [["Dashboard",LayoutDashboard],["SolicitaÃ§Ãµes",ClipboardList],["Pedidos de Materiais",ClipboardCheck],["Cronograma",CalendarDays],["Colaboradores",Users],["Estoque",Package],["RelatÃ³rios",BarChart3],["ConfiguraÃ§Ãµes",Settings]] as const;
  return <main className="shell">
    <aside className={`sidebar ${mobileMenu?"open":""}`}>
      <div className="brand"><div className="brandMark"><Layers size={21}/></div><div><b>DELRIO</b><small>GESTÃƒO DE DEMANDAS</small></div><button className="closeMenu" onClick={()=>setMobileMenu(false)}><X/></button></div>
      <div className="workspace"><span className="dot"/> Ambiente de Marketing <ChevronDown size={14}/></div><div className="navLabel">MENU PRINCIPAL</div>
      {nav.map(([name,Icon])=><button key={name} className={`navItem ${active===name?"active":""}`} onClick={()=>{setActive(name);setMobileMenu(false);setSelected(null)}}><Icon size={18}/>{name}{name==="SolicitaÃ§Ãµes"&&<span className="navCount">{tasks.length}</span>}</button>)}
      <div className="sidebarBottom"><div className="userAvatar">{(profile?.full_name||"U").split(" ").map(x=>x[0]).slice(0,2).join("").toUpperCase()}</div><div><b>{profile?.full_name||"UsuÃ¡rio"}</b><small>{profile?.role==="admin"?"Administrador":profile?.role==="gestor"?"Gestor":"Colaborador"}</small></div><button className="logoutIcon" title="Sair" onClick={signOut}><LogOut size={16}/></button></div>
    </aside>
    <section className="main">
      <header className="topbar"><button className="menuButton" onClick={()=>setMobileMenu(true)}><Menu/></button><div className="crumb">Marketing <span>/</span> {active}</div><div className="topRight"><span className="online"><i/> {dataLoading?"Sincronizando":"Conectado ao Supabase"}</span><div className="userAvatar">{(profile?.full_name||"U").split(" ").map(x=>x[0]).slice(0,2).join("").toUpperCase()}</div></div></header>
      <div className="content">
        {dataError&&<div className="errorBanner"><span>{dataError}</span><button onClick={()=>session?.user&&loadData(session.user)}>Tentar novamente</button></div>}
        {active==="Dashboard" && <>
          <div className="pageHeading"><div><p className="eyebrow">VISÃƒO GERAL</p><h1>Dashboard</h1><p className="sub">Acompanhe as demandas e a operaÃ§Ã£o do Marketing DelRio.</p></div><button className="primary" onClick={()=>setShowNew(true)}><Plus size={17}/> Nova solicitaÃ§Ã£o</button></div>
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
              <div className="dashFilterTitle"><span className="dashFilterIcon"><CalendarDays size={19}/></span><div><h3>Filtros do Dashboard</h3><p>Personalize a anÃ¡lise das solicitaÃ§Ãµes por data e perÃ­odo.</p></div></div>
              <button className="dashClear" onClick={()=>{setDashboardPeriod("all");setDashboardDateMode("created");setDashboardStart("");setDashboardEnd("")}}>Limpar filtros</button>
            </div>
            <div className="dashFilterGrid">
              <div><label className="dashFieldLabel" htmlFor="dashboard-date-mode">Considerar data</label><select id="dashboard-date-mode" className="dashDateSelect" value={dashboardDateMode} onChange={e=>setDashboardDateMode(e.target.value as "created"|"completed"|"due")}><option value="created">Data de abertura</option><option value="completed">Data de conclusÃ£o</option><option value="due">Data do prazo</option></select></div>
              <div><span className="dashFieldLabel">PerÃ­odo de anÃ¡lise</span><div className="dashPeriodOptions">{[{value:"all",label:"Todo o perÃ­odo"},{value:"month",label:"Este mÃªs"},{value:"30",label:"Ãšltimos 30 dias"},{value:"90",label:"Ãšltimos 90 dias"},{value:"year",label:"Este ano"},{value:"custom",label:"Personalizado"}].map(option=><button key={option.value} type="button" className={`dashPeriodButton ${dashboardPeriod===option.value?"active":""}`} aria-pressed={dashboardPeriod===option.value} onClick={()=>setDashboardPeriod(option.value)}>{option.label}</button>)}</div></div>
            </div>
            {dashboardPeriod==="custom"&&<div className="dashCustomDates"><div><label className="dashFieldLabel" htmlFor="dashboard-start">Data inicial</label><input id="dashboard-start" className="dashDateInput" type="date" value={dashboardStart} onChange={e=>setDashboardStart(e.target.value)}/></div><div><label className="dashFieldLabel" htmlFor="dashboard-end">Data final</label><input id="dashboard-end" className="dashDateInput" type="date" value={dashboardEnd} min={dashboardStart||undefined} onChange={e=>setDashboardEnd(e.target.value)}/></div></div>}
            {dashboardPeriod==="custom"&&dashboardStart&&dashboardEnd&&dashboardStart>dashboardEnd&&<p className="dashFilterError">A data inicial nÃ£o pode ser posterior Ã  data final.</p>}
            {dashboardDateMode==="completed"&&<p className="dashFilterNote">A anÃ¡lise por conclusÃ£o utiliza a data registrada quando a solicitaÃ§Ã£o foi concluÃ­da. SolicitaÃ§Ãµes concluÃ­das antes da ativaÃ§Ã£o desse registro podem nÃ£o aparecer nesse filtro.</p>}
            <div className="dashFilterBottom"><span className="dashFilterSummary"><CalendarDays size={14}/> CritÃ©rio: <strong>{dashboardDateLabel}</strong></span><span className="dashFilterSummary">{dashboardTasks.length} solicitaÃ§Ã£o(Ãµes) no resultado</span></div>
          </section>
          <div className="stats"><Stat icon={<ClipboardList/>} label="Total de solicitaÃ§Ãµes" value={dashboardTasks.length} tone="blue"/><Stat icon={<Activity/>} label="Em andamento" value={dashboardInProgress} tone="violet"/><Stat icon={<CheckCircle2/>} label="ConcluÃ­das" value={dashboardDone} tone="green"/><Stat icon={<AlertTriangle/>} label="Atrasadas" value={dashboardLate} tone="red"/></div>
          <div className="gridMain"><div className="panel"><div className="panelHead"><div><h3>SolicitaÃ§Ãµes recentes</h3><p>Demandas dentro do perÃ­odo selecionado</p></div><button className="textButton" onClick={()=>setActive("SolicitaÃ§Ãµes")}>Ver todas <ArrowUpRight size={15}/></button></div><TaskTable tasks={[...dashboardTasks].sort((a,b)=>b.created.localeCompare(a.created)).slice(0,5)} onSelect={setSelected}/></div>
            <div className="panel"><div className="panelHead"><div><h3>DistribuiÃ§Ã£o por Ã¡rea</h3><p>Volume de solicitaÃ§Ãµes no perÃ­odo</p></div></div><div className="areaBars">{areaNames.map(a=>{const n=dashboardTasks.filter(t=>t.area===a).length;return <div className="barRow" key={a}><div><span>{a}</span><b>{n}</b></div><div className="track"><i style={{width:`${dashboardTasks.length?n/dashboardTasks.length*100:0}%`}}/></div></div>})}</div></div></div>
          <div className="panel" style={{marginBottom:18}}>
            <div className="panelHead"><div><h3>SolicitaÃ§Ãµes por colaborador</h3><p>DistribuiÃ§Ã£o das demandas por responsÃ¡vel pela execuÃ§Ã£o</p></div><span className="muted">{requestsByOwner.length} colaborador(es)</span></div>
            {!requestsByOwner.length ? <div className="emptyTable">Ainda nÃ£o hÃ¡ solicitaÃ§Ãµes atribuÃ­das a colaboradores.</div> : <div className="tableWrap"><table><thead><tr><th>Colaborador responsÃ¡vel</th><th>Total atribuÃ­das</th><th>Em andamento</th><th>ConcluÃ­das</th><th>Atrasadas</th><th>Canceladas</th></tr></thead><tbody>
              {requestsByOwner.map(person=><tr key={person.id}><td><b>{person.name}</b></td><td><b>{person.total}</b></td><td>{person.inProgress}</td><td>{person.done}</td><td>{person.late}</td><td>{person.cancelled}</td></tr>)}
            </tbody></table></div>}
          </div>
          <div className="panel"><div className="panelHead"><div><h3>PrÃ³ximos prazos</h3><p>Demandas que exigem acompanhamento</p></div><button className="textButton" onClick={()=>setActive("Cronograma")}>Abrir cronograma <ArrowUpRight size={15}/></button></div><TaskTable tasks={[...dashboardTasks].filter(t=>t.status!=="ConcluÃ­da"&&t.status!=="Cancelada").sort((a,b)=>a.due.localeCompare(b.due)).slice(0,4)} onSelect={setSelected}/></div>
        </>}
        {active==="SolicitaÃ§Ãµes" && <><div className="pageHeading"><div><p className="eyebrow">GESTÃƒO OPERACIONAL</p><h1>SolicitaÃ§Ãµes</h1><p className="sub">Cadastre, distribua e acompanhe as demandas.</p></div><button className="primary" onClick={()=>setShowNew(true)}><Plus size={17}/> Nova solicitaÃ§Ã£o</button></div><div className="panel"><div className="toolbar" style={{flexWrap:"wrap",gap:12}}><div className="search"><Search size={17}/><input placeholder="Buscar por tÃ­tulo, Ã¡rea, responsÃ¡vel ou status..." value={search} onChange={e=>setSearch(e.target.value)}/></div><label style={{minWidth:220}}>Filtrar por usuÃ¡rio responsÃ¡vel<select value={requestUserFilter} onChange={e=>setRequestUserFilter(e.target.value)}><option value="Todos">Todos os usuÃ¡rios</option>{requestUsers.map(([id,name])=><option key={id} value={id}>{name}</option>)}{tasks.some(t=>!t.ownerId)&&<option value="Sem responsÃ¡vel">Sem responsÃ¡vel</option>}</select></label><span className="muted">{filtered.length} registros</span></div><TaskTable tasks={filtered} onSelect={setSelected}/></div></>}
        {active==="Pedidos de Materiais" && <>
          <div className="pageHeading"><div><p className="eyebrow">SUPRIMENTOS INTERNOS</p><h1>Pedidos de Materiais</h1><p className="sub">Solicite materiais, acompanhe aprovaÃ§Ãµes e consulte a separaÃ§Ã£o e entrega.</p></div><div style={{display:"flex",gap:10,flexWrap:"wrap"}}><button className="secondary" onClick={loadMaterialOrders} disabled={ordersLoading}><RefreshCw size={15}/> Atualizar</button><button className="primary" onClick={()=>{setOrdersError("");setOrderAreaId(myOrderAreas.some(a=>a.id===profile?.area_id)?profile?.area_id||"":myOrderAreas[0]?.id||"");setShowNewMaterialOrder(true)}} disabled={!myOrderAreas.length}><Plus size={16}/> Novo pedido</button></div></div>
          {ordersError&&<div className="errorBanner"><span>{ordersError}</span><button onClick={()=>setOrdersError("")}>Fechar</button></div>}
          <div className="stats"><Stat icon={<ClipboardList/>} label="Pedidos visÃ­veis" value={materialOrders.length} tone="blue"/><Stat icon={<Clock3/>} label="Aguardando gestor" value={pendingManagerOrders} tone="violet"/><Stat icon={<PackageCheck/>} label="Aguardando estoque" value={pendingStockOrders} tone="amber"/><Stat icon={<Layers/>} label="Em atendimento" value={activeMaterialOrders} tone="green"/></div>
          <div className="panel"><div className="panelHead"><div><h3>Pedidos cadastrados</h3><p>Os pedidos exibidos respeitam as permissÃµes de acesso do seu perfil.</p></div><span className="muted">{materialOrders.length} registro(s)</span></div>
            {ordersLoading?<div className="emptyTable">Carregando pedidos de materiais...</div>:!materialOrders.length?<div className="emptyTable">Nenhum pedido de materiais encontrado. Use “Novo pedido” para registrar a primeira solicitação.</div>:<div className="tableWrap"><table><thead><tr><th>Pedido</th><th>Solicitante / Área</th><th>Necessário em</th><th>Materiais</th><th>Status</th><th style={{textAlign:"right"}}>Ação</th></tr></thead><tbody>{materialOrders.map(order=>{const count=materialOrderItems.filter(item=>item.order_id===order.id).length;return <tr key={order.id}><td><div style={{display:"flex",flexDirection:"column",gap:3}}><b style={{whiteSpace:"nowrap"}}>#{order.protocol}</b><span className="muted" style={{fontSize:12}}>{new Date(order.created_at).toLocaleDateString("pt-BR")}</span></div></td><td><div style={{display:"flex",flexDirection:"column",gap:3,minWidth:130}}><b>{orderRequesterName(order.requester_id)}</b><span className="muted" style={{fontSize:12}}>{orderAreaName(order.area_id)}</span></div></td><td style={{whiteSpace:"nowrap"}}>{order.needed_by?new Date(order.needed_by+"T12:00:00").toLocaleDateString("pt-BR"):"—"}</td><td><span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",minWidth:28,padding:"4px 9px",borderRadius:20,background:"var(--surface-soft,#f4f2f8)",fontSize:12,fontWeight:700}}>{count}</span><span className="muted" style={{fontSize:12,marginLeft:7}}>{count===1?"material":"materiais"}</span></td><td><span className={`status ${order.status==="concluido"?"green":order.status.startsWith("rejeitado")||order.status==="cancelado"?"red":order.status.includes("aguardando")?"amber":"blue"}`}>{orderStatusLabels[order.status]}</span></td><td style={{textAlign:"right"}}><button className="textButton" style={{whiteSpace:"nowrap"}} onClick={()=>setSelectedMaterialOrder(order.id)}>Ver detalhes <ArrowUpRight size={14}/></button></td></tr>})}</tbody></table></div>}
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
                <div className="tableWrap"><table><thead><tr><th>Material</th><th>Código</th><th>Quantidade</th><th>Unidade</th></tr></thead><tbody>{selectedOrderItems.map(item=><tr key={item.id}><td><b>{item.material?.name||"Material"}</b></td><td>{item.material?.sku||"—"}</td><td>{Number(item.quantity).toLocaleString("pt-BR")}</td><td>{item.material?.unit||"un"}</td></tr>)}</tbody></table></div>
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
                {!selectedOrderHistory.length?<div className="emptyTable">Nenhum evento registrado.</div>:<div className="timeline">{[...selectedOrderHistory].reverse().map(event=><div className="timelineItem" key={event.id}><div className="timelineInfo"><b>{event.details||event.action.replaceAll("_"," ")}</b><small>{event.actor_name||"Usuário"} · {new Date(event.created_at).toLocaleString("pt-BR")}</small></div>{event.new_status&&<span className="status blue">{orderStatusLabels[event.new_status as MaterialOrderStatus]||event.new_status}</span>}</div>)}</div>}
              </div>
              <div className="modalActions"><button className="secondary" onClick={()=>setSelectedMaterialOrder(null)}>Fechar</button></div>
            </div>
          </div>}
        </>}
        {active==="Cronograma" && <>
          <div className="pageHeading"><div><p className="eyebrow">PLANEJAMENTO</p><h1>Cronograma da equipe</h1><p className="sub">Acompanhe prazos, responsÃ¡veis e andamento das entregas.</p></div></div>
          <div className="stats" style={{marginBottom:18}}>
            <Stat icon={<AlertTriangle/>} label="Atrasadas" value={scheduleOverdueCount} tone="red"/>
            <Stat icon={<CalendarDays/>} label="Vencem hoje" value={scheduleTodayCount} tone="red"/>
            <Stat icon={<Clock3/>} label="PrÃ³ximos 7 dias" value={scheduleNextSevenCount} tone="violet"/>
            <Stat icon={<ClipboardList/>} label="No cronograma" value={tasks.filter(t=>t.status!=="Cancelada").length} tone="blue"/>
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
              <div className="scheduleFilterTitle"><span className="scheduleFilterIcon"><CalendarDays size={19}/></span><div><h3>Filtros do cronograma</h3><p>Personalize a agenda por prazo, responsÃ¡vel, Ã¡rea e status.</p></div></div>
              <button className="scheduleFilterClear" onClick={()=>{setScheduleOwnerFilter("Todos");setScheduleAreaFilter("Todas");setScheduleStatusFilter("Todos");setSchedulePeriod("all");setScheduleStartDate("");setScheduleEndDate("")}}>Limpar filtros</button>
            </div>
            <div className="scheduleFilterGrid">
              <div><label className="scheduleFieldLabel" htmlFor="schedule-period">PerÃ­odo</label><select id="schedule-period" className="scheduleSelect" value={schedulePeriod} onChange={e=>setSchedulePeriod(e.target.value)}><option value="all">Todos os prazos</option><option value="7">PrÃ³ximos 7 dias</option><option value="30">PrÃ³ximos 30 dias</option><option value="overdue">Somente atrasadas</option><option value="custom">Personalizado</option></select></div>
              <div><label className="scheduleFieldLabel" htmlFor="schedule-owner">ResponsÃ¡vel</label><select id="schedule-owner" className="scheduleSelect" value={scheduleOwnerFilter} onChange={e=>setScheduleOwnerFilter(e.target.value)}><option value="Todos">Todos os colaboradores</option>{requestUsers.map(([id,name])=><option key={id} value={id}>{name}</option>)}{tasks.some(t=>!t.ownerId)&&<option value="Sem responsÃ¡vel">Sem responsÃ¡vel</option>}</select></div>
              <div><label className="scheduleFieldLabel" htmlFor="schedule-area">Ãrea</label><select id="schedule-area" className="scheduleSelect" value={scheduleAreaFilter} onChange={e=>setScheduleAreaFilter(e.target.value)}><option value="Todas">Todas as Ã¡reas</option>{areas.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
              <div><label className="scheduleFieldLabel" htmlFor="schedule-status">Status</label><select id="schedule-status" className="scheduleSelect" value={scheduleStatusFilter} onChange={e=>setScheduleStatusFilter(e.target.value)}><option value="Todos">Todos os status</option>{(["Recebida","Em anÃ¡lise","Aguardando aprovaÃ§Ã£o","Em execuÃ§Ã£o","ConcluÃ­da","Cancelada"] as Status[]).map(st=><option key={st} value={st}>{st}</option>)}</select></div>
              {schedulePeriod==="custom"&&<><div><label className="scheduleFieldLabel" htmlFor="schedule-start-date">Data inicial</label><input id="schedule-start-date" className="scheduleSelect" type="date" value={scheduleStartDate} onChange={e=>setScheduleStartDate(e.target.value)} max={scheduleEndDate||undefined}/></div><div><label className="scheduleFieldLabel" htmlFor="schedule-end-date">Data final</label><input id="schedule-end-date" className="scheduleSelect" type="date" value={scheduleEndDate} onChange={e=>setScheduleEndDate(e.target.value)} min={scheduleStartDate||undefined}/></div></>}
            </div>
            <div className="scheduleFilterBottom"><span className="scheduleFilterSummary"><CalendarDays size={14}/> VisualizaÃ§Ã£o: <strong>{schedulePeriod==="all"?"Todos os prazos":schedulePeriod==="7"?"PrÃ³ximos 7 dias":schedulePeriod==="30"?"PrÃ³ximos 30 dias":schedulePeriod==="overdue"?"Somente atrasadas":`Personalizado${scheduleStartDate||scheduleEndDate?` Â· ${scheduleStartDate?new Date(scheduleStartDate+"T12:00:00").toLocaleDateString("pt-BR"):"inÃ­cio livre"} atÃ© ${scheduleEndDate?new Date(scheduleEndDate+"T12:00:00").toLocaleDateString("pt-BR"):"sem limite"}`:" Â· informe as datas"}`}</strong></span><span className="scheduleFilterSummary">{scheduleTasks.length} resultado(s)</span></div>
          </section>
          <div className="panel"><div className="panelHead"><div><h3>Agenda de entregas</h3><p>Ordenada pelo prazo mais prÃ³ximo. Selecione uma demanda para abrir seus detalhes.</p></div></div>
            <div className="timeline">{scheduleTasks.map(t=><button className="timelineItem" key={t.id} onClick={()=>setSelected(t)}><div className="dateBlock"><b>{t.due?.slice(8,10)||"â€”"}</b><small>{t.due?new Date(t.due+"T12:00:00").toLocaleDateString("pt-BR",{month:"short"}):"Sem prazo"}</small></div><div className="timelineInfo"><b>{t.title}</b><small>{t.owner} Â· {t.area} Â· #{t.protocol}</small></div><div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>{t.status!=="ConcluÃ­da"&&t.status!=="Cancelada"&&t.due&&t.due<scheduleToday&&<span className="status red">Atrasada</span>}<StatusBadge status={t.status}/></div></button>)}{!scheduleTasks.length&&<div className="emptyTable">Nenhuma solicitaÃ§Ã£o encontrada com os filtros selecionados.</div>}</div>
          </div>
        </>}
        {active==="Colaboradores" && <><div className="pageHeading"><div><p className="eyebrow">EQUIPE</p><h1>Colaboradores</h1><p className="sub">Gerencie Ã¡reas, perfis e situaÃ§Ã£o dos usuÃ¡rios cadastrados.</p></div><button className="secondary" onClick={()=>session?.user&&loadData(session.user)}><RefreshCw size={15}/> Atualizar lista</button></div>
          <div className="panel"><div className="panelHead"><div><h3>Equipe cadastrada</h3><p>{members.length} usuÃ¡rio(s) ativo(s) visÃ­vel(is)</p></div></div>
            {profile?.role==="admin"&&<div className="notice">Para adicionar uma pessoa, primeiro crie o usuÃ¡rio em Supabase â†’ Authentication â†’ Users â†’ Add user. O banco cria o perfil automaticamente. Depois atualize esta lista para gerenciar sua Ã¡rea e funÃ§Ã£o.</div>}
            <div className="memberGrid">{members.map(m=><button className="memberCard memberButton" key={m.id} onClick={()=>{setSelectedMember(m);setMemberTaskStatus("Todas");setMemberForm({full_name:m.full_name,role:m.role,area_ids:m.area_ids||[],active:m.active,stock_manager:m.stock_manager===true});setMemberMessage("")}}><div className="userAvatar">{m.full_name.split(" ").map(x=>x[0]).slice(0,2).join("")}</div><b>{m.full_name}</b><small>{m.email||"Sem e-mail"}</small><small>{m.role==="admin"?"Administrador":m.role==="gestor"?"Gestor":"Colaborador"}</small><small>{(m.area_ids||[]).length ? areas.filter(a=>(m.area_ids||[]).includes(a.id)).map(a=>a.name).join(" Â· ") : "Ãrea nÃ£o definida"}</small><small>{m.role==="admin"?"Gerenciamento de estoque: acesso automÃ¡tico":m.stock_manager?"Gerencia estoque":"Sem permissÃ£o de estoque"}</small><span className="memberEdit">{profile?.role==="admin"?"Editar cadastro":"Visualizar cadastro"}</span></button>)}{!members.length&&<div className="emptyTable">Nenhum colaborador visÃ­vel para este perfil.</div>}</div>
          </div></>}
        {active==="Estoque" && <>
          <div className="pageHeading">
            <div><p className="eyebrow">MATERIAIS</p><h1>Estoque</h1><p className="sub">Controle de materiais promocionais, disponibilidade e movimentaÃ§Ãµes.</p></div>
            {canManageStock && <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
              <button className="secondary" onClick={()=>loadStock()} disabled={stockLoading}><RefreshCw size={15}/> Atualizar</button>
              <button className="secondary" onClick={()=>setShowNewMaterial(true)}><Plus size={16}/> Novo material</button>
              <button className="primary" onClick={()=>{setMovementForm(old=>({...old,material_id:old.material_id||stockMaterials[0]?.id||""}));setShowStockMovement(true)}} disabled={!stockMaterials.length}><ArrowUpRight size={16}/> Nova movimentaÃ§Ã£o</button>
            </div>}
          </div>
          {stockError && <div className="errorBanner"><span>{stockError}</span><button onClick={()=>setStockError("")}>Fechar</button></div>}
          {!canManageStock && <div className="notice" style={{marginBottom:16}}>VocÃª possui acesso de consulta ao estoque. Para cadastrar materiais ou registrar movimentaÃ§Ãµes, solicite ao administrador a permissÃ£o â€œGerenciar Estoqueâ€.</div>}
          {canManageStock && <>
            <div className="stats">
              <Stat icon={<Package/>} label="Materiais ativos" value={stockMaterials.length} tone="blue"/>
              <Stat icon={<AlertTriangle/>} label="Abaixo do mÃ­nimo" value={stockMaterials.filter(m=>Number(m.quantity)-(reservedByMaterial[m.id]||0)<=Number(m.minimum_quantity)).length} tone="red"/>
              <Stat icon={<Layers/>} label="Materiais com reserva" value={stockMaterials.filter(m=>(reservedByMaterial[m.id]||0)>0).length} tone="violet"/>
              <Stat icon={<CheckCircle2/>} label="Com saldo disponÃ­vel" value={stockMaterials.filter(m=>Number(m.quantity)-(reservedByMaterial[m.id]||0)>0).length} tone="green"/>
            </div>
            <div className="panel" style={{marginTop:18}}>
              <div className="panelHead"><div><h3>MovimentaÃ§Ãµes dos Ãºltimos 30 dias</h3><p>Quantidade de registros por tipo de movimentaÃ§Ã£o no perÃ­odo.</p></div><span className="muted">{stockMovementSummary.total} registro(s)</span></div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(145px,1fr))",gap:12}}>
                <Stat icon={<ArrowUpRight/>} label="Entradas" value={stockMovementSummary.entries} tone="green"/>
                <Stat icon={<Activity/>} label="SaÃ­das" value={stockMovementSummary.exits} tone="blue"/>
                <Stat icon={<Layers/>} label="Reservas" value={stockMovementSummary.reservations} tone="violet"/>
                <Stat icon={<RefreshCw/>} label="Cancelamentos de reserva" value={stockMovementSummary.reservationCancellations} tone="amber"/>
                <Stat icon={<History/>} label="Ajustes" value={stockMovementSummary.adjustments} tone="blue"/>
              </div>
            </div>
            <div className="panel" style={{marginTop:18}}>
              <div className="panelHead">
                <div><h3>Alertas de estoque</h3><p>Materiais sem saldo disponível ou com saldo no limite/abaixo do estoque mínimo.</p></div>
                <span className="muted">{stockAlerts.length} alerta(s)</span>
              </div>
              {stockAlerts.length === 0 ? <div className="emptyTable">Nenhum alerta. Todos os materiais estão acima do estoque mínimo.</div> : (
                <div style={{display:"grid",gap:10}}>
                  {stockAlerts.map(alert => {
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
              )}
            </div>
          </>}
          <div className="panel">
            <div className="panelHead"><div><h3>Materiais cadastrados</h3><p>{canManageStock?"Estoque fÃ­sico, reservas e saldo disponÃ­vel.":"Consulta dos saldos fÃ­sicos cadastrados."}</p></div><span className="muted">{filteredMaterials.length} material(is)</span></div>
            <div className="toolbar">
              <div className="search"><Search size={17}/><input placeholder="Buscar material ou cÃ³digo..." value={stockSearch} onChange={e=>setStockSearch(e.target.value)}/></div>
              <span className="muted">{stockLoading?"Carregando estoque...":`${stockMaterials.length} ativo(s)`}</span>
            </div>
            {stockLoading ? <div className="emptyTable">Carregando materiais...</div> : !filteredMaterials.length ? <div className="emptyTable">Nenhum material cadastrado. {canManageStock?"Use â€œNovo materialâ€ para comeÃ§ar.":""}</div> :
              <div className="tableWrap"><table><thead><tr><th>Material</th><th>CÃ³digo</th><th>Estoque fÃ­sico</th>{canManageStock&&<><th>Reservado</th><th>DisponÃ­vel</th></>}<th>Estoque mÃ­nimo</th><th>SituaÃ§Ã£o</th>{canManageStock&&<th>AÃ§Ã£o</th>}</tr></thead><tbody>
                {filteredMaterials.map(m=>{
                  const reserved = reservedByMaterial[m.id] || 0;
                  const available = Number(m.quantity)-reserved;
                  const low = canManageStock && available <= Number(m.minimum_quantity);
                  return <tr key={m.id}>
                    <td><b>{m.name}</b>{m.description&&<span style={{display:"block",fontSize:12,color:"#667085",marginTop:3}}>{m.description}</span>}</td>
                    <td>{m.sku||"â€”"}</td>
                    <td>{Number(m.quantity).toLocaleString("pt-BR",{maximumFractionDigits:2})} {m.unit}</td>
                    {canManageStock&&<><td>{reserved.toLocaleString("pt-BR",{maximumFractionDigits:2})} {m.unit}</td><td><b>{available.toLocaleString("pt-BR",{maximumFractionDigits:2})} {m.unit}</b></td></>}
                    <td>{Number(m.minimum_quantity).toLocaleString("pt-BR",{maximumFractionDigits:2})} {m.unit}</td>
                    <td><span className={`status ${low?"red":"green"}`}>{low?"Estoque baixo":"Regular"}</span></td>
                    {canManageStock&&<td><button className="textButton" onClick={()=>{setMovementForm({material_id:m.id,movement_type:"entrada",quantity:"",request_id:"",notes:""});setShowStockMovement(true)}}>Movimentar</button></td>}
                  </tr>;
                })}
              </tbody></table></div>}
          </div>
          {canManageStock && <div className="panel" style={{marginTop:18}}>
            <div className="panelHead">
              <div><h3>Relatório de movimentações</h3><p>Consulte e exporte entradas, saídas, ajustes e movimentações de reservas.</p></div>
              <button className="secondary" onClick={exportStockMovements} disabled={!filteredStockMovements.length}><Download size={15}/> Exportar CSV</button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:14,marginBottom:18}}>
              <div><label className="reportFieldLabel" htmlFor="stock-report-material">Material</label><select id="stock-report-material" className="reportSelect" value={stockReportMaterial} onChange={e=>setStockReportMaterial(e.target.value)}><option value="Todos">Todos os materiais</option>{stockMaterials.map(material=><option key={material.id} value={material.id}>{material.name}</option>)}</select></div>
              <div><label className="reportFieldLabel" htmlFor="stock-report-type">Tipo de movimentação</label><select id="stock-report-type" className="reportSelect" value={stockReportType} onChange={e=>setStockReportType(e.target.value)}><option value="Todos">Todos os tipos</option><option value="entrada">Entrada</option><option value="saida">Saída</option><option value="ajuste">Ajuste</option><option value="reserva">Reserva</option><option value="cancelamento_reserva">Cancelamento de reserva</option></select></div>
              <div><label className="reportFieldLabel" htmlFor="stock-report-start">Data inicial</label><input id="stock-report-start" className="reportDate" type="date" value={stockReportStart} max={stockReportEnd||undefined} onChange={e=>setStockReportStart(e.target.value)}/></div>
              <div><label className="reportFieldLabel" htmlFor="stock-report-end">Data final</label><input id="stock-report-end" className="reportDate" type="date" value={stockReportEnd} min={stockReportStart||undefined} onChange={e=>setStockReportEnd(e.target.value)}/></div>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap",marginBottom:16}}>
              <span className="muted">{filteredStockMovements.length} movimentação(ões) encontradas</span>
              <button className="reportClear" onClick={()=>{setStockReportMaterial("Todos");setStockReportType("Todos");setStockReportStart("");setStockReportEnd("")}}>Limpar filtros</button>
            </div>
            <div className="stats" style={{marginBottom:18}}>
              <Stat icon={<History/>} label="Total de registros" value={stockReportSummary.total} tone="blue"/>
              <Stat icon={<ArrowUpRight/>} label="Entradas" value={stockReportSummary.entries} tone="green"/>
              <Stat icon={<Activity/>} label="Saídas" value={stockReportSummary.exits} tone="blue"/>
              <Stat icon={<RefreshCw/>} label="Ajustes" value={stockReportSummary.adjustments} tone="amber"/>
              <Stat icon={<Layers/>} label="Reservas e cancelamentos" value={stockReportSummary.reservations} tone="violet"/>
            </div>
            {!filteredStockMovements.length ? <div className="emptyTable">Nenhuma movimentação encontrada para os filtros selecionados.</div> :
              <div className="tableWrap"><table><thead><tr><th>Data</th><th>Material</th><th>Tipo</th><th>Quantidade</th><th>Origem</th><th>Observações</th></tr></thead><tbody>
                {filteredStockMovements.map(m=>{
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
              </tbody></table></div>}
          </div>}
        </>}
        {active==="RelatÃ³rios" && <>
          <div className="pageHeading" style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:16,flexWrap:"wrap"}}><div><p className="eyebrow">ANÃLISE GERENCIAL</p><h1>RelatÃ³rios</h1><p className="sub">Acompanhe resultados, produtividade e distribuiÃ§Ã£o das demandas.</p></div><button type="button" className="secondary" onClick={exportReports}><Download size={16}/> Exportar relatório</button></div>
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
            <div className="reportFilterTop"><div className="reportFilterTitle"><span className="reportFilterIcon"><CalendarDays size={19}/></span><div><h3>Filtros dos relatÃ³rios</h3><p>Selecione o perÃ­odo e refine os dados que deseja analisar.</p></div></div><button className="reportClear" onClick={()=>{setReportDateMode("created");setReportPeriod("all");setReportStartDate("");setReportEndDate("");setReportAreaFilter("Todas");setReportOwnerFilter("Todos");setReportStatusFilter("Todos")}}>Limpar filtros</button></div>
            <div className="reportFilterGrid">
              <div><label className="reportFieldLabel" htmlFor="report-date-mode">Considerar data</label><select id="report-date-mode" className="reportSelect" value={reportDateMode} onChange={e=>setReportDateMode(e.target.value as "created"|"completed"|"due")}><option value="created">Data de abertura</option><option value="completed">Data de conclusÃ£o</option><option value="due">Data do prazo</option></select></div>
              <div><label className="reportFieldLabel" htmlFor="report-area">Ãrea</label><select id="report-area" className="reportSelect" value={reportAreaFilter} onChange={e=>setReportAreaFilter(e.target.value)}><option value="Todas">Todas as Ã¡reas</option>{areas.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
              <div><label className="reportFieldLabel" htmlFor="report-owner">ResponsÃ¡vel</label><select id="report-owner" className="reportSelect" value={reportOwnerFilter} onChange={e=>setReportOwnerFilter(e.target.value)}><option value="Todos">Todos os colaboradores</option>{requestUsers.map(([id,name])=><option key={id} value={id}>{name}</option>)}{tasks.some(t=>!t.ownerId)&&<option value="Sem responsÃ¡vel">Sem responsÃ¡vel</option>}</select></div>
              <div><label className="reportFieldLabel" htmlFor="report-status">Status</label><select id="report-status" className="reportSelect" value={reportStatusFilter} onChange={e=>setReportStatusFilter(e.target.value)}><option value="Todos">Todos os status</option>{(["Recebida","Em anÃ¡lise","Aguardando aprovaÃ§Ã£o","Em execuÃ§Ã£o","ConcluÃ­da","Cancelada"] as Status[]).map(status=><option key={status} value={status}>{status}</option>)}</select></div>
            </div>
            <div style={{marginTop:17}}><span className="reportFieldLabel">PerÃ­odo de anÃ¡lise</span><div className="reportPeriodOptions">{[{value:"all",label:"Todo o perÃ­odo"},{value:"month",label:"Este mÃªs"},{value:"30",label:"Ãšltimos 30 dias"},{value:"90",label:"Ãšltimos 90 dias"},{value:"year",label:"Este ano"},{value:"custom",label:"Personalizado"}].map(option=><button key={option.value} type="button" className={`reportPeriodButton ${reportPeriod===option.value?"active":""}`} aria-pressed={reportPeriod===option.value} onClick={()=>setReportPeriod(option.value)}>{option.label}</button>)}</div></div>
            {reportPeriod==="custom"&&<div className="reportCustomDates"><div><label className="reportFieldLabel" htmlFor="report-start">Data inicial</label><input id="report-start" className="reportDate" type="date" value={reportStartDate} onChange={e=>setReportStartDate(e.target.value)}/></div><div><label className="reportFieldLabel" htmlFor="report-end">Data final</label><input id="report-end" className="reportDate" type="date" min={reportStartDate||undefined} value={reportEndDate} onChange={e=>setReportEndDate(e.target.value)}/></div></div>}
            {reportPeriod==="custom"&&reportStartDate&&reportEndDate&&reportStartDate>reportEndDate&&<p style={{color:"#b42318",fontSize:12,marginTop:10}}>A data inicial nÃ£o pode ser posterior Ã  data final.</p>}
            {reportDateMode==="completed"&&<p className="dashFilterNote">A anÃ¡lise por conclusÃ£o utiliza a data registrada quando a solicitaÃ§Ã£o foi concluÃ­da. SolicitaÃ§Ãµes concluÃ­das antes da ativaÃ§Ã£o desse registro podem nÃ£o aparecer nesse filtro.</p>}
            <div className="reportFilterBottom"><span className="reportSummary"><CalendarDays size={14}/> CritÃ©rio: <strong>{reportDateLabel}</strong></span><span className="reportSummary">{reportTasks.length} solicitaÃ§Ã£o(Ãµes) no resultado</span></div>
          </section>
          <div className="reportKpiGrid"><Stat icon={<ClipboardList/>} label="Total de solicitaÃ§Ãµes" value={reportTasks.length} tone="blue"/><Stat icon={<Clock3/>} label="Recebidas" value={reportReceived} tone="blue"/><Stat icon={<Activity/>} label="Em anÃ¡lise" value={reportAnalysis} tone="violet"/><Stat icon={<Clock3/>} label="Aguardando aprovaÃ§Ã£o" value={reportAwaitingApproval} tone="violet"/><Stat icon={<Activity/>} label="Em execuÃ§Ã£o" value={reportExecuting} tone="violet"/><Stat icon={<CheckCircle2/>} label="ConcluÃ­das" value={reportDone} tone="green"/><Stat icon={<X/>} label="Canceladas" value={reportCancelled} tone="red"/><Stat icon={<AlertTriangle/>} label="Atrasadas" value={reportLate} tone="red"/></div>
          <div className="gridMain" style={{marginTop:18}}>
            <section className="panel reportPanel"><div className="reportPanelHead"><div><h3>DistribuiÃ§Ã£o por status</h3><p>Volume de solicitaÃ§Ãµes em cada etapa</p></div></div><div className="reportBars">{(["Recebida","Em anÃ¡lise","Aguardando aprovaÃ§Ã£o","Em execuÃ§Ã£o","ConcluÃ­da","Cancelada"] as Status[]).map(status=>{const count=reportTasks.filter(t=>t.status===status).length;return <div className="reportBarRow" key={status}><div><span>{status}</span><b>{count}</b></div><div className="reportBarTrack"><i style={{width:`${reportTasks.length?count/reportTasks.length*100:0}%`}}/></div></div>})}</div></section>
            <section className="panel reportPanel"><div className="reportPanelHead"><div><h3>DistribuiÃ§Ã£o por Ã¡rea</h3><p>ParticipaÃ§Ã£o de cada Ã¡rea no volume total</p></div></div>{!reportByArea.length?<div className="emptyTable">NÃ£o hÃ¡ solicitaÃ§Ãµes no perÃ­odo selecionado.</div>:<div className="reportBars">{reportByArea.map(item=><div className="reportBarRow" key={item.name}><div><span>{item.name}</span><b>{item.total}</b></div><div className="reportBarTrack"><i style={{width:`${reportTasks.length?item.total/reportTasks.length*100:0}%`}}/></div></div>)}</div>}</section>
          </div>
          <div className="gridMain" style={{marginTop:18}}>
            <section className="panel reportPanel"><div className="reportPanelHead"><div><h3>Desempenho da equipe</h3><p>SolicitaÃ§Ãµes atribuÃ­das por responsÃ¡vel</p></div></div>{!reportByOwner.length?<div className="emptyTable">NÃ£o hÃ¡ solicitaÃ§Ãµes atribuÃ­das no perÃ­odo.</div>:<div className="tableWrap"><table><thead><tr><th>ResponsÃ¡vel</th><th>Total</th><th>ConcluÃ­das</th><th>Em andamento</th><th>Atrasadas</th></tr></thead><tbody>{reportByOwner.map(person=><tr key={person.id}><td><b>{person.name}</b></td><td>{person.total}</td><td>{person.done}</td><td>{person.inProgress}</td><td>{person.late}</td></tr>)}</tbody></table></div>}</section>
            <section className="panel reportPanel"><div className="reportPanelHead"><div><h3>Taxa de conclusÃ£o</h3><p>Percentual de demandas concluÃ­das no resultado filtrado</p></div></div><div className="reportRate"><strong>{reportCompletionRate}%</strong><span>{reportDone} de {reportCompletionBase} solicitaÃ§Ãµes vÃ¡lidas concluÃ­das</span></div><div className="reportBarTrack" style={{marginTop:16,height:12}}><i style={{display:"block",height:"100%",width:`${reportCompletionRate}%`,borderRadius:99,background:"linear-gradient(90deg,#9b5cdb,#7624c7)"}}/></div><div style={{marginTop:22,paddingTop:18,borderTop:"1px solid #f0edf4"}}><div className="reportPanelHead"><div><h3>SolicitaÃ§Ãµes em atraso</h3><p>{reportLate} de {reportOpenBase} solicitaÃ§Ãµes abertas estÃ£o com prazo vencido</p></div><strong style={{fontSize:24,color:"#b42318"}}>{reportOverdueRate}%</strong></div><div className="reportBarTrack" style={{height:10}}><i style={{display:"block",height:"100%",width:`${reportOverdueRate}%`,borderRadius:99,background:"#d92d20"}}/></div></div></section>
          </div>
          <section className="panel reportPanel" style={{marginTop:18}}><div className="reportPanelHead"><div><h3>Detalhamento das solicitaÃ§Ãµes</h3><p>Consulte os registros que compÃµem os indicadores acima.</p></div></div><TaskTable tasks={[...reportTasks].sort((a,b)=>b.created.localeCompare(a.created))} onSelect={setSelected}/></section>
        </>}
        {active==="ConfiguraÃ§Ãµes" && <><div className="pageHeading"><div><p className="eyebrow">ADMINISTRAÃ‡ÃƒO</p><h1>ConfiguraÃ§Ãµes</h1><p className="sub">ParÃ¢metros do ambiente e sua conta.</p></div></div><div className="panel"><h3>Ãreas cadastradas no Supabase</h3><div className="areaList">{areaNames.map(a=><div key={a}><Layers size={17}/>{a}<span>Ativa</span></div>)}</div><p className="notice">UsuÃ¡rio conectado: {profile?.email}. Perfil: {profile?.role}. A prioridade Ã© controlada por gestores e administradores.</p></div></>}
      </div>
    </section>
    {showNewMaterialOrder&&<div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setShowNewMaterialOrder(false)}}><div className="modal orderModal" style={{maxWidth:760}}>
      <style>{`
        .orderModal .orderItemsHeader{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:12px}
        .orderModal .orderItemsHeader h3{margin:0 0 4px;font-size:15px;font-weight:700;color:#252536}
        .orderModal .orderItemsHeader p{margin:0;color:#858397;font-size:12px;line-height:1.5}
        .orderModal .orderItemsList{display:grid;gap:10px}
        .orderModal .orderItemRow{display:grid;grid-template-columns:minmax(0,1fr) 150px 40px;gap:12px;align-items:end;padding:14px;background:#fcfbfe;border:1px solid #e7e8ef;border-radius:12px}
        .orderModal .orderItemField{display:grid;gap:7px;min-width:0;color:#565568;font-size:11px;font-weight:700}
        .orderModal .orderItemControl{display:block;width:100%;height:42px;min-width:0;box-sizing:border-box;padding:0 12px;border:1px solid #e1e2ea;border-radius:9px;background:#fff;color:#292837;font-family:inherit;font-size:13px;font-weight:500;outline:none;transition:border-color .15s,box-shadow .15s}
        .orderModal .orderItemControl:focus{border-color:#9b5cdb;box-shadow:0 0 0 3px rgba(122,27,216,.10)}
        .orderModal .orderItemRemove{width:40px;height:42px;display:grid;place-items:center;padding:0;border:1px solid #e7e8ef;border-radius:9px;background:#fff;color:#777487;cursor:pointer}
        .orderModal .orderItemRemove:hover:not(:disabled){border-color:#e7caca;background:#fff7f7;color:#c03939}
        .orderModal .orderItemRemove:disabled{opacity:.35;cursor:not-allowed}
        .orderModal .orderAddItem{white-space:nowrap}
        @media(max-width:600px){.orderModal .orderItemsHeader{align-items:flex-start;flex-direction:column}.orderModal .orderItemRow{grid-template-columns:minmax(0,1fr) 105px 38px;gap:8px;padding:10px}.orderModal .orderItemRemove{width:38px}}
      `}</style>
      <div className="modalHead"><div><p className="eyebrow">NOVA SOLICITAÃ‡ÃƒO DE SUPRIMENTOS</p><h2>Novo pedido de materiais</h2><p>O pedido seguirÃ¡ para aprovaÃ§Ã£o do gestor e, depois, para aprovaÃ§Ã£o do estoque.</p></div><button type="button" className="iconButton" onClick={()=>setShowNewMaterialOrder(false)}><X/></button></div>
      <div className="formGrid"><label>Ãrea solicitante<select value={orderAreaId} onChange={e=>setOrderAreaId(e.target.value)}>{myOrderAreas.map(area=><option key={area.id} value={area.id}>{area.name}</option>)}</select></label><label>Data necessÃ¡ria<input type="date" value={orderNeededBy} onChange={e=>setOrderNeededBy(e.target.value)} min={new Date().toISOString().slice(0,10)}/></label><label className="full">Finalidade do pedido<textarea rows={3} value={orderPurpose} onChange={e=>setOrderPurpose(e.target.value)} placeholder="Explique para qual aÃ§Ã£o, campanha ou necessidade os materiais serÃ£o utilizados..."/></label></div>
      <div style={{marginTop:20}}>
        <div className="orderItemsHeader"><div><h3>Materiais solicitados</h3><p>Adicione cada material uma Ãºnica vez e informe a quantidade desejada.</p></div><button type="button" className="secondary orderAddItem" onClick={()=>setOrderDraftItems(old=>[...old,{material_id:"",quantity:"1"}])}><Plus size={15}/> Adicionar item</button></div>
        <div className="orderItemsList">{orderDraftItems.map((item,index)=><div className="orderItemRow" key={index}>
          <label className="orderItemField">Material<select className="orderItemControl" value={item.material_id} onChange={e=>setOrderDraftItems(old=>old.map((row,i)=>i===index?{...row,material_id:e.target.value}:row))}><option value="">Selecione um material</option>{stockMaterials.filter(material=>!orderDraftItems.some((row,i)=>i!==index&&row.material_id===material.id)).map(material=><option key={material.id} value={material.id}>{material.name} Â· {material.unit}</option>)}</select></label>
          <label className="orderItemField">Quantidade<input className="orderItemControl" type="number" min="0.01" step="0.01" value={item.quantity} onChange={e=>setOrderDraftItems(old=>old.map((row,i)=>i===index?{...row,quantity:e.target.value}:row))}/></label>
          <button type="button" className="orderItemRemove" title="Remover item" aria-label="Remover item" disabled={orderDraftItems.length===1} onClick={()=>setOrderDraftItems(old=>old.filter((_,i)=>i!==index))}><X size={17}/></button>
        </div>)}</div>
      </div>
      {ordersError&&<div className="errorBox" style={{marginTop:14}}>{ordersError}</div>}
      <div className="modalActions"><button type="button" className="secondary" onClick={()=>setShowNewMaterialOrder(false)}>Cancelar</button><button type="button" className="primary" onClick={createMaterialOrder} disabled={ordersSaving||!stockMaterials.length||!orderAreaId}>{ordersSaving?"Enviando pedido...":"Enviar para aprovaÃ§Ã£o"}</button></div>
    </div></div>}
    {showNewMaterial&&<div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setShowNewMaterial(false)}}><div className="modal">
      <div className="modalHead"><div><h2>Novo material</h2><p>O cadastro comeÃ§a com estoque fÃ­sico zero. A quantidade inicial serÃ¡ registrada como entrada.</p></div><button className="iconButton" onClick={()=>setShowNewMaterial(false)}><X/></button></div>
      <div className="formGrid">
        <label className="full">Nome do material<input value={materialForm.name} onChange={e=>setMaterialForm({...materialForm,name:e.target.value})} placeholder="Ex.: Sacola promocional"/></label>
        <label>CÃ³digo / SKU<input value={materialForm.sku} onChange={e=>setMaterialForm({...materialForm,sku:e.target.value})} placeholder="Opcional"/></label>
        <label>Unidade de medida<input value={materialForm.unit} onChange={e=>setMaterialForm({...materialForm,unit:e.target.value})} placeholder="un, pct, cx..."/></label>
        <label>Estoque mÃ­nimo<input type="number" min="0" step="0.01" value={materialForm.minimum_quantity} onChange={e=>setMaterialForm({...materialForm,minimum_quantity:e.target.value})}/></label>
        <label className="full">DescriÃ§Ã£o<textarea rows={3} value={materialForm.description} onChange={e=>setMaterialForm({...materialForm,description:e.target.value})} placeholder="InformaÃ§Ãµes adicionais sobre o material..."/></label>
      </div>
      <div className="notice" style={{marginTop:14}}>Estoque inicial: <b>0 {materialForm.unit||"un"}</b>. Para adicionar quantidade, registre uma movimentaÃ§Ã£o do tipo Entrada apÃ³s cadastrar.</div>
      <div className="modalActions"><button className="secondary" onClick={()=>setShowNewMaterial(false)}>Cancelar</button><button className="primary" onClick={createMaterial} disabled={stockSaving||!materialForm.name.trim()}>{stockSaving?"Salvando...":"Cadastrar material"}</button></div>
    </div></div>}
    {showStockMovement&&<div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setShowStockMovement(false)}}><div className="modal">
      <div className="modalHead"><div><h2>Nova movimentaÃ§Ã£o</h2><p>Registre entradas, saÃ­das ou ajustes fÃ­sicos. Reservas sÃ£o controladas em Pedidos de Materiais.</p></div><button className="iconButton" onClick={()=>setShowStockMovement(false)}><X/></button></div>
      <div className="formGrid">
        <label className="full">Material<select value={movementForm.material_id} onChange={e=>setMovementForm({...movementForm,material_id:e.target.value})}>{stockMaterials.map(m=><option key={m.id} value={m.id}>{m.name} Â· saldo fÃ­sico: {Number(m.quantity).toLocaleString("pt-BR",{maximumFractionDigits:2})} {m.unit}</option>)}</select></label>
        <label className="full">Tipo de movimentaÃ§Ã£o<select value={movementForm.movement_type} onChange={e=>setMovementForm({...movementForm,movement_type:e.target.value as StockMovement["movement_type"],quantity:"",request_id:""})}>
          <option value="entrada">Entrada â€” aumenta o estoque fÃ­sico</option>
          <option value="saida">SaÃ­da â€” reduz o estoque fÃ­sico</option>
              <option value="ajuste">Ajuste â€” informar o saldo fÃ­sico contado</option>
        </select></label>
        <label className="full">{movementForm.movement_type==="ajuste"?"Saldo fÃ­sico contado":"Quantidade"}<input type="number" min={movementForm.movement_type==="ajuste"?"0":"0.01"} step="0.01" value={movementForm.quantity} onChange={e=>setMovementForm({...movementForm,quantity:e.target.value})} placeholder={movementForm.movement_type==="ajuste"?"Informe o saldo fÃ­sico encontrado":"Informe a quantidade"}/></label>
        <label className="full">ObservaÃ§Ãµes<textarea rows={3} value={movementForm.notes} onChange={e=>setMovementForm({...movementForm,notes:e.target.value})} placeholder="Motivo ou detalhes da movimentaÃ§Ã£o..."/></label>
      </div>
      {movementForm.movement_type==="ajuste"&&<div className="notice" style={{marginTop:12}}>Informe o saldo fÃ­sico total encontrado na contagem. O sistema calcularÃ¡ e registrarÃ¡ automaticamente a diferenÃ§a.</div>}
      <div className="modalActions"><button className="secondary" onClick={()=>setShowStockMovement(false)}>Cancelar</button><button className="primary" onClick={createStockMovement} disabled={stockSaving||!movementForm.material_id||movementForm.quantity===""}>{stockSaving?"Registrando...":"Registrar movimentaÃ§Ã£o"}</button></div>
    </div></div>}
    {showNew&&<div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setShowNew(false)}}><div className="modal"><div className="modalHead"><div><h2>Nova solicitaÃ§Ã£o</h2><p>Preencha os dados para registrar uma demanda.</p></div><button className="iconButton" onClick={()=>setShowNew(false)}><X/></button></div><div className="formGrid"><label className="full">TÃ­tulo da solicitaÃ§Ã£o<input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Ex.: Criar material para campanha"/></label><label>Ãrea responsÃ¡vel<select value={form.areaId} onChange={e=>setForm({...form,areaId:e.target.value})}>{areas.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label><label>ResponsÃ¡vel<select value={form.ownerId} onChange={e=>setForm({...form,ownerId:e.target.value})} disabled={areaMembers.length===1 || areaMembers.length===0}><option value="">{areaMembers.length===1?"AtribuÃ­do automaticamente":"Selecione um responsÃ¡vel"}</option>{areaMembers.map(m=><option key={m.profile_id} value={m.profile_id}>{m.full_name}</option>)}</select><small>{areaMembers.length===1?`ResponsÃ¡vel definido automaticamente: ${areaMembers[0].full_name}.`:areaMembers.length>1?"Selecione um dos responsÃ¡veis disponÃ­veis nesta Ã¡rea.":"Carregando responsÃ¡veis ou nenhum integrante ativo encontrado."}</small></label><label>Prioridade<select value={form.priority} disabled={!isManager} onChange={e=>setForm({...form,priority:e.target.value as Priority})}>{(["Baixa","MÃ©dia","Alta","Urgente"] as Priority[]).map(p=><option key={p}>{p}</option>)}</select><small>{isManager?"Definida pelo gestor.":"A prioridade serÃ¡ definida pelo gestor."}</small></label><label>Prazo de entrega<input type="date" value={form.due} onChange={e=>setForm({...form,due:e.target.value})}/></label><label className="full">DescriÃ§Ã£o<textarea rows={4} value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Descreva o que precisa ser realizado..."/></label></div><div className="modalActions"><button className="secondary" onClick={()=>setShowNew(false)}>Cancelar</button><button className="primary" onClick={createTask} disabled={saving||!form.title.trim()||!form.due||!form.areaId||areaMembers.length===0||(areaMembers.length>1&&!form.ownerId)}>{saving?"Salvando...":"Criar solicitaÃ§Ã£o"}</button></div></div></div>}
    {selectedMember&&isManager&&<div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setSelectedMember(null)}}><div className="modal" style={{width:"96vw",maxWidth:"1600px",height:"94vh",maxHeight:"94vh",boxSizing:"border-box",overflowY:"auto",padding:"28px 32px"}}><div className="modalHead"><div><p className="eyebrow">GESTÃƒO DA EQUIPE</p><h2>{selectedMember.full_name}</h2><p>{selectedMember.email||"E-mail nÃ£o informado"}</p></div><button className="iconButton" onClick={()=>setSelectedMember(null)}><X/></button></div>
      {profile?.role==="admin"?<><div className="formGrid"><label className="full">Nome completo<input value={memberForm.full_name} onChange={e=>setMemberForm({...memberForm,full_name:e.target.value})}/></label><label>Perfil de acesso<select value={memberForm.role} onChange={e=>setMemberForm({...memberForm,role:e.target.value as Profile["role"]})}><option value="colaborador">Colaborador</option><option value="gestor">Gestor</option><option value="admin">Administrador</option></select></label><div className="full"><span style={{display:"block",fontWeight:600,marginBottom:10}}>Ãreas vinculadas</span><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(210px,1fr))",gap:10,padding:14,border:"1px solid #dfe3eb",borderRadius:10}}>{areas.map(a=><label key={a.id} style={{display:"flex",alignItems:"center",gap:9,fontWeight:400,cursor:"pointer"}}><input type="checkbox" checked={memberForm.area_ids.includes(a.id)} onChange={e=>setMemberForm(old=>({...old,area_ids:e.target.checked?[...old.area_ids,a.id]:old.area_ids.filter(id=>id!==a.id)}))} style={{width:16,height:16,margin:0}}/>{a.name}</label>)}</div><small style={{display:"block",marginTop:7,color:"#667085"}}>Selecione uma ou mais Ã¡reas para este colaborador.</small></div><div className="full" style={{padding:14,border:"1px solid #dfe3eb",borderRadius:10}}><b style={{display:"block",marginBottom:8}}>PermissÃ£o de estoque</b>{memberForm.role==="admin"?<small>Administradores possuem acesso automÃ¡tico ao gerenciamento de estoque.</small>:<label style={{display:"flex",alignItems:"center",gap:9,fontWeight:400,cursor:"pointer"}}><input type="checkbox" checked={memberForm.stock_manager} onChange={e=>setMemberForm({...memberForm,stock_manager:e.target.checked})} style={{width:16,height:16,margin:0}}/>Gerenciar Estoque</label>}<small style={{display:"block",marginTop:7,color:"#667085"}}>Quando habilitada, a pessoa poderÃ¡ cadastrar materiais e registrar movimentaÃ§Ãµes de estoque.</small></div><label className="full">SituaÃ§Ã£o<select value={memberForm.active?"true":"false"} onChange={e=>setMemberForm({...memberForm,active:e.target.value==="true"})}><option value="true">Ativo</option><option value="false">Inativo</option></select></label></div>{memberMessage&&<div className="errorBox" style={{marginTop:14}}>{memberMessage}</div>}<div className="modalActions"><button className="secondary" onClick={()=>setSelectedMember(null)}>Cancelar</button><button className="primary" onClick={saveMember} disabled={memberSaving||!memberForm.full_name.trim()}>{memberSaving?"Salvando...":"Salvar alteraÃ§Ãµes"}</button></div></>:<><div className="detailGrid"><div><small>Perfil</small><b>{selectedMember.role}</b></div><div><small>Ãreas</small><b>{(selectedMember.area_ids||[]).length ? areas.filter(a=>(selectedMember.area_ids||[]).includes(a.id)).map(a=>a.name).join(" Â· ") : "NÃ£o definidas"}</b></div></div><div className="modalActions"><button className="secondary" onClick={()=>setSelectedMember(null)}>Fechar</button></div></>}
      <div className="panel" style={{marginTop:22}}>
        <div className="panelHead"><div><h3>Demandas atribuÃ­das</h3><p>Acompanhamento das atividades sob responsabilidade de {selectedMember.full_name}.</p></div><span className="muted">{selectedMemberTasks.length} demanda(s)</span></div>
        <div className="stats" style={{gridTemplateColumns:"repeat(4,minmax(0,1fr))",marginBottom:18}}>
          <Stat icon={<ClipboardList/>} label="Total" value={selectedMemberTasks.length} tone="blue"/>
          <Stat icon={<Activity/>} label="Em andamento" value={memberTasksInProgress} tone="violet"/>
          <Stat icon={<CheckCircle2/>} label="ConcluÃ­das" value={memberTasksDone} tone="green"/>
          <Stat icon={<AlertTriangle/>} label="Atrasadas" value={memberTasksLate} tone="red"/>
        </div>
        <div className="toolbar"><div><b>Lista de demandas</b><p className="muted">Clique em uma demanda para abrir os detalhes e supervisionar o andamento.</p></div><label style={{minWidth:180}}>Filtrar por status<select value={memberTaskStatus} onChange={e=>setMemberTaskStatus(e.target.value)}><option value="Todas">Todos os status</option>{(["Recebida","Em anÃ¡lise","Aguardando aprovaÃ§Ã£o","Em execuÃ§Ã£o","ConcluÃ­da","Cancelada"] as Status[]).map(status=><option key={status} value={status}>{status}</option>)}</select></label></div>
        <div style={{maxHeight:"48vh",overflowY:"auto",width:"100%"}}><TaskTable tasks={visibleMemberTasks} onSelect={task=>{setSelectedMember(null);setSelected(task)}}/></div>
      </div>
    </div></div>}
    {selected&&<div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setSelected(null)}}><div className="modal"><div className="modalHead"><div><p className="eyebrow">PROTOCOLO #{selected.protocol}</p><h2>{selected.title}</h2><p>{selected.area} Â· Aberta em {new Date(selected.created+"T12:00:00").toLocaleDateString("pt-BR")}</p></div><button className="iconButton" onClick={()=>setSelected(null)}><X/></button></div><div className="detailGrid"><div><small>ResponsÃ¡vel</small><b>{selected.owner}</b></div><div><small>Prazo</small><b>{new Date(selected.due+"T12:00:00").toLocaleDateString("pt-BR")}</b></div><div><small>Prioridade</small><b>{selected.priority}</b></div><div><small>Status atual</small><StatusBadge status={selected.status}/></div></div><p className="description">{selected.description||"Sem descriÃ§Ã£o adicional."}</p>{(isManager || (selected.ownerId===profile?.id && selected.requesterId!==profile?.id))?<label>Atualizar status<select value={selected.status} onChange={e=>{const nextStatus=e.target.value as Status;if(nextStatus==="ConcluÃ­da"&&selected.status!=="ConcluÃ­da"){setCompleteConfirm(true);return;}updateTask(selected,{status:nextStatus});}}>{(["Recebida","Em anÃ¡lise","Aguardando aprovaÃ§Ã£o","Em execuÃ§Ã£o","ConcluÃ­da","Cancelada"] as Status[]).map(s=><option key={s}>{s}</option>)}</select></label>:<p className="notice">O status Ã© atualizado pelo responsÃ¡vel pela demanda ou pela gestÃ£o. O solicitante pode acompanhar a solicitaÃ§Ã£o, mas nÃ£o alterar seu status.</p>}{completeConfirm&&<div style={{padding:14,marginTop:12,border:"1px solid #f5d08a",background:"#fffbeb",borderRadius:10}}><b style={{color:"#92400e"}}>Confirmar conclusÃ£o da solicitaÃ§Ã£o?</b><p style={{margin:"6px 0 12px",fontSize:13,color:"#667085"}}>Ao confirmar, o sistema concluirÃ¡ a solicitaÃ§Ã£o e darÃ¡ baixa automÃ¡tica no estoque fÃ­sico dos materiais reservados. As reservas vinculadas serÃ£o encerradas e a movimentaÃ§Ã£o ficarÃ¡ registrada no histÃ³rico.</p><div className="modalActions" style={{marginTop:0}}><button className="secondary" onClick={()=>setCompleteConfirm(false)}>Voltar</button><button className="primary" onClick={()=>updateTask(selected,{status:"ConcluÃ­da"})}>Confirmar conclusÃ£o</button></div></div>}{isManager&&<><label>ResponsÃ¡vel<select value={selected.ownerId||""} onChange={e=>updateTask(selected,{ownerId:e.target.value||null})}><option value="">Selecione um responsÃ¡vel</option>{selectedAreaMembers.map(m=><option key={m.profile_id} value={m.profile_id}>{m.full_name}</option>)}</select><small>Somente integrantes ativos da Ã¡rea {selected.area} podem ser atribuÃ­dos.</small></label><label>Prioridade<select value={selected.priority} onChange={e=>updateTask(selected,{priority:e.target.value as Priority})}>{(["Baixa","MÃ©dia","Alta","Urgente"] as Priority[]).map(s=><option key={s}>{s}</option>)}</select></label></>}{(isManager || selected.requesterId===profile?.id)&&<div style={{marginTop:18}}>
      {deleteConfirm ? <div style={{padding:14,border:"1px solid #fecaca",background:"#fff7f7",borderRadius:10}}>
        <b style={{color:"#b42318"}}>Confirmar exclusÃ£o?</b>
        <p style={{margin:"6px 0 12px",fontSize:13,color:"#667085"}}>A solicitaÃ§Ã£o serÃ¡ retirada das listas, mas permanecerÃ¡ preservada no histÃ³rico do banco de dados.</p>
        <div className="modalActions" style={{marginTop:0}}><button className="secondary" onClick={()=>setDeleteConfirm(false)} disabled={deletingTask}>Cancelar</button><button onClick={()=>deleteTask(selected)} disabled={deletingTask} style={{background:"#b42318",color:"white",border:0,borderRadius:9,padding:"10px 16px",fontWeight:600,cursor:"pointer"}}>{deletingTask?"Excluindo...":"Confirmar exclusÃ£o"}</button></div>
      </div> : <div className="modalActions"><button className="secondary" onClick={()=>setSelected(null)}>Fechar</button><button onClick={()=>setDeleteConfirm(true)} style={{background:"#fff",color:"#b42318",border:"1px solid #fda29b",borderRadius:9,padding:"10px 16px",fontWeight:600,cursor:"pointer"}}>Excluir solicitaÃ§Ã£o</button></div>}
    </div>}{!isManager&&selected.requesterId!==profile?.id&&<div className="modalActions"><button className="secondary" onClick={()=>setSelected(null)}>Fechar</button></div>}{dataError&&<div className="errorBox" style={{marginTop:12}}>{dataError}</div>}</div></div>}
  </main>;
}
function Stat({icon,label,value,tone}:{icon:React.ReactNode,label:string,value:number,tone:string}) { return <div className="statCard"><div className={`statIcon ${tone}`}>{icon}</div><div><small>{label}</small><strong>{value}</strong></div></div>; }
function StatusBadge({status}:{status:Status}) { return <span className={`status ${statusClass[status]}`}>{status}</span>; }
function TaskTable({tasks,onSelect}:{tasks:Task[],onSelect:(t:Task)=>void}) { if(!tasks.length)return <div className="emptyTable">Nenhuma solicitaÃ§Ã£o cadastrada no Supabase.</div>; return <div className="tableWrap"><table><thead><tr><th>SolicitaÃ§Ã£o</th><th>Ãrea</th><th>ResponsÃ¡vel</th><th>Prioridade</th><th>Prazo</th><th>Status</th></tr></thead><tbody>{tasks.map(t=><tr key={t.id} onClick={()=>onSelect(t)}><td><b>#{t.protocol}</b><span>{t.title}</span></td><td>{t.area}</td><td>{t.owner}</td><td><span className={`priority ${t.priority.toLowerCase()}`}>{t.priority}</span></td><td>{new Date(t.due+"T12:00:00").toLocaleDateString("pt-BR")}</td><td><StatusBadge status={t.status}/></td></tr>)}</tbody></table></div>; }


