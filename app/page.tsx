"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import {
  Activity, BarChart3, CalendarDays, CheckCircle2, ChevronDown, ClipboardList,
  Clock3, Download, LayoutDashboard, LogOut, Menu, Package, Plus, Search, Settings,
  Users, X, AlertTriangle, Layers, ArrowUpRight, RefreshCw, ClipboardCheck, PackageCheck, History,
  MessageCircle, Send, Bell, ShieldCheck, FileSearch
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Status = "Recebida" | "Em análise" | "Aguardando aprovação" | "Em execução" | "Concluída" | "Cancelada";
type Priority = "Baixa" | "Média" | "Alta" | "Urgente";
type Area = { id: string; name: string };
type Profile = { id: string; full_name: string; email: string | null; role: "admin" | "gestor" | "colaborador"; area_id: string | null; area_ids?: string[]; active: boolean; stock_manager: boolean };
type Task = { id: string; protocol: number; title: string; area: string; areaId: string; owner: string; requester: string; requesterId: string; priority: Priority; status: Status; due: string; created: string; completedAt: string | null; description: string; ownerId: string | null };
type AreaMember = { profile_id: string; full_name: string };
type RequestComment = { id: string; request_id: string; author_id: string; body: string; created_at: string; author_name: string };
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
type MaterialOrderStatus = "aguardando_aprovacao_gestor" | "aguardando_aprovacao_estoque" | "em_separacao" | "aguardando_retirada" | "concluido" | "rejeitado_gestor" | "rejeitado_estoque" | "cancelado";
type MaterialOrder = { id:string; protocol:number; requester_id:string; area_id:string; purpose:string; needed_by:string; status:MaterialOrderStatus; manager_approver_id:string|null; stock_approver_id:string|null; rejection_reason:string|null; created_at:string; updated_at:string };
type MaterialOrderItem = { id:string; order_id:string; material_id:string; quantity:number; material?:{name:string;unit:string;sku:string|null} };
type MaterialOrderHistory = { id:string; order_id:string; actor_id:string|null; action:string; previous_status:string|null; new_status:string|null; details:string|null; created_at:string; actor_name?:string };
type AppNotification = { id:string; title:string; message:string; notification_type:string; material_order_id:string|null; is_read:boolean; created_at:string };
type AuditLog = { id:string; actor_id:string|null; actor_name:string|null; actor_email:string|null; action:"INSERT"|"UPDATE"|"DELETE"; table_name:string; record_id:string|null; old_values:Record<string,any>|null; new_values:Record<string,any>|null; created_at:string };

const statusToDb: Record<Status,string> = { "Recebida":"recebida", "Em análise":"em_analise", "Aguardando aprovação":"aguardando_aprovacao", "Em execução":"em_execucao", "Concluída":"concluida", "Cancelada":"cancelada" };
const dbToStatus: Record<string,Status> = { recebida:"Recebida", em_analise:"Em análise", aguardando_aprovacao:"Aguardando aprovação", em_execucao:"Em execução", concluida:"Concluída", cancelada:"Cancelada" };
const priorityToDb: Record<Priority,string> = { "Baixa":"baixa", "Média":"media", "Alta":"alta", "Urgente":"urgente" };
const dbToPriority: Record<string,Priority> = { baixa:"Baixa", media:"Média", alta:"Alta", urgente:"Urgente" };
const statusClass: Record<Status,string> = { "Recebida":"gray", "Em análise":"blue", "Aguardando aprovação":"amber", "Em execução":"violet", "Concluída":"green", "Cancelada":"red" };
const defaultAreas = ["Criação","Trade Marketing","Eventos e Ações","Materiais e Estoque","E-commerce","Planejamento e Marketing","Social Media"];

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
  const [requestComments,setRequestComments] = useState<RequestComment[]>([]);
  const [commentsLoading,setCommentsLoading] = useState(false);
  const [commentsSending,setCommentsSending] = useState(false);
  const [commentsError,setCommentsError] = useState("");
  const [commentDraft,setCommentDraft] = useState("");
  const [unreadCounts,setUnreadCounts] = useState<Record<string,number>>({});
  const [commentNotice,setCommentNotice] = useState("");
  const [notifications,setNotifications] = useState<AppNotification[]>([]);
  const [notificationsLoading,setNotificationsLoading] = useState(false);
  const [notificationsError,setNotificationsError] = useState("");
  const [showNotifications,setShowNotifications] = useState(false);
  const [selectedMember,setSelectedMember] = useState<Profile|null>(null);
  const [memberSaving,setMemberSaving] = useState(false);
  const [memberMessage,setMemberMessage] = useState("");
  const [memberTaskStatus,setMemberTaskStatus] = useState("Todas");
  const [deleteConfirm,setDeleteConfirm] = useState(false);
  const [deletingTask,setDeletingTask] = useState(false);
  const [completeConfirm,setCompleteConfirm] = useState(false);
  const [pendingTaskUpdate,setPendingTaskUpdate] = useState<{task:Task;patch:Partial<Task>}|null>(null);
  const [memberForm,setMemberForm] = useState({full_name:"",role:"colaborador" as Profile["role"],area_ids:[] as string[],active:true,stock_manager:false});
  const [saving,setSaving] = useState(false);
  const [form,setForm] = useState({title:"",areaId:"",ownerId:"",priority:"Média" as Priority,due:"",description:""});
  const isManager = profile?.role === "admin" || profile?.role === "gestor";
  const canManageStock = profile?.role === "admin" || profile?.stock_manager === true;

  const [stockMaterials,setStockMaterials] = useState<Material[]>([]);
  const [stockMovements,setStockMovements] = useState<StockMovement[]>([]);
  const [stockLoading,setStockLoading] = useState(false);
  const [stockError,setStockError] = useState("");
  const [stockSaving,setStockSaving] = useState(false);
  const [showNewMaterial,setShowNewMaterial] = useState(false);
  const [editingMaterialId,setEditingMaterialId] = useState<string|null>(null);
  const [materialImageFile,setMaterialImageFile] = useState<File|null>(null);
  const [materialImagePreview,setMaterialImagePreview] = useState("");
  const [removeMaterialImage,setRemoveMaterialImage] = useState(false);
  const [materialImageUrls,setMaterialImageUrls] = useState<Record<string,string>>({});
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
  const [auditLogs,setAuditLogs] = useState<AuditLog[]>([]);
  const [auditLoading,setAuditLoading] = useState(false);
  const [auditError,setAuditError] = useState("");
  const [auditSearch,setAuditSearch] = useState("");
  const [auditActorFilter,setAuditActorFilter] = useState("Todos");
  const [auditModuleFilter,setAuditModuleFilter] = useState("Todos");
  const [auditActionFilter,setAuditActionFilter] = useState("Todos");
  const [auditStartDate,setAuditStartDate] = useState("");
  const [auditEndDate,setAuditEndDate] = useState("");
  const [selectedAuditLog,setSelectedAuditLog] = useState<AuditLog|null>(null);
  const [listPagination,setListPagination] = useState<Record<string,{page:number;pageSize:number}>>({});
  const getPagination = (key:string,total:number) => { const current=listPagination[key]||{page:1,pageSize:10}; const totalPages=Math.max(1,Math.ceil(total/current.pageSize)); const page=Math.min(current.page,totalPages); return {page,pageSize:current.pageSize,total,totalPages}; };
  const pageItems = <T,>(key:string,items:T[]) => { const {page,pageSize}=getPagination(key,items.length); return items.slice((page-1)*pageSize,page*pageSize); };
  const setListPage = (key:string,page:number) => setListPagination(old=>({...old,[key]:{...(old[key]||{page:1,pageSize:10}),page}}));
  const setListPageSize = (key:string,pageSize:number) => setListPagination(old=>({...old,[key]:{page:1,pageSize}}));
  const paginationProps = (key:string,total:number) => ({...getPagination(key,total),onPageChange:(page:number)=>setListPage(key,page),onPageSizeChange:(size:number)=>setListPageSize(key,size)});

  useEffect(() => {
    if (!supabase) { setAuthLoading(false); setLoginError("As variáveis do Supabase não foram encontradas. Confira o arquivo .env.local e reinicie o servidor."); return; }
    supabase.auth.getSession().then(({data}) => { setSession(data.session); setAuthLoading(false); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event,nextSession) => { setSession(nextSession); setProfile(null); });
    return () => listener.subscription.unsubscribe();
  },[]);

  const loadData = useCallback(async (user: User) => {
    if (!supabase) return;
    setDataLoading(true); setDataError("");
    try {
      const profileResult = await supabase.from("profiles").select("id,full_name,email,role,area_id,active,stock_manager").eq("id",user.id).single();
      if (
        profileResult.error?.code === "PGRST116" ||
        (!profileResult.error && !profileResult.data) ||
        profileResult.data?.active === false
      ) {
        setProfile(null);
        setAreas([]);
        setTasks([]);
        setMembers([]);
        setDataError("");
        setLoginError("Seu acesso ao sistema foi desativado. Entre em contato com o administrador.");
        await supabase.auth.signOut();
        return;
      }
      if (profileResult.error) throw profileResult.error;
      const p = profileResult.data as Profile;
      const [areaResult, requestResult, memberResult, profileAreasResult] = await Promise.all([
        supabase.from("areas").select("id,name").eq("active",true).order("name"),
        supabase.from("requests").select("id,protocol,title,description,area_id,requester_id,owner_id,priority,status,due_date,created_at,completed_at,deleted_at, area:areas!requests_area_id_fkey(name), owner:profiles!requests_owner_id_fkey(full_name), requester:profiles!requests_requester_id_fkey(full_name)").is("deleted_at",null).order("created_at",{ascending:false}),
        supabase.from("profiles").select("id,full_name,email,role,area_id,active,stock_manager").order("full_name"),
        supabase.from("profile_areas").select("profile_id,area_id")
      ]);
      if (areaResult.error) throw areaResult.error;
      if (requestResult.error) throw requestResult.error;
      if (memberResult.error) throw memberResult.error;
      if (profileAreasResult.error) throw profileAreasResult.error;
      const areaLinks = (profileAreasResult.data || []) as {profile_id:string;area_id:string}[];
      const idsForProfile = (id:string) => areaLinks.filter(link => link.profile_id === id).map(link => link.area_id);
      setProfile({...p, area_ids: idsForProfile(p.id)});
      setAreas((areaResult.data||[]) as Area[]);
      setMembers(((memberResult.data||[]) as Profile[]).map(member => ({...member, area_ids: idsForProfile(member.id)})));
      const mapped = (requestResult.data||[]).map((r:any):Task => ({
        id:r.id, protocol:Number(r.protocol), title:r.title, area:r.area?.name||"Área não definida", areaId:r.area_id,
        owner:r.owner?.full_name||"Não atribuído", ownerId:r.owner_id, requester:r.requester?.full_name||"Solicitante", requesterId:r.requester_id,
        priority:dbToPriority[r.priority]||"Média", status:dbToStatus[r.status]||"Recebida",
        due:r.due_date, created:r.created_at?.slice(0,10)||"", completedAt:r.completed_at||null, description:r.description||""
      }));
      setTasks(mapped);
    } catch (error:any) {
      setDataError(error.message || "Não foi possível carregar os dados do Supabase.");
    } finally { setDataLoading(false); }
  },[]);

  const refreshUnreadCounts = useCallback(async () => {
    if (!supabase || !profile?.id || !tasks.length) {
      setUnreadCounts({});
      return;
    }
    const requestIds = tasks.map(task => task.id);
    const [commentsResult, readsResult] = await Promise.all([
      supabase.from("request_comments").select("request_id,author_id,created_at").in("request_id", requestIds),
      supabase.from("request_comment_reads").select("request_id,last_read_at").eq("profile_id", profile.id).in("request_id", requestIds)
    ]);
    if (commentsResult.error || readsResult.error) return;
    const lastReadByRequest = new Map<string,string>(
      (readsResult.data || []).map((read:any) => [read.request_id, read.last_read_at] as [string,string])
    );
    const counts:Record<string,number> = {};
    for (const comment of (commentsResult.data || []) as {request_id:string;author_id:string;created_at:string}[]) {
      const lastReadAt = lastReadByRequest.get(comment.request_id);
      if (comment.author_id !== profile.id && (!lastReadAt || comment.created_at > lastReadAt)) {
        counts[comment.request_id] = (counts[comment.request_id] || 0) + 1;
      }
    }
    setUnreadCounts(counts);
  },[profile?.id,tasks]);

  const loadRequestComments = useCallback(async (requestId:string, markRead=true) => {
    if (!supabase || !profile?.id) return;
    setCommentsLoading(true);
    setCommentsError("");
    const {data,error} = await supabase
      .from("request_comments")
      .select("id,request_id,author_id,body,created_at,author:profiles!request_comments_author_id_fkey(full_name)")
      .eq("request_id",requestId)
      .order("created_at",{ascending:true});
    if (error) {
      setCommentsError(error.message);
      setCommentsLoading(false);
      return;
    }
    const names = new Map<string,string>(members.map(member => [member.id,member.full_name]));
    names.set(profile.id,profile.full_name);
    setRequestComments(((data || []) as (Omit<RequestComment,"author_name"> & {author?:{full_name:string}[]|null})[]).map(comment => ({
      id:comment.id,
      request_id:comment.request_id,
      author_id:comment.author_id,
      body:comment.body,
      created_at:comment.created_at,
      author_name:comment.author?.[0]?.full_name || names.get(comment.author_id) || "Usuário"
    })));
    if (markRead) {
      const {error:readError} = await supabase.from("request_comment_reads").upsert({
        request_id:requestId,
        profile_id:profile.id,
        last_read_at:new Date().toISOString()
      },{onConflict:"request_id,profile_id"});
      if (readError) {
        setCommentsError("As mensagens foram carregadas, mas não foi possível atualizar a leitura: " + readError.message);
      } else {
        setUnreadCounts(old => ({...old,[requestId]:0}));
      }
    }
    setCommentsLoading(false);
  },[profile?.id,profile?.full_name,members]);

  async function sendRequestComment() {
    if (!supabase || !profile || !selected) return;
    const body = commentDraft.trim();
    if (!body || body.length > 5000) return;
    setCommentsSending(true);
    setCommentsError("");
    const {error} = await supabase.from("request_comments").insert({
      request_id:selected.id,
      author_id:profile.id,
      body
    });
    if (error) {
      setCommentsError(error.message);
    } else {
      setCommentDraft("");
      await loadRequestComments(selected.id,true);
    }
    setCommentsSending(false);
  }


  const loadAuditLogs = useCallback(async () => {
    if (!supabase || profile?.role !== "admin") {
      setAuditLogs([]);
      setAuditError("A consulta da auditoria é restrita a administradores.");
      return;
    }
    setAuditLoading(true);
    setAuditError("");
    const {data,error} = await supabase.from("audit_logs").select("id,actor_id,actor_name,actor_email,action,table_name,record_id,old_values,new_values,created_at").order("created_at",{ascending:false}).limit(500);
    if (error) { setAuditError("Não foi possível carregar a auditoria: " + error.message); setAuditLogs([]); }
    else setAuditLogs((data || []) as AuditLog[]);
    setAuditLoading(false);
  },[profile?.role]);

  const loadNotifications = useCallback(async () => {
    if (!supabase || !profile?.id) {
      setNotifications([]);
      return;
    }
    setNotificationsLoading(true);
    setNotificationsError("");
    const {data,error} = await supabase
      .from("notifications")
      .select("id,title,message,notification_type,material_order_id,is_read,created_at")
      .eq("recipient_id",profile.id)
      .order("created_at",{ascending:false})
      .limit(30);
    if (error) setNotificationsError("Não foi possível carregar as notificações: " + error.message);
    else setNotifications((data || []) as AppNotification[]);
    setNotificationsLoading(false);
  },[profile?.id]);

  async function markNotificationRead(notificationId:string) {
    if (!supabase || !profile?.id) return;
    const {error} = await supabase.from("notifications").update({is_read:true}).eq("id",notificationId).eq("recipient_id",profile.id);
    if (!error) setNotifications(old=>old.map(item=>item.id===notificationId?{...item,is_read:true}:item));
  }

  async function markAllNotificationsRead() {
    if (!supabase || !profile?.id) return;
    const {error} = await supabase.from("notifications").update({is_read:true}).eq("recipient_id",profile.id).eq("is_read",false);
    if (error) setNotificationsError("Não foi possível marcar as notificações como lidas: " + error.message);
    else setNotifications(old=>old.map(item=>({...item,is_read:true})));
  }

  async function openNotification(notification:AppNotification) {
    if (!notification.is_read) await markNotificationRead(notification.id);
    setShowNotifications(false);
    if (notification.material_order_id) {
      const alreadyViewingOrders = active === "Pedidos de Materiais";
      setActive("Pedidos de Materiais");
      setSelected(null);
      setSelectedMaterialOrder(notification.material_order_id);
      if (alreadyViewingOrders) await loadMaterialOrders();
    }
  }

  useEffect(() => {
    if (profile?.id && tasks.length) void refreshUnreadCounts();
    else setUnreadCounts({});
  },[profile?.id,tasks,refreshUnreadCounts]);

  useEffect(() => {
    if (!selected) setPendingTaskUpdate(null);
  },[selected]);

  useEffect(() => {
    if (selected?.id && profile?.id) {
      setRequestComments([]);
      setCommentDraft("");
      void loadRequestComments(selected.id,true);
    } else {
      setRequestComments([]);
      setCommentDraft("");
      setCommentsError("");
    }
  },[selected?.id,profile?.id,loadRequestComments]);

  useEffect(() => {
    const currentUserId = session?.user?.id;
    if (!supabase || !currentUserId) return;
    const channel = supabase
      .channel("request-comments-" + currentUserId)
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"request_comments"},(payload:any) => {
        const message = payload.new as {request_id:string;author_id:string};
        if (!message?.request_id || message.author_id === currentUserId) return;
        const task = tasks.find(item => item.id === message.request_id);
        if (!task) return;
        setCommentNotice("Nova mensagem na solicitação #" + task.protocol + ": " + task.title);
        if (selected?.id === message.request_id) {
          void loadRequestComments(message.request_id,true);
        } else {
          setUnreadCounts(old => ({...old,[message.request_id]:(old[message.request_id] || 0) + 1}));
        }
      })
      .subscribe();
    return () => { if (supabase) void supabase.removeChannel(channel); };
  },[session?.user?.id,selected?.id,tasks,loadRequestComments]);

  const loadStock = useCallback(async () => {
    if (!supabase) return;
    setStockLoading(true);
    setStockError("");
    try {
      const { data: materialsData, error: materialsError } = await supabase
        .from("materials")
        .select("id,sku,name,description,unit,quantity,minimum_quantity,active,image_path")
        .eq("active", true)
        .order("name");
      if (materialsError) throw materialsError;
      const materialRows = (materialsData || []) as Material[];
      setStockMaterials(materialRows);
      const storage = supabase.storage;
      const signedImages = await Promise.all(materialRows.filter(m=>m.image_path).map(async m=>{
        const {data} = await storage.from("material-images").createSignedUrl(m.image_path!,3600);
        return data?.signedUrl ? [m.id,data.signedUrl] as const : null;
      }));
      setMaterialImageUrls(Object.fromEntries(signedImages.filter((item):item is readonly [string,string]=>item!==null)));

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
      setStockError(error.message || "Não foi possível carregar o estoque.");
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
        supabase.from("materials").select("id,sku,name,description,unit,quantity,minimum_quantity,active,image_path").eq("active",true).order("name")
      ]);
      if (ordersResult.error) throw ordersResult.error;
      if (materialsResult.error) throw materialsResult.error;
      const rows = (ordersResult.data || []) as MaterialOrder[];
      setMaterialOrders(rows);
      const orderMaterials = (materialsResult.data || []) as Material[];
      setStockMaterials(orderMaterials);
      const storage = supabase.storage;
      const signedImages = await Promise.all(orderMaterials.filter(m=>m.image_path).map(async m=>{
        const {data} = await storage.from("material-images").createSignedUrl(m.image_path!,3600);
        return data?.signedUrl ? [m.id,data.signedUrl] as const : null;
      }));
      setMaterialImageUrls(Object.fromEntries(signedImages.filter((item):item is readonly [string,string]=>item!==null)));
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
        setMaterialOrderHistory(historyRows.map(item=>({...item,actor_name:item.actor_id?(actorMap[item.actor_id]||"Usuário"):"Sistema"})));
      }
    } catch (error:any) {
      setOrdersError(error.message || "Não foi possível carregar os pedidos de materiais.");
    } finally {
      setOrdersLoading(false);
    }
  },[]);


  useEffect(() => {
    if (profile?.id) void loadNotifications();
    else setNotifications([]);
  },[profile?.id,loadNotifications]);

  useEffect(() => {
    if (!supabase || !profile?.id) return;
    const channel = supabase
      .channel("notifications-" + profile.id)
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"notifications",filter:"recipient_id=eq." + profile.id},(payload:any) => {
        const incoming = payload.new as AppNotification;
        if (!incoming?.id) return;
        setNotifications(old=>[incoming,...old.filter(item=>item.id!==incoming.id)].slice(0,30));
        setCommentNotice(incoming.title);
      })
      .subscribe();
    return () => { if (supabase) void supabase.removeChannel(channel); };
  },[profile?.id]);

  useEffect(() => { if (session?.user) loadData(session.user); },[session,loadData]);
  useEffect(() => { if (active === "Estoque" && profile) loadStock(); },[active,profile,loadStock]);
  useEffect(() => { if (active === "Pedidos de Materiais" && profile) loadMaterialOrders(); },[active,profile,loadMaterialOrders]);
  useEffect(() => { if (active === "Auditoria" && profile?.role === "admin") void loadAuditLogs(); },[active,profile?.role,loadAuditLogs]);
  useEffect(() => { setDeleteConfirm(false); setCompleteConfirm(false); setListPage("comments",1); }, [selected?.id]);
  useEffect(() => { setListPage("orderItems",1); setListPage("orderHistory",1); },[selectedMaterialOrder]);
  useEffect(() => { setListPage("memberTasks",1); },[selectedMember?.id]);
  useEffect(() => { setListPagination(old=>Object.fromEntries(Object.entries(old).map(([key,value])=>[key,{...value,page:1}]))); },[search,requestUserFilter,scheduleOwnerFilter,scheduleAreaFilter,scheduleStatusFilter,schedulePeriod,scheduleStartDate,scheduleEndDate,stockSearch,stockReportMaterial,stockReportType,stockReportStart,stockReportEnd,reportDateMode,reportPeriod,reportStartDate,reportEndDate,reportAreaFilter,reportOwnerFilter,reportStatusFilter,auditSearch,auditActorFilter,auditModuleFilter,auditActionFilter,auditStartDate,auditEndDate,memberTaskStatus]);
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
        setDataError(`Não foi possível carregar os responsáveis da área: ${error.message}`);
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
        setDataError(`Não foi possível carregar os responsáveis da solicitação: ${error.message}`);
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
      || (requestUserFilter === "Sem responsável" && !t.ownerId)
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
  const dashboardDateLabel = dashboardDateMode === "created" ? "data de abertura" : dashboardDateMode === "due" ? "data do prazo" : "data de conclusão";
  const late = tasks.filter(t => t.status!=="Concluída" && t.status!=="Cancelada" && t.due && new Date(t.due+"T23:59:00") < new Date()).length;
  const done = tasks.filter(t=>t.status==="Concluída").length;
  const inProgress = tasks.filter(t=>t.status==="Em execução"||t.status==="Em análise"||t.status==="Aguardando aprovação").length;
  const areaNames = areas.length ? areas.map(a=>a.name) : defaultAreas;
  const dashboardLate = dashboardTasks.filter(t => t.status!=="Concluída" && t.status!=="Cancelada" && t.due && new Date(t.due+"T23:59:00") < new Date()).length;
  const dashboardDone = dashboardTasks.filter(t=>t.status==="Concluída").length;
  const dashboardInProgress = dashboardTasks.filter(t=>t.status==="Em execução"||t.status==="Em análise"||t.status==="Aguardando aprovação").length;
  const requestsByOwner = useMemo(() => {
    const grouped = new Map<string,{id:string;name:string;total:number;inProgress:number;done:number;late:number;cancelled:number}>();
    dashboardTasks.forEach(task => {
      if (!task.ownerId) return;
      const current = grouped.get(task.ownerId) || {id:task.ownerId,name:task.owner,total:0,inProgress:0,done:0,late:0,cancelled:0};
      current.total += 1;
      if (task.status === "Em análise" || task.status === "Aguardando aprovação" || task.status === "Em execução") current.inProgress += 1;
      if (task.status === "Concluída") current.done += 1;
      if (task.status === "Cancelada") current.cancelled += 1;
      if (task.status !== "Concluída" && task.status !== "Cancelada" && task.due && new Date(task.due+"T23:59:00") < new Date()) current.late += 1;
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
    if (reportOwnerFilter === "Sem responsável" && task.ownerId) return false;
    if (reportOwnerFilter !== "Todos" && reportOwnerFilter !== "Sem responsável" && task.ownerId !== reportOwnerFilter) return false;
    if (reportStatusFilter !== "Todos" && task.status !== reportStatusFilter) return false;
    if (reportPeriod === "all") return true;
    const {start,end}=reportDateRange;
    if (!start || !end || start > end) return false;
    const rawDate = reportDateMode === "created" ? task.created : reportDateMode === "due" ? task.due : task.completedAt?.slice(0,10) || "";
    return !!rawDate && rawDate >= start && rawDate <= end;
  }),[tasks,reportAreaFilter,reportOwnerFilter,reportStatusFilter,reportPeriod,reportDateRange,reportDateMode]);
  const reportToday = (() => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; })();
  const reportReceived = reportTasks.filter(t=>t.status==="Recebida").length;
  const reportAnalysis = reportTasks.filter(t=>t.status==="Em análise").length;
  const reportAwaitingApproval = reportTasks.filter(t=>t.status==="Aguardando aprovação").length;
  const reportExecuting = reportTasks.filter(t=>t.status==="Em execução").length;
  const reportDone = reportTasks.filter(t=>t.status==="Concluída").length;
  const reportLate = reportTasks.filter(t=>t.status!=="Concluída"&&t.status!=="Cancelada"&&t.due&&t.due<reportToday).length;
  const reportOpenBase = reportTasks.filter(t=>t.status!=="Concluída"&&t.status!=="Cancelada").length;
  const reportOverdueRate = reportOpenBase ? Math.round(reportLate/reportOpenBase*100) : 0;
  const reportCancelled = reportTasks.filter(t=>t.status==="Cancelada").length;
  const reportCompletionBase = reportTasks.filter(t=>t.status!=="Cancelada").length;
  const reportCompletionRate = reportCompletionBase ? Math.round(reportDone/reportCompletionBase*100) : 0;
  const reportByArea = areaNames.map(name=>({name,total:reportTasks.filter(t=>t.area===name).length})).filter(x=>x.total>0).sort((a,b)=>b.total-a.total);
  const reportByOwner = (() => {
    const grouped = new Map<string,{id:string;name:string;total:number;done:number;inProgress:number;late:number}>();
    reportTasks.forEach(task=>{const key=task.ownerId||"unassigned";const item=grouped.get(key)||{id:key,name:task.ownerId?task.owner:"Sem responsável",total:0,done:0,inProgress:0,late:0};item.total++;if(task.status==="Concluída")item.done++;if(task.status==="Em execução"||task.status==="Em análise"||task.status==="Aguardando aprovação")item.inProgress++;if(task.status!=="Concluída"&&task.status!=="Cancelada"&&task.due&&new Date(task.due+"T23:59:00")<new Date())item.late++;grouped.set(key,item);});
    return [...grouped.values()].sort((a,b)=>b.total-a.total||a.name.localeCompare(b.name,"pt-BR"));
  })();
  const reportDateLabel = reportDateMode==="created"?"data de abertura":reportDateMode==="completed"?"data de conclusão":"data do prazo";
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
    if (scheduleOwnerFilter === "Sem responsável" && task.ownerId) return false;
    if (scheduleOwnerFilter !== "Todos" && scheduleOwnerFilter !== "Sem responsável" && task.ownerId !== scheduleOwnerFilter) return false;
    if (scheduleAreaFilter !== "Todas" && task.areaId !== scheduleAreaFilter) return false;
    if (scheduleStatusFilter !== "Todos" && task.status !== scheduleStatusFilter) return false;
    if (schedulePeriod === "overdue") return task.status !== "Concluída" && task.status !== "Cancelada" && !!task.due && task.due < scheduleToday;
    if (schedulePeriod === "custom") {
      if (!task.due) return false;
      if (scheduleStartDate && task.due < scheduleStartDate) return false;
      if (scheduleEndDate && task.due > scheduleEndDate) return false;
      return true;
    }
    if (schedulePeriod === "7" || schedulePeriod === "30") {
      const limit = new Date(); limit.setDate(limit.getDate() + Number(schedulePeriod));
      const end = `${limit.getFullYear()}-${String(limit.getMonth()+1).padStart(2,"0")}-${String(limit.getDate()).padStart(2,"0")}`;
      return !!task.due && task.due >= scheduleToday && task.due <= end && task.status !== "Concluída" && task.status !== "Cancelada";
    }
    return true;
  }).sort((a,b) => (a.due || "9999-99-99").localeCompare(b.due || "9999-99-99")), [tasks,scheduleOwnerFilter,scheduleAreaFilter,scheduleStatusFilter,schedulePeriod,scheduleStartDate,scheduleEndDate,scheduleToday]);
  const scheduleOverdueCount = tasks.filter(t=>t.status!=="Concluída"&&t.status!=="Cancelada"&&t.due&&t.due<scheduleToday).length;
  const scheduleTodayCount = tasks.filter(t=>t.status!=="Concluída"&&t.status!=="Cancelada"&&t.due===scheduleToday).length;
  const scheduleNextSevenCount = tasks.filter(t=>t.status!=="Concluída"&&t.status!=="Cancelada"&&t.due&&t.due>=scheduleToday&&t.due<=(()=>{const d=new Date();d.setDate(d.getDate()+7);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`})()).length;
  const selectedMemberTasks = useMemo(() => selectedMember ? tasks.filter(t => t.ownerId === selectedMember.id) : [], [tasks, selectedMember]);
  const visibleMemberTasks = useMemo(() => memberTaskStatus === "Todas" ? selectedMemberTasks : selectedMemberTasks.filter(t => t.status === memberTaskStatus), [selectedMemberTasks, memberTaskStatus]);
  const memberTasksLate = selectedMemberTasks.filter(t => t.status !== "Concluída" && t.status !== "Cancelada" && t.due && new Date(t.due + "T23:59:00") < new Date()).length;
  const memberTasksInProgress = selectedMemberTasks.filter(t => t.status === "Em execução" || t.status === "Em análise" || t.status === "Aguardando aprovação").length;
  const memberTasksDone = selectedMemberTasks.filter(t => t.status === "Concluída").length;
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
  const orderAreaName = (id:string) => areas.find(area=>area.id===id)?.name || "Área não identificada";
  const orderRequesterName = (id:string) => members.find(member=>member.id===id)?.full_name || (id===profile?.id?profile.full_name:"Solicitante");
  const orderStatusLabels:Record<MaterialOrderStatus,string> = {
    aguardando_aprovacao_gestor:"Aguardando aprovação do gestor",
    aguardando_aprovacao_estoque:"Aguardando aprovação do estoque",
    em_separacao:"Em separação",
    aguardando_retirada:"Aguardando retirada",
    concluido:"Concluído",
    rejeitado_gestor:"Rejeitado pelo gestor",
    rejeitado_estoque:"Rejeitado pelo estoque",
    cancelado:"Cancelado"
  };
  const selectedOrder = materialOrders.find(order=>order.id===selectedMaterialOrder) || null;
  const unreadNotificationCount = notifications.filter(item=>!item.is_read).length;
  const selectedOrderItems = materialOrderItems.filter(item=>item.order_id===selectedMaterialOrder);
  const selectedOrderHistory = materialOrderHistory.filter(item=>item.order_id===selectedMaterialOrder);
  const pendingManagerOrders = materialOrders.filter(order=>order.status==="aguardando_aprovacao_gestor").length;
  const pendingStockOrders = materialOrders.filter(order=>order.status==="aguardando_aprovacao_estoque").length;
  const activeMaterialOrders = materialOrders.filter(order=>["em_separacao","aguardando_retirada"].includes(order.status)).length;

  async function createMaterialOrder() {
    if (!supabase || !profile) return;
    const cleanItems = orderDraftItems.map(item=>({material_id:item.material_id,quantity:Number(item.quantity)}));
    if (!orderAreaId || !myOrderAreas.some(area=>area.id===orderAreaId)) { setOrdersError("Selecione uma área à qual você esteja vinculado."); return; }
    if (!orderPurpose.trim()) { setOrdersError("Informe a finalidade do pedido."); return; }
    if (!orderNeededBy) { setOrdersError("Informe quando os materiais serão necessários."); return; }
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
      reason = window.prompt(functionName==="cancel_material_order"?"Informe o motivo do cancelamento:":"Informe o motivo da rejeição:")?.trim() || "";
      if (!reason) { setOrdersError("A justificativa é obrigatória para esta operação."); return; }
    }
    if (functionName==="complete_material_order" && !window.confirm("Confirmar a entrega? Esta ação dará baixa no estoque físico e encerrará as reservas.")) return;
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
      setDataError("A área selecionada não possui responsáveis ativos.");
      return;
    }
    if (areaMembers.length > 1 && !form.ownerId) {
      setDataError("Selecione o responsável pela solicitação.");
      return;
    }
    if (form.ownerId && !areaMembers.some(member => member.profile_id === form.ownerId)) {
      setDataError("O responsável selecionado não pertence à área escolhida.");
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
      setForm(old => ({ ...old, title: "", ownerId: "", priority: "Média", due: "", description: "" }));
      if (session?.user) await loadData(session.user);
    }
    setSaving(false);
  }
  function openNewMaterial() {
    setEditingMaterialId(null);
    setMaterialForm({name:"",sku:"",description:"",unit:"un",minimum_quantity:"0"});
    setMaterialImageFile(null);
    setMaterialImagePreview("");
    setRemoveMaterialImage(false);
    setShowNewMaterial(true);
  }

  function openEditMaterial(material:Material) {
    if (!canManageStock) return;
    setEditingMaterialId(material.id);
    setMaterialForm({name:material.name,sku:material.sku||"",description:material.description||"",unit:material.unit,minimum_quantity:String(material.minimum_quantity)});
    setMaterialImageFile(null);
    setMaterialImagePreview(materialImageUrls[material.id]||"");
    setRemoveMaterialImage(false);
    setShowNewMaterial(true);
  }

  async function createMaterial() {
    if (!supabase || !canManageStock) return;
    const name = materialForm.name.trim();
    const minimum = Number(materialForm.minimum_quantity || 0);
    if (!name) { setStockError("Informe o nome do material."); return; }
    if (!editingMaterialId && (!Number.isFinite(minimum) || minimum < 0)) { setStockError("Informe um estoque mínimo válido."); return; }

    setStockSaving(true);
    setStockError("");
    let uploadedPath:string|null = null;
    let materialSaved = false;
    try {
      if (materialImageFile) {
        const targetId = editingMaterialId || crypto.randomUUID();
        const safeName = materialImageFile.name.normalize("NFD").replace(/[\\u0300-\\u036f]/g,"").replace(/[^a-zA-Z0-9._-]/g,"-");
        uploadedPath = targetId + "/" + Date.now() + "-" + safeName;
        const {error:uploadError} = await supabase.storage.from("material-images").upload(uploadedPath,materialImageFile,{upsert:false,contentType:materialImageFile.type});
        if (uploadError) throw uploadError;
      }

      if (editingMaterialId) {
        const current = stockMaterials.find(item=>item.id===editingMaterialId);
        if (!current) throw new Error("O material selecionado não foi encontrado. Atualize a lista e tente novamente.");
        const nextImagePath = uploadedPath || (removeMaterialImage ? null : current.image_path);
        const {error} = await supabase.from("materials").update({
          name,
          description:materialForm.description.trim()||null,
          image_path:nextImagePath
        }).eq("id",editingMaterialId);
        if (error) throw error;
        materialSaved = true;
        if (uploadedPath && current.image_path) await supabase.storage.from("material-images").remove([current.image_path]);
        if (removeMaterialImage && current.image_path) await supabase.storage.from("material-images").remove([current.image_path]);
      } else {
        const {error} = await supabase.from("materials").insert({
          name,
          sku:materialForm.sku.trim()||null,
          description:materialForm.description.trim()||null,
          unit:materialForm.unit.trim()||"un",
          quantity:0,
          minimum_quantity:minimum,
          active:true,
          image_path:uploadedPath
        });
        if (error) throw error;
        materialSaved = true;
      }

      setShowNewMaterial(false);
      setEditingMaterialId(null);
      setMaterialImageFile(null);
      setMaterialImagePreview("");
      setRemoveMaterialImage(false);
      setMaterialForm({name:"",sku:"",description:"",unit:"un",minimum_quantity:"0"});
      await loadStock();
    } catch (error:any) {
      if (uploadedPath && !materialSaved) await supabase.storage.from("material-images").remove([uploadedPath]);
      setStockError(error.message || "Não foi possível salvar o material.");
    } finally {
      setStockSaving(false);
    }
  }

  async function createStockMovement() {
    if (!supabase || !canManageStock) return;
    const amount = Number(movementForm.quantity);
    if (!movementForm.material_id) { setStockError("Selecione um material."); return; }
    if (!Number.isFinite(amount) || amount < 0 || (movementForm.movement_type !== "ajuste" && amount <= 0)) {
      setStockError(movementForm.movement_type === "ajuste"
        ? "Informe um saldo físico contado válido (zero ou maior)."
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
        setStockError("Nenhum ajuste foi necessário: o saldo informado já corresponde ao estoque registrado.");
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
      setMemberMessage(`Não foi possível salvar o cadastro: ${error.message}`);
      setMemberSaving(false);
      return;
    }

    const { error: stockPermissionError } = await supabase.rpc("admin_set_stock_permission", {
      target_profile: selectedMember.id,
      enabled: memberForm.role === "admin" ? false : memberForm.stock_manager
    });

    if (stockPermissionError) {
      setMemberMessage(`O cadastro foi atualizado, mas não foi possível salvar a permissão de estoque: ${stockPermissionError.message}`);
      if (session?.user) await loadData(session.user);
      setMemberSaving(false);
      return;
    }

    setMemberMessage("Cadastro e permissão atualizados com sucesso.");
    if (session?.user) await loadData(session.user);
    setSelectedMember(null);
    setMemberSaving(false);
  }

  async function deleteTask(task:Task) {
    if (!supabase || !profile) return;
    const canDelete = isManager || task.requesterId === profile.id;
    if (!canDelete) {
      setDataError("Você só pode excluir solicitações abertas por você. Gestores e administradores podem excluir qualquer solicitação.");
      return;
    }
    setDeletingTask(true);
    setDataError("");
    const { error } = await supabase.rpc("soft_delete_request", { target_request: task.id });
    if (error) {
      setDataError(`Não foi possível excluir a solicitação: ${error.message}`);
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
      setDataError("Somente o responsável pela demanda ou um gestor pode alterar o status. O solicitante não pode alterar o status da própria solicitação.");
      return;
    }
    if ((patch.priority !== undefined || patch.ownerId !== undefined) && !isManager) {
      setDataError("Somente gestores e administradores podem alterar a prioridade ou o responsável.");
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
      setPendingTaskUpdate(null);
      setSelected(null);
      if(session?.user) await loadData(session.user);
    }
  }

  if (authLoading) return <div className="authScreen"><div className="authCard"><div className="brandMark"><Layers size={22}/></div><h1>Gestão de Demandas DelRio</h1><p>Verificando sua sessão...</p></div></div>;
  if (!session) return <div className="authScreen"><form className="authCard" onSubmit={signIn}><div className="authBrand"><div className="brandMark"><Layers size={22}/></div><div><b>DELRIO</b><small>GESTÃO DE DEMANDAS</small></div></div><p className="eyebrow">AMBIENTE DE MARKETING</p><h1>Acesse sua conta</h1><p className="authSub">Entre com seu e-mail e senha cadastrados no sistema.</p><label>E-mail<input type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} placeholder="seuemail@delrio.com.br" required/></label><label>Senha<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Digite sua senha" required/></label>{loginError&&<div className="errorBox">{loginError}</div>}<button className="primary authSubmit" disabled={loginLoading}>{loginLoading?"Entrando...":"Entrar"}</button><small className="authFoot">Acesso restrito à equipe autorizada.</small></form></div>;

  const nav = [["Dashboard",LayoutDashboard],["Solicitações",ClipboardList],["Pedidos de Materiais",ClipboardCheck],["Cronograma",CalendarDays],["Colaboradores",Users],["Estoque",Package],["Relatórios",BarChart3],["Configurações",Settings],...(profile?.role === "admin" ? [["Auditoria",ShieldCheck] as const] : [])] as const;
  const auditActors = [...new Set(auditLogs.map(log=>log.actor_name || "Sistema"))].sort((a,b)=>a.localeCompare(b,"pt-BR"));
  const auditModules = [...new Set(auditLogs.map(log=>log.table_name))].sort((a,b)=>a.localeCompare(b,"pt-BR"));
  const filteredAuditLogs = auditLogs.filter(log => {
    const actor = log.actor_name || "Sistema";
    const haystack = [actor,log.actor_email || "",log.table_name,log.record_id || "",log.action].join(" ").toLowerCase();
    if (auditSearch.trim() && !haystack.includes(auditSearch.trim().toLowerCase())) return false;
    if (auditActorFilter !== "Todos" && actor !== auditActorFilter) return false;
    if (auditModuleFilter !== "Todos" && log.table_name !== auditModuleFilter) return false;
    if (auditActionFilter !== "Todos" && log.action !== auditActionFilter) return false;
    const date = log.created_at.slice(0,10);
    if (auditStartDate && date < auditStartDate) return false;
    if (auditEndDate && date > auditEndDate) return false;
    return true;
  });
  return <main className="shell">
    <aside className={`sidebar ${mobileMenu?"open":""}`}>
      <div className="brand"><div className="brandMark"><Layers size={21}/></div><div><b>DELRIO</b><small>GESTÃO DE DEMANDAS</small></div><button className="closeMenu" onClick={()=>setMobileMenu(false)}><X/></button></div>
      <div className="workspace"><span className="dot"/> Ambiente de Marketing <ChevronDown size={14}/></div><div className="navLabel">MENU PRINCIPAL</div>
      {nav.map(([name,Icon])=><button key={name} className={`navItem ${active===name?"active":""}`} onClick={()=>{setActive(name);setMobileMenu(false);setSelected(null)}}><Icon size={18}/>{name}{name==="Solicitações"&&<span className="navCount">{tasks.length}</span>}</button>)}
      <div className="sidebarBottom"><div className="userAvatar">{(profile?.full_name||"U").split(" ").map(x=>x[0]).slice(0,2).join("").toUpperCase()}</div><div><b>{profile?.full_name||"Usuário"}</b><small>{profile?.role==="admin"?"Administrador":profile?.role==="gestor"?"Gestor":"Colaborador"}</small></div><button className="logoutIcon" title="Sair" onClick={signOut}><LogOut size={16}/></button></div>
    </aside>
    <style>{`.listPagination{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:14px 16px;border-top:1px solid #f0edf4}.paginationSummary{font-size:12px;color:#777487}.paginationSummary b{color:#4b3a60}.paginationControls{display:flex;align-items:center;gap:5px;flex-wrap:wrap}.paginationSize{display:flex;align-items:center;gap:7px;margin-right:7px;color:#777487;font-size:11px;font-weight:600}.paginationSize select{height:32px;padding:0 8px;border:1px solid #e1e2ea;border-radius:8px;background:#fff;color:#454253;font:500 12px inherit}.paginationButton{min-width:32px;height:32px;padding:0 9px;border:1px solid #e5e2eb;border-radius:8px;background:#fff;color:#686579;font:600 11px inherit;cursor:pointer}.paginationButton:hover:not(:disabled){border-color:#c7a5e8;color:#7022bd}.paginationButton.active{border-color:#7a1bd8;background:#f5edff;color:#7020c5}.paginationButton:disabled{opacity:.4;cursor:not-allowed}.paginationDots{padding:0 3px;color:#858397}@media(max-width:620px){.listPagination{align-items:flex-start}.paginationControls{width:100%}.paginationSize{margin-right:auto}}`}</style>
    <section className="main">
      <header className="topbar"><button className="menuButton" onClick={()=>setMobileMenu(true)}><Menu/></button><div className="crumb">Marketing <span>/</span> {active}</div><div className="topRight"><div className="notificationWrap"><button className="notificationBell" type="button" aria-label="Abrir notificações" title="Notificações" onClick={()=>setShowNotifications(old=>!old)}><Bell size={19}/>{unreadNotificationCount>0&&<span className="notificationBadge">{unreadNotificationCount>99?"99+":unreadNotificationCount}</span>}</button>{showNotifications&&<div className="notificationPanel"><div className="notificationPanelHead"><div><b>Notificações</b><small>{unreadNotificationCount} não lida(s)</small></div><div className="notificationPanelActions"><button className="textButton" type="button" onClick={markAllNotificationsRead} disabled={!unreadNotificationCount}>Marcar todas como lidas</button><button className="iconButton" type="button" aria-label="Fechar notificações" onClick={()=>setShowNotifications(false)}><X size={14}/></button></div></div>{notificationsError&&<div className="notificationError">{notificationsError}</div>}{notificationsLoading&&!notifications.length?<div className="notificationEmpty">Carregando notificações...</div>:!notifications.length?<div className="notificationEmpty">Você ainda não tem notificações.</div>:<><div className="notificationList">{pageItems("notifications",notifications).map(item=><button type="button" key={item.id} className={`notificationItem ${item.is_read?"read":"unread"}`} onClick={()=>void openNotification(item)}><span className="notificationItemDot"/><span className="notificationItemContent"><b>{item.title}</b><span>{item.message}</span><small>{new Date(item.created_at).toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"})}</small></span></button>)}</div><Pagination {...paginationProps("notifications",notifications.length)}/></>}</div>}</div><span className="online"><i/> {dataLoading?"Sincronizando":"Conectado ao Supabase"}</span><div className="userAvatar">{(profile?.full_name||"U").split(" ").map(x=>x[0]).slice(0,2).join("").toUpperCase()}</div></div></header>
      <div className="content">
        {dataError&&<div className="errorBanner"><span>{dataError}</span><button onClick={()=>session?.user&&loadData(session.user)}>Tentar novamente</button></div>}
        {commentNotice&&<div className="notice" style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,marginBottom:16}}><span style={{display:"flex",alignItems:"center",gap:8}}><Bell size={16}/>{commentNotice}</span><button className="textButton" onClick={()=>setCommentNotice("")}>Fechar</button></div>}
        {active==="Dashboard" && <>
          <div className="pageHeading"><div><p className="eyebrow">VISÃO GERAL</p><h1>Dashboard</h1><p className="sub">Acompanhe as demandas e a operação do Marketing DelRio.</p></div><button className="primary" onClick={()=>setShowNew(true)}><Plus size={17}/> Nova solicitação</button></div>
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
              <div className="dashFilterTitle"><span className="dashFilterIcon"><CalendarDays size={19}/></span><div><h3>Filtros do Dashboard</h3><p>Personalize a análise das solicitações por data e período.</p></div></div>
              <button className="dashClear" onClick={()=>{setDashboardPeriod("all");setDashboardDateMode("created");setDashboardStart("");setDashboardEnd("")}}>Limpar filtros</button>
            </div>
            <div className="dashFilterGrid">
              <div><label className="dashFieldLabel" htmlFor="dashboard-date-mode">Considerar data</label><select id="dashboard-date-mode" className="dashDateSelect" value={dashboardDateMode} onChange={e=>setDashboardDateMode(e.target.value as "created"|"completed"|"due")}><option value="created">Data de abertura</option><option value="completed">Data de conclusão</option><option value="due">Data do prazo</option></select></div>
              <div><span className="dashFieldLabel">Período de análise</span><div className="dashPeriodOptions">{[{value:"all",label:"Todo o período"},{value:"month",label:"Este mês"},{value:"30",label:"Últimos 30 dias"},{value:"90",label:"Últimos 90 dias"},{value:"year",label:"Este ano"},{value:"custom",label:"Personalizado"}].map(option=><button key={option.value} type="button" className={`dashPeriodButton ${dashboardPeriod===option.value?"active":""}`} aria-pressed={dashboardPeriod===option.value} onClick={()=>setDashboardPeriod(option.value)}>{option.label}</button>)}</div></div>
            </div>
            {dashboardPeriod==="custom"&&<div className="dashCustomDates"><div><label className="dashFieldLabel" htmlFor="dashboard-start">Data inicial</label><input id="dashboard-start" className="dashDateInput" type="date" value={dashboardStart} onChange={e=>setDashboardStart(e.target.value)}/></div><div><label className="dashFieldLabel" htmlFor="dashboard-end">Data final</label><input id="dashboard-end" className="dashDateInput" type="date" value={dashboardEnd} min={dashboardStart||undefined} onChange={e=>setDashboardEnd(e.target.value)}/></div></div>}
            {dashboardPeriod==="custom"&&dashboardStart&&dashboardEnd&&dashboardStart>dashboardEnd&&<p className="dashFilterError">A data inicial não pode ser posterior à data final.</p>}
            {dashboardDateMode==="completed"&&<p className="dashFilterNote">A análise por conclusão utiliza a data registrada quando a solicitação foi concluída. Solicitações concluídas antes da ativação desse registro podem não aparecer nesse filtro.</p>}
            <div className="dashFilterBottom"><span className="dashFilterSummary"><CalendarDays size={14}/> Critério: <strong>{dashboardDateLabel}</strong></span><span className="dashFilterSummary">{dashboardTasks.length} solicitação(ões) no resultado</span></div>
          </section>
          <div className="stats"><Stat icon={<ClipboardList/>} label="Total de solicitações" value={dashboardTasks.length} tone="blue"/><Stat icon={<Activity/>} label="Em andamento" value={dashboardInProgress} tone="violet"/><Stat icon={<CheckCircle2/>} label="Concluídas" value={dashboardDone} tone="green"/><Stat icon={<AlertTriangle/>} label="Atrasadas" value={dashboardLate} tone="red"/></div>
          <div className="gridMain"><div className="panel"><div className="panelHead"><div><h3>Solicitações recentes</h3><p>Demandas dentro do período selecionado</p></div><button className="textButton" onClick={()=>setActive("Solicitações")}>Ver todas <ArrowUpRight size={15}/></button></div><TaskTable tasks={[...dashboardTasks].sort((a,b)=>b.created.localeCompare(a.created)).slice(0,5)} onSelect={setSelected} unreadCounts={unreadCounts}/></div>
            <div className="panel"><div className="panelHead"><div><h3>Distribuição por área</h3><p>Volume de solicitações no período</p></div></div><div className="areaBars">{areaNames.map(a=>{const n=dashboardTasks.filter(t=>t.area===a).length;return <div className="barRow" key={a}><div><span>{a}</span><b>{n}</b></div><div className="track"><i style={{width:`${dashboardTasks.length?n/dashboardTasks.length*100:0}%`}}/></div></div>})}</div></div></div>
          <div className="panel" style={{marginBottom:18}}>
            <div className="panelHead"><div><h3>Solicitações por colaborador</h3><p>Distribuição das demandas por responsável pela execução</p></div><span className="muted">{requestsByOwner.length} colaborador(es)</span></div>
            {!requestsByOwner.length ? <div className="emptyTable">Ainda não há solicitações atribuídas a colaboradores.</div> : <div className="tableWrap"><table><thead><tr><th>Colaborador responsável</th><th>Total atribuídas</th><th>Em andamento</th><th>Concluídas</th><th>Atrasadas</th><th>Canceladas</th></tr></thead><tbody>
              {pageItems("dashboardOwners",requestsByOwner).map(person=><tr key={person.id}><td><b>{person.name}</b></td><td><b>{person.total}</b></td><td>{person.inProgress}</td><td>{person.done}</td><td>{person.late}</td><td>{person.cancelled}</td></tr>)}
            </tbody></table></div>}{requestsByOwner.length>0&&<Pagination {...paginationProps("dashboardOwners",requestsByOwner.length)}/>}
          </div>
          <div className="panel"><div className="panelHead"><div><h3>Próximos prazos</h3><p>Demandas que exigem acompanhamento</p></div><button className="textButton" onClick={()=>setActive("Cronograma")}>Abrir cronograma <ArrowUpRight size={15}/></button></div><TaskTable tasks={[...dashboardTasks].filter(t=>t.status!=="Concluída"&&t.status!=="Cancelada").sort((a,b)=>a.due.localeCompare(b.due)).slice(0,4)} onSelect={setSelected} unreadCounts={unreadCounts}/></div>
        </>}
        {active==="Solicitações" && <><div className="pageHeading"><div><p className="eyebrow">GESTÃO OPERACIONAL</p><h1>Solicitações</h1><p className="sub">Cadastre, distribua e acompanhe as demandas.</p></div><button className="primary" onClick={()=>setShowNew(true)}><Plus size={17}/> Nova solicitação</button></div><style>{`
            .requestFilterCard{padding:22px 24px;margin-bottom:18px;border:1px solid #e7e8ef;background:linear-gradient(135deg,#fff 0%,#fcfbff 100%);box-shadow:0 5px 18px rgba(31,24,55,.035)}
            .requestFilterTop{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:20px}
            .requestFilterTitle{display:flex;align-items:center;gap:11px}
            .requestFilterIcon{width:38px;height:38px;display:grid;place-items:center;border-radius:12px;background:#f2eaff;color:#7a1bd8;flex:none}
            .requestFilterTitle h3{margin:0 0 4px;font-size:15px;font-weight:700;color:#20202b}
            .requestFilterTitle p{margin:0;font-size:12px;color:#858397}
            .requestFilterClear{border:0;background:transparent;color:#7624c7;font-size:12px;font-weight:700;padding:9px 10px;border-radius:8px;cursor:pointer;white-space:nowrap}
            .requestFilterClear:hover{background:#f5edff}
            .requestFilterGrid{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(230px,.9fr);gap:18px;align-items:end}
            .requestFilterField label{display:block;margin:0 0 9px;color:#565568;font-size:11px;font-weight:700;letter-spacing:.035em;text-transform:uppercase}
            .requestFilterControl{width:100%;height:43px;border:1px solid #e1e2ea;border-radius:10px;background:#fff;padding:0 12px;color:#292837;font-size:13px;font-weight:500;font-family:inherit;outline:none;transition:border-color .15s,box-shadow .15s;box-sizing:border-box}
            .requestFilterControl:focus{border-color:#9b5cdb;box-shadow:0 0 0 3px rgba(122,27,216,.10)}
            .requestFilterSearch{position:relative}
            .requestFilterSearch>svg{position:absolute;left:13px;top:50%;transform:translateY(-50%);color:#89869a;pointer-events:none}
            .requestFilterSearch .requestFilterControl{padding-left:40px}
            .requestFilterBottom{display:flex;align-items:center;justify-content:flex-end;gap:8px;margin-top:18px;padding-top:14px;border-top:1px solid #f0edf4;color:#777487;font-size:12px}
            .requestFilterBottom strong{color:#4b3a60;font-weight:700}
            @media(max-width:760px){.requestFilterCard{padding:18px}.requestFilterGrid{grid-template-columns:1fr;gap:16px}.requestFilterTop{margin-bottom:17px}}
          `}</style>
          <section className="panel requestFilterCard">
            <div className="requestFilterTop">
              <div className="requestFilterTitle"><span className="requestFilterIcon"><Search size={19}/></span><div><h3>Filtros das solicitações</h3><p>Encontre demandas por palavra-chave ou responsável.</p></div></div>
              <button type="button" className="secondary" style={{padding:"8px 12px",fontSize:12}} onClick={()=>{setSearch("");setRequestUserFilter("Todos")}}>Limpar filtros</button>
            </div>
            <div className="requestFilterGrid">
              <div className="requestFilterField"><label htmlFor="request-search">Buscar solicitações</label><div className="requestFilterSearch"><Search size={16}/><input id="request-search" className="requestFilterControl" placeholder="Título, área, responsável ou status..." value={search} onChange={e=>setSearch(e.target.value)}/></div></div>
              <div className="requestFilterField"><label htmlFor="request-user-filter">Responsável</label><select id="request-user-filter" className="requestFilterControl" value={requestUserFilter} onChange={e=>setRequestUserFilter(e.target.value)}><option value="Todos">Todos os usuários</option>{requestUsers.map(([id,name])=><option key={id} value={id}>{name}</option>)}{tasks.some(t=>!t.ownerId)&&<option value="Sem responsável">Sem responsável</option>}</select></div>
            </div>
            <div className="requestFilterBottom"><span><strong>{filtered.length}</strong> registro(s) encontrado(s)</span></div>
          </section>
          <div className="panel"><TaskTable tasks={pageItems("requests",filtered)} onSelect={setSelected} unreadCounts={unreadCounts}/><Pagination {...paginationProps("requests",filtered.length)}/></div></>}
        {active==="Pedidos de Materiais" && <>
          <div className="pageHeading"><div><p className="eyebrow">SUPRIMENTOS INTERNOS</p><h1>Pedidos de Materiais</h1><p className="sub">Solicite materiais, acompanhe aprovações e consulte a separação e entrega.</p></div><div style={{display:"flex",gap:10,flexWrap:"wrap"}}><button className="secondary" onClick={loadMaterialOrders} disabled={ordersLoading}><RefreshCw size={15}/> Atualizar</button><button className="primary" onClick={()=>{setOrdersError("");setOrderAreaId(myOrderAreas.some(a=>a.id===profile?.area_id)?profile?.area_id||"":myOrderAreas[0]?.id||"");setShowNewMaterialOrder(true)}} disabled={!myOrderAreas.length}><Plus size={16}/> Novo pedido</button></div></div>
          {ordersError&&<div className="errorBanner"><span>{ordersError}</span><button onClick={()=>setOrdersError("")}>Fechar</button></div>}
          <div className="stats"><Stat icon={<ClipboardList/>} label="Pedidos visíveis" value={materialOrders.length} tone="blue"/><Stat icon={<Clock3/>} label="Aguardando gestor" value={pendingManagerOrders} tone="violet"/><Stat icon={<PackageCheck/>} label="Aguardando estoque" value={pendingStockOrders} tone="amber"/><Stat icon={<Layers/>} label="Em atendimento" value={activeMaterialOrders} tone="green"/></div>
          <div className="panel"><div className="panelHead"><div><h3>Pedidos cadastrados</h3><p>Os pedidos exibidos respeitam as permissões de acesso do seu perfil.</p></div><span className="muted">{materialOrders.length} registro(s)</span></div>
            {ordersLoading?<div className="emptyTable">Carregando pedidos de materiais...</div>:!materialOrders.length?<div className="emptyTable">Nenhum pedido de materiais encontrado. Use “Novo pedido” para registrar a primeira solicitação.</div>:<div className="tableWrap"><table><thead><tr><th>Pedido</th><th>Solicitante / Área</th><th>Necessário em</th><th>Materiais</th><th>Status</th><th style={{textAlign:"right"}}>Ação</th></tr></thead><tbody>{pageItems("orders",materialOrders).map(order=>{const count=materialOrderItems.filter(item=>item.order_id===order.id).length;return <tr key={order.id}><td><div style={{display:"flex",flexDirection:"column",gap:3}}><b style={{whiteSpace:"nowrap"}}>#{order.protocol}</b><span className="muted" style={{fontSize:12}}>{new Date(order.created_at).toLocaleDateString("pt-BR")}</span></div></td><td><div style={{display:"flex",flexDirection:"column",gap:3,minWidth:130}}><b>{orderRequesterName(order.requester_id)}</b><span className="muted" style={{fontSize:12}}>{orderAreaName(order.area_id)}</span></div></td><td style={{whiteSpace:"nowrap"}}>{order.needed_by?new Date(order.needed_by+"T12:00:00").toLocaleDateString("pt-BR"):"—"}</td><td><span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",minWidth:28,padding:"4px 9px",borderRadius:20,background:"var(--surface-soft,#f4f2f8)",fontSize:12,fontWeight:700}}>{count}</span><span className="muted" style={{fontSize:12,marginLeft:7}}>{count===1?"material":"materiais"}</span></td><td><span className={`status ${order.status==="concluido"?"green":order.status.startsWith("rejeitado")||order.status==="cancelado"?"red":order.status.includes("aguardando")?"amber":"blue"}`}>{orderStatusLabels[order.status]}</span></td><td style={{textAlign:"right"}}><button className="textButton" style={{whiteSpace:"nowrap"}} onClick={()=>setSelectedMaterialOrder(order.id)}>Ver detalhes <ArrowUpRight size={14}/></button></td></tr>})}</tbody></table></div>}<Pagination {...paginationProps("orders",materialOrders.length)}/>
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
        </>}
        {active==="Cronograma" && <>
          <div className="pageHeading"><div><p className="eyebrow">PLANEJAMENTO</p><h1>Cronograma da equipe</h1><p className="sub">Acompanhe prazos, responsáveis e andamento das entregas.</p></div></div>
          <div className="stats" style={{marginBottom:18}}>
            <Stat icon={<AlertTriangle/>} label="Atrasadas" value={scheduleOverdueCount} tone="red"/>
            <Stat icon={<CalendarDays/>} label="Vencem hoje" value={scheduleTodayCount} tone="red"/>
            <Stat icon={<Clock3/>} label="Próximos 7 dias" value={scheduleNextSevenCount} tone="violet"/>
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
              <div className="scheduleFilterTitle"><span className="scheduleFilterIcon"><CalendarDays size={19}/></span><div><h3>Filtros do cronograma</h3><p>Personalize a agenda por prazo, responsável, área e status.</p></div></div>
              <button className="secondary" style={{padding:"8px 12px",fontSize:12}} onClick={()=>{setScheduleOwnerFilter("Todos");setScheduleAreaFilter("Todas");setScheduleStatusFilter("Todos");setSchedulePeriod("all");setScheduleStartDate("");setScheduleEndDate("")}}>Limpar filtros</button>
            </div>
            <div className="scheduleFilterGrid">
              <div><label className="scheduleFieldLabel" htmlFor="schedule-period">Período</label><select id="schedule-period" className="scheduleSelect" value={schedulePeriod} onChange={e=>setSchedulePeriod(e.target.value)}><option value="all">Todos os prazos</option><option value="7">Próximos 7 dias</option><option value="30">Próximos 30 dias</option><option value="overdue">Somente atrasadas</option><option value="custom">Personalizado</option></select></div>
              <div><label className="scheduleFieldLabel" htmlFor="schedule-owner">Responsável</label><select id="schedule-owner" className="scheduleSelect" value={scheduleOwnerFilter} onChange={e=>setScheduleOwnerFilter(e.target.value)}><option value="Todos">Todos os colaboradores</option>{requestUsers.map(([id,name])=><option key={id} value={id}>{name}</option>)}{tasks.some(t=>!t.ownerId)&&<option value="Sem responsável">Sem responsável</option>}</select></div>
              <div><label className="scheduleFieldLabel" htmlFor="schedule-area">Área</label><select id="schedule-area" className="scheduleSelect" value={scheduleAreaFilter} onChange={e=>setScheduleAreaFilter(e.target.value)}><option value="Todas">Todas as áreas</option>{areas.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
              <div><label className="scheduleFieldLabel" htmlFor="schedule-status">Status</label><select id="schedule-status" className="scheduleSelect" value={scheduleStatusFilter} onChange={e=>setScheduleStatusFilter(e.target.value)}><option value="Todos">Todos os status</option>{(["Recebida","Em análise","Aguardando aprovação","Em execução","Concluída","Cancelada"] as Status[]).map(st=><option key={st} value={st}>{st}</option>)}</select></div>
              {schedulePeriod==="custom"&&<><div><label className="scheduleFieldLabel" htmlFor="schedule-start-date">Data inicial</label><input id="schedule-start-date" className="scheduleSelect" type="date" value={scheduleStartDate} onChange={e=>setScheduleStartDate(e.target.value)} max={scheduleEndDate||undefined}/></div><div><label className="scheduleFieldLabel" htmlFor="schedule-end-date">Data final</label><input id="schedule-end-date" className="scheduleSelect" type="date" value={scheduleEndDate} onChange={e=>setScheduleEndDate(e.target.value)} min={scheduleStartDate||undefined}/></div></>}
            </div>
            <div className="scheduleFilterBottom"><span className="scheduleFilterSummary"><CalendarDays size={14}/> Visualização: <strong>{schedulePeriod==="all"?"Todos os prazos":schedulePeriod==="7"?"Próximos 7 dias":schedulePeriod==="30"?"Próximos 30 dias":schedulePeriod==="overdue"?"Somente atrasadas":`Personalizado${scheduleStartDate||scheduleEndDate?` · ${scheduleStartDate?new Date(scheduleStartDate+"T12:00:00").toLocaleDateString("pt-BR"):"início livre"} até ${scheduleEndDate?new Date(scheduleEndDate+"T12:00:00").toLocaleDateString("pt-BR"):"sem limite"}`:" · informe as datas"}`}</strong></span><span className="scheduleFilterSummary">{scheduleTasks.length} resultado(s)</span></div>
          </section>
          <div className="panel"><div className="panelHead"><div><h3>Agenda de entregas</h3><p>Ordenada pelo prazo mais próximo. Selecione uma demanda para abrir seus detalhes.</p></div></div>
            <div className="timeline">{pageItems("schedule",scheduleTasks).map(t=><button className="timelineItem" key={t.id} onClick={()=>setSelected(t)}><div className="dateBlock"><b>{t.due?.slice(8,10)||"—"}</b><small>{t.due?new Date(t.due+"T12:00:00").toLocaleDateString("pt-BR",{month:"short"}):"Sem prazo"}</small></div><div className="timelineInfo"><b>{t.title}</b><small>{t.owner} · {t.area} · #{t.protocol}</small></div><div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>{t.status!=="Concluída"&&t.status!=="Cancelada"&&t.due&&t.due<scheduleToday&&<span className="status red">Atrasada</span>}<StatusBadge status={t.status}/></div></button>)}{!scheduleTasks.length&&<div className="emptyTable">Nenhuma solicitação encontrada com os filtros selecionados.</div>}</div><Pagination {...paginationProps("schedule",scheduleTasks.length)}/>
          </div>
        </>}
        {active==="Colaboradores" && <><div className="pageHeading"><div><p className="eyebrow">EQUIPE</p><h1>Colaboradores</h1><p className="sub">Gerencie áreas, perfis e situação dos usuários cadastrados.</p></div><button className="secondary" onClick={()=>session?.user&&loadData(session.user)}><RefreshCw size={15}/> Atualizar lista</button></div>
          <div className="panel"><div className="panelHead"><div><h3>Equipe cadastrada</h3><p>{members.length} colaborador(es) cadastrado(s)</p></div></div>
            {profile?.role==="admin"&&<div className="notice">Para adicionar uma pessoa, primeiro crie o usuário em Supabase → Authentication → Users → Add user. O banco cria o perfil automaticamente. Depois atualize esta lista para gerenciar sua área e função.</div>}
            <div className="memberGrid">{pageItems("members",members).map(m=><button className="memberCard memberButton" key={m.id} onClick={()=>{setSelectedMember(m);setMemberTaskStatus("Todas");setMemberForm({full_name:m.full_name,role:m.role,area_ids:m.area_ids||[],active:m.active,stock_manager:m.stock_manager===true});setMemberMessage("")}}><div className="userAvatar">{m.full_name.split(" ").map(x=>x[0]).slice(0,2).join("")}</div><b>{m.full_name}</b><small>{m.email||"Sem e-mail"}</small><small>{m.role==="admin"?"Administrador":m.role==="gestor"?"Gestor":"Colaborador"}</small><small>{(m.area_ids||[]).length ? areas.filter(a=>(m.area_ids||[]).includes(a.id)).map(a=>a.name).join(" · ") : "Área não definida"}</small></button>)}{!members.length&&<div className="emptyTable">Nenhum colaborador visível para este perfil.</div>}</div><Pagination {...paginationProps("members",members.length)}/>
          </div></>}
        {active==="Estoque" && <>
          <div className="pageHeading">
            <div><p className="eyebrow">MATERIAIS</p><h1>Estoque</h1><p className="sub">Controle de materiais promocionais, disponibilidade e movimentações.</p></div>
            {canManageStock && <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
              <button className="secondary" onClick={()=>loadStock()} disabled={stockLoading}><RefreshCw size={15}/> Atualizar</button>
              <button className="secondary" onClick={openNewMaterial}><Plus size={16}/> Novo material</button>
              <button className="primary" onClick={()=>{setMovementForm(old=>({...old,material_id:old.material_id||stockMaterials[0]?.id||""}));setShowStockMovement(true)}} disabled={!stockMaterials.length}><ArrowUpRight size={16}/> Nova movimentação</button>
            </div>}
          </div>
          {stockError && <div className="errorBanner"><span>{stockError}</span><button onClick={()=>setStockError("")}>Fechar</button></div>}
          {!canManageStock && <div className="notice" style={{marginBottom:16}}>Você possui acesso de consulta ao estoque. Para cadastrar materiais ou registrar movimentações, solicite ao administrador a permissão “Gerenciar Estoque”.</div>}
          {canManageStock && <>
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
          <div className="panel">
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
                    <td><div style={{display:"flex",alignItems:"center",gap:10}}>{materialImageUrls[m.id]?<img src={materialImageUrls[m.id]} alt="" style={{width:44,height:44,objectFit:"cover",borderRadius:8,border:"1px solid #e7e8ef",flexShrink:0}}/>:<span style={{width:44,height:44,borderRadius:8,background:"#f5f1fa",display:"grid",placeItems:"center",color:"#8a62b1",flexShrink:0}}><Package size={18}/></span>}<div><b>{m.name}</b>{m.description&&<span style={{display:"block",fontSize:12,color:"#667085",marginTop:3}}>{m.description}</span>}</div></div></td>
                    <td>{m.sku||"—"}</td>
                    <td>{Number(m.quantity).toLocaleString("pt-BR",{maximumFractionDigits:2})} {m.unit}</td>
                    {canManageStock&&<><td>{reserved.toLocaleString("pt-BR",{maximumFractionDigits:2})} {m.unit}</td><td><b>{available.toLocaleString("pt-BR",{maximumFractionDigits:2})} {m.unit}</b></td></>}
                    <td>{Number(m.minimum_quantity).toLocaleString("pt-BR",{maximumFractionDigits:2})} {m.unit}</td>
                    <td><span className={`status ${low?"red":"green"}`}>{low?"Estoque baixo":"Regular"}</span></td>
                    {canManageStock&&<td><div style={{display:"flex",alignItems:"center",gap:10}}><button className="textButton" onClick={()=>openEditMaterial(m)}>Editar</button><button className="textButton" onClick={()=>{setMovementForm({material_id:m.id,movement_type:"entrada",quantity:"",request_id:"",notes:""});setShowStockMovement(true)}}>Movimentar</button></div></td>}
                  </tr>;
                })}
              </tbody></table></div>}<Pagination {...paginationProps("materials",filteredMaterials.length)}/>
          </div>
          {canManageStock && <>
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
        </>}
        {active==="Relatórios" && <>
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
              <div><label className="reportFieldLabel" htmlFor="report-owner">Responsável</label><select id="report-owner" className="reportSelect" value={reportOwnerFilter} onChange={e=>setReportOwnerFilter(e.target.value)}><option value="Todos">Todos os colaboradores</option>{requestUsers.map(([id,name])=><option key={id} value={id}>{name}</option>)}{tasks.some(t=>!t.ownerId)&&<option value="Sem responsável">Sem responsável</option>}</select></div>
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
          <section className="panel reportPanel" style={{marginTop:18}}><div className="reportPanelHead"><div><h3>Detalhamento das solicitações</h3><p>Consulte os registros que compõem os indicadores acima.</p></div></div><TaskTable tasks={pageItems("reportTasks",[...reportTasks].sort((a,b)=>b.created.localeCompare(a.created)))} onSelect={setSelected} unreadCounts={unreadCounts}/><Pagination {...paginationProps("reportTasks",reportTasks.length)}/></section>
        </>}
        {active==="Configurações" && <><div className="pageHeading"><div><p className="eyebrow">ADMINISTRAÇÃO</p><h1>Configurações</h1><p className="sub">Parâmetros do ambiente e sua conta.</p></div></div><div className="panel"><h3>Áreas cadastradas no Supabase</h3><div className="areaList">{areaNames.map(a=><div key={a}><Layers size={17}/>{a}<span>Ativa</span></div>)}</div><p className="notice">Usuário conectado: {profile?.email}. Perfil: {profile?.role}. A prioridade é controlada por gestores e administradores.</p></div></>}
        {active==="Auditoria" && profile?.role==="admin" && <>
          <div className="pageHeading"><div><p className="eyebrow">CONTROLE E RASTREABILIDADE</p><h1>Auditoria</h1><p className="sub">Consulte as ações realizadas nos módulos operacionais e administrativos.</p></div><button className="secondary" type="button" onClick={()=>void loadAuditLogs()} disabled={auditLoading}><RefreshCw size={15}/> {auditLoading?"Atualizando...":"Atualizar histórico"}</button></div>
          <style>{`
            .auditFilterCard{padding:22px 24px;margin-bottom:18px;border:1px solid #e7e8ef;background:linear-gradient(135deg,#fff 0%,#fcfbff 100%);box-shadow:0 5px 18px rgba(31,24,55,.035)}
            .auditFilterTop{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:18px}
            .auditFilterTitle{display:flex;align-items:center;gap:11px}
            .auditFilterIcon{width:38px;height:38px;display:grid;place-items:center;border-radius:12px;background:#f2eaff;color:#7a1bd8;flex:none}
            .auditFilterTitle h3{margin:0 0 4px;font-size:15px;font-weight:700;color:#20202b}
            .auditFilterTitle p{margin:0;font-size:12px;color:#858397}
            .auditFilterGrid{display:grid;grid-template-columns:minmax(220px,1.5fr) repeat(3,minmax(145px,1fr));gap:12px;align-items:end}
            .auditField{display:grid;gap:7px;min-width:0;color:#565568;font-size:11px;font-weight:700}
            .auditControl{width:100%;height:42px;box-sizing:border-box;border:1px solid #e1e2ea;border-radius:10px;background:#fff;padding:0 11px;color:#292837;font:500 13px inherit;outline:none}
            .auditControl:focus{border-color:#9b5cdb;box-shadow:0 0 0 3px rgba(122,27,216,.10)}
            .auditDateGrid{display:grid;grid-template-columns:repeat(2,minmax(150px,1fr));gap:12px;margin-top:14px}
            .auditFilterBottom{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:16px;padding-top:13px;border-top:1px solid #f0edf4;color:#777487;font-size:12px}
            .auditTableWrap{overflow:auto;width:100%}.auditTable{width:100%;border-collapse:collapse;min-width:900px}
            .auditTable th{padding:12px 13px;text-align:left;background:#faf9fc;color:#777487;font-size:10px;letter-spacing:.04em;text-transform:uppercase;white-space:nowrap}
            .auditTable td{padding:13px;border-top:1px solid #f0edf4;color:#454253;font-size:12px;vertical-align:top}
            .auditActor{display:grid;gap:3px;min-width:145px}.auditActor b{color:#292536;font-size:12px}.auditActor small{color:#858397;font-size:10px}
            .auditAction{display:inline-flex;padding:5px 8px;border-radius:7px;background:#f2eaff;color:#7020c5;font-size:10px;font-weight:800}.auditAction.delete{background:#fff0f0;color:#b42318}.auditAction.insert{background:#ecfdf3;color:#027a48}
            .auditDetails{min-width:250px}.auditDetails summary{color:#7020c5;font-weight:700;cursor:pointer;list-style:none}.auditDetails summary::-webkit-details-marker{display:none}
            .auditDiff{display:grid;gap:7px;margin-top:10px;max-width:430px}.auditDiffRow{padding:8px 9px;border:1px solid #eee8f5;border-radius:8px;background:#fcfbfe;overflow-wrap:anywhere}.auditDiffRow b{display:block;margin-bottom:4px;color:#5b5368;font-size:10px}.auditDiffRow span{display:block;color:#454253;font-size:11px;line-height:1.45}
            .auditEmpty{padding:32px 18px;text-align:center;color:#858397;font-size:13px}
            @media(max-width:900px){.auditFilterGrid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:560px){.auditFilterCard{padding:17px}.auditFilterGrid,.auditDateGrid{grid-template-columns:1fr}.auditFilterTop{flex-direction:column}}
          `}</style>
          <section className="panel auditFilterCard">
            <div className="auditFilterTop"><div className="auditFilterTitle"><span className="auditFilterIcon"><FileSearch size={19}/></span><div><h3>Filtros do histórico</h3><p>Refine os registros por período, colaborador, módulo ou operação.</p></div></div><button type="button" className="secondary" style={{padding:"8px 12px",fontSize:12}} onClick={()=>{setAuditSearch("");setAuditActorFilter("Todos");setAuditModuleFilter("Todos");setAuditActionFilter("Todos");setAuditStartDate("");setAuditEndDate("")}}>Limpar filtros</button></div>
            <div className="auditFilterGrid">
              <label className="auditField">Buscar registro<input className="auditControl" value={auditSearch} onChange={e=>setAuditSearch(e.target.value)} placeholder="Nome, e-mail ou identificador..."/></label>
              <label className="auditField">Colaborador<select className="auditControl" value={auditActorFilter} onChange={e=>setAuditActorFilter(e.target.value)}><option value="Todos">Todos</option>{auditActors.map(actor=><option key={actor} value={actor}>{actor}</option>)}</select></label>
              <label className="auditField">Módulo<select className="auditControl" value={auditModuleFilter} onChange={e=>setAuditModuleFilter(e.target.value)}><option value="Todos">Todos</option>{auditModules.map(module=><option key={module} value={module}>{module.replaceAll("_"," ")}</option>)}</select></label>
              <label className="auditField">Tipo de ação<select className="auditControl" value={auditActionFilter} onChange={e=>setAuditActionFilter(e.target.value)}><option value="Todos">Todas</option><option value="INSERT">Inclusão</option><option value="UPDATE">Alteração</option><option value="DELETE">Exclusão</option></select></label>
            </div>
            <div className="auditDateGrid"><label className="auditField">Data inicial<input className="auditControl" type="date" value={auditStartDate} onChange={e=>setAuditStartDate(e.target.value)}/></label><label className="auditField">Data final<input className="auditControl" type="date" min={auditStartDate||undefined} value={auditEndDate} onChange={e=>setAuditEndDate(e.target.value)}/></label></div>
            <div className="auditFilterBottom"><span><b>{filteredAuditLogs.length}</b> registro(s) exibido(s)</span><span>Consulta dos 500 registros mais recentes</span></div>
          </section>
          {auditError&&<div className="errorBanner" style={{marginBottom:16}}>{auditError}</div>}
          <section className="panel">
            <div className="panelHead"><div><h3>Histórico de operações</h3><p>Valores anteriores e novos ficam disponíveis em cada registro.</p></div><span className="muted">{auditLogs.length} carregados</span></div>
            {auditLoading&&!auditLogs.length?<div className="auditEmpty">Carregando histórico de auditoria...</div>:!filteredAuditLogs.length?<div className="auditEmpty">Nenhum registro encontrado com os filtros selecionados.</div>:<div className="auditTableWrap"><table className="auditTable"><thead><tr><th>Data e hora</th><th>Colaborador</th><th>Ação</th><th>Módulo</th><th>Registro</th><th>Detalhes</th></tr></thead><tbody>
              {pageItems("audit",filteredAuditLogs).map(log=>{
                const oldValues=log.old_values||{};const newValues=log.new_values||{};
                const keys=[...new Set([...Object.keys(oldValues),...Object.keys(newValues)])].filter(key=>!["created_at","updated_at"].includes(key));
                const displayValue=(value:any)=>value===null||value===undefined?"—":typeof value==="object"?JSON.stringify(value):String(value);
                const changes=keys.filter(key=>JSON.stringify(oldValues[key])!==JSON.stringify(newValues[key]));
                return <tr key={log.id}><td style={{whiteSpace:"nowrap"}}>{new Date(log.created_at).toLocaleString("pt-BR")}</td><td><div className="auditActor"><b>{log.actor_name||"Sistema"}</b><small>{log.actor_email||"Ação automática"}</small></div></td><td><span className={`auditAction ${log.action.toLowerCase()}`}>{log.action==="INSERT"?"Inclusão":log.action==="UPDATE"?"Alteração":"Exclusão"}</span></td><td style={{whiteSpace:"nowrap",textTransform:"capitalize"}}>{log.table_name.replaceAll("_"," ")}</td><td style={{fontFamily:"monospace",fontSize:10}}>{log.record_id||"—"}</td><td><button type="button" onClick={()=>setSelectedAuditLog(log)} style={{border:0,background:"transparent",padding:0,color:"#7a1bd8",fontWeight:700,fontSize:12,cursor:"pointer",whiteSpace:"nowrap"}}>Ver {changes.length||keys.length} campo(s)</button></td></tr>;
              })}
            </tbody></table></div>}<Pagination {...paginationProps("audit",filteredAuditLogs.length)}/>
          </section>
        </>}
      </div>
    </section>
    {selectedAuditLog&&<div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setSelectedAuditLog(null)}}><div className="modal" style={{width:"min(760px,94vw)",maxHeight:"86vh",overflowY:"auto",boxSizing:"border-box"}}><div className="modalHead"><div><p className="eyebrow">DETALHES DA AUDITORIA</p><h2>{selectedAuditLog.action==="INSERT"?"Inclusão":selectedAuditLog.action==="UPDATE"?"Alteração":"Exclusão"} · {selectedAuditLog.table_name.replaceAll("_"," ")}</h2><p>{new Date(selectedAuditLog.created_at).toLocaleString("pt-BR")}</p></div><button className="iconButton" onClick={()=>setSelectedAuditLog(null)} aria-label="Fechar detalhes"><X/></button></div><div className="detailGrid" style={{marginBottom:18}}><div><small>Colaborador</small><b>{selectedAuditLog.actor_name||"Sistema"}</b></div><div><small>E-mail</small><b>{selectedAuditLog.actor_email||"Ação automática"}</b></div><div style={{gridColumn:"1 / -1"}}><small>Registro</small><b style={{fontFamily:"monospace",fontSize:11,overflowWrap:"anywhere"}}>{selectedAuditLog.record_id||"—"}</b></div></div><div style={{display:"grid",gap:10}}>{(()=>{const oldValues=selectedAuditLog.old_values||{};const newValues=selectedAuditLog.new_values||{};const keys=[...new Set([...Object.keys(oldValues),...Object.keys(newValues)])].filter(key=>!["created_at","updated_at"].includes(key));const visibleKeys=(selectedAuditLog.action==="INSERT"?Object.keys(newValues):selectedAuditLog.action==="DELETE"?Object.keys(oldValues):keys.filter(key=>JSON.stringify(oldValues[key])!==JSON.stringify(newValues[key]))).filter(key=>!["created_at","updated_at"].includes(key));const displayValue=(value:any)=>value===null||value===undefined?"—":typeof value==="object"?JSON.stringify(value):String(value);return visibleKeys.length?visibleKeys.map(key=><div key={key} style={{padding:"12px 14px",border:"1px solid #e8e3ef",borderRadius:11,background:"#fcfbfe",display:"grid",gap:7}}><b style={{fontSize:12,color:"#4b3b5f",textTransform:"capitalize"}}>{key.replaceAll("_"," ")}</b>{selectedAuditLog.action==="INSERT"?<div style={{fontSize:13,color:"#454253",overflowWrap:"anywhere"}}><span style={{color:"#7a1bd8",fontWeight:700}}>Novo valor:</span> {displayValue(newValues[key])}</div>:selectedAuditLog.action==="DELETE"?<div style={{fontSize:13,color:"#454253",overflowWrap:"anywhere"}}><span style={{color:"#b42318",fontWeight:700}}>Valor removido:</span> {displayValue(oldValues[key])}</div>:<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:8}}><div style={{padding:10,borderRadius:8,background:"#f3f3f6",fontSize:13,overflowWrap:"anywhere"}}><small style={{display:"block",color:"#777486",fontWeight:700,marginBottom:4}}>ANTERIOR</small>{displayValue(oldValues[key])}</div><div style={{padding:10,borderRadius:8,background:"#f5edff",fontSize:13,overflowWrap:"anywhere"}}><small style={{display:"block",color:"#7a1bd8",fontWeight:700,marginBottom:4}}>NOVO</small>{displayValue(newValues[key])}</div></div>}</div>):<div className="auditEmpty">Não há campos detalhados neste registro.</div>})()}</div><div className="modalActions"><button className="secondary" onClick={()=>setSelectedAuditLog(null)}>Fechar</button></div></div></div>}
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
      <div className="modalHead"><div><p className="eyebrow">NOVA SOLICITAÇÃO DE SUPRIMENTOS</p><h2>Novo pedido de materiais</h2><p>O pedido seguirá para aprovação do gestor e, depois, para aprovação do estoque.</p></div><button type="button" className="iconButton" onClick={()=>setShowNewMaterialOrder(false)}><X/></button></div>
      <div className="formGrid"><label>Área solicitante<select value={orderAreaId} onChange={e=>setOrderAreaId(e.target.value)}>{myOrderAreas.map(area=><option key={area.id} value={area.id}>{area.name}</option>)}</select></label><label>Data necessária<input type="date" value={orderNeededBy} onChange={e=>setOrderNeededBy(e.target.value)} min={new Date().toISOString().slice(0,10)}/></label><label className="full">Finalidade do pedido<textarea rows={3} value={orderPurpose} onChange={e=>setOrderPurpose(e.target.value)} placeholder="Explique para qual ação, campanha ou necessidade os materiais serão utilizados..."/></label></div>
      <div style={{marginTop:20}}>
        <div className="orderItemsHeader"><div><h3>Materiais solicitados</h3><p>Adicione cada material uma única vez e informe a quantidade desejada.</p></div><button type="button" className="secondary orderAddItem" onClick={()=>setOrderDraftItems(old=>[...old,{material_id:"",quantity:"1"}])}><Plus size={15}/> Adicionar item</button></div>
        <div className="orderItemsList">{orderDraftItems.map((item,index)=><div className="orderItemRow" key={index}>
          <label className="orderItemField">Material<select className="orderItemControl" value={item.material_id} onChange={e=>setOrderDraftItems(old=>old.map((row,i)=>i===index?{...row,material_id:e.target.value}:row))}><option value="">Selecione um material</option>{stockMaterials.filter(material=>!orderDraftItems.some((row,i)=>i!==index&&row.material_id===material.id)).map(material=><option key={material.id} value={material.id}>{material.name} · {material.unit}</option>)}</select></label>
          <label className="orderItemField">Quantidade<input className="orderItemControl" type="number" min="0.01" step="0.01" value={item.quantity} onChange={e=>setOrderDraftItems(old=>old.map((row,i)=>i===index?{...row,quantity:e.target.value}:row))}/></label>
          <button type="button" className="orderItemRemove" title="Remover item" aria-label="Remover item" disabled={orderDraftItems.length===1} onClick={()=>setOrderDraftItems(old=>old.filter((_,i)=>i!==index))}><X size={17}/></button>
        </div>)}</div>
      </div>
      {ordersError&&<div className="errorBox" style={{marginTop:14}}>{ordersError}</div>}
      <div className="modalActions"><button type="button" className="secondary" onClick={()=>setShowNewMaterialOrder(false)}>Cancelar</button><button type="button" className="primary" onClick={createMaterialOrder} disabled={ordersSaving||!stockMaterials.length||!orderAreaId}>{ordersSaving?"Enviando pedido...":"Enviar para aprovação"}</button></div>
    </div></div>}
    {showNewMaterial&&<div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setShowNewMaterial(false)}}><div className="modal">
      <div className="modalHead"><div><h2>{editingMaterialId?"Editar material":"Novo material"}</h2><p>{editingMaterialId?"Atualize o nome, a descrição ou a imagem. Os dados de estoque e o SKU serão preservados.":"O cadastro começa com estoque físico zero. A quantidade inicial será registrada como entrada."}</p></div><button className="iconButton" onClick={()=>setShowNewMaterial(false)}><X/></button></div>
      <div className="formGrid">
        <label className="full">Nome do material<input value={materialForm.name} onChange={e=>setMaterialForm({...materialForm,name:e.target.value})} placeholder="Ex.: Sacola promocional"/></label>
        {!editingMaterialId&&<><label>Código / SKU<input value={materialForm.sku} onChange={e=>setMaterialForm({...materialForm,sku:e.target.value})} placeholder="Opcional"/></label>
        <label>Unidade de medida<input value={materialForm.unit} onChange={e=>setMaterialForm({...materialForm,unit:e.target.value})} placeholder="un, pct, cx..."/></label>
        <label>Estoque mínimo<input type="number" min="0" step="0.01" value={materialForm.minimum_quantity} onChange={e=>setMaterialForm({...materialForm,minimum_quantity:e.target.value})}/></label></>}
        <label className="full">Descrição<textarea rows={3} value={materialForm.description} onChange={e=>setMaterialForm({...materialForm,description:e.target.value})} placeholder="Informações adicionais sobre o material..."/></label>
        <label className="full">Imagem do material<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>{const file=e.target.files?.[0]||null;if(file){if(!["image/jpeg","image/png","image/webp"].includes(file.type)){setStockError("Selecione uma imagem JPG, PNG ou WebP.");e.currentTarget.value="";return;}if(file.size>5*1024*1024){setStockError("A imagem deve ter no máximo 5 MB.");e.currentTarget.value="";return;}setMaterialImageFile(file);setMaterialImagePreview(URL.createObjectURL(file));setRemoveMaterialImage(false);}}}/><small>JPG, PNG ou WebP. Tamanho máximo: 5 MB.</small></label>
      </div>
      {materialImagePreview&&<div style={{marginTop:14,display:"flex",alignItems:"center",gap:12}}><img src={materialImagePreview} alt="Pré-visualização da imagem do material" style={{width:92,height:92,objectFit:"cover",borderRadius:10,border:"1px solid #e7e8ef"}}/><button type="button" className="secondary" onClick={()=>{setMaterialImageFile(null);setMaterialImagePreview("");setRemoveMaterialImage(true);}}>Remover imagem</button></div>}
      {editingMaterialId&&!materialImagePreview&&<div className="notice" style={{marginTop:12}}>Nenhuma imagem selecionada. Selecione um arquivo para adicionar uma imagem.</div>}
      {!editingMaterialId&&<div className="notice" style={{marginTop:14}}>Estoque inicial: <b>0 {materialForm.unit||"un"}</b>. Para adicionar quantidade, registre uma movimentação do tipo Entrada após cadastrar.</div>}
      <div className="modalActions"><button className="secondary" onClick={()=>setShowNewMaterial(false)}>Cancelar</button><button className="primary" onClick={createMaterial} disabled={stockSaving||!materialForm.name.trim()}>{stockSaving?"Salvando...":editingMaterialId?"Salvar alterações":"Cadastrar material"}</button></div>
    </div></div>}
    {showStockMovement&&<div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setShowStockMovement(false)}}><div className="modal">
      <div className="modalHead"><div><h2>Nova movimentação</h2><p>Registre entradas, saídas ou ajustes físicos. Reservas são controladas em Pedidos de Materiais.</p></div><button className="iconButton" onClick={()=>setShowStockMovement(false)}><X/></button></div>
      <div className="formGrid">
        <label className="full">Material<select value={movementForm.material_id} onChange={e=>setMovementForm({...movementForm,material_id:e.target.value})}>{stockMaterials.map(m=><option key={m.id} value={m.id}>{m.name} · saldo físico: {Number(m.quantity).toLocaleString("pt-BR",{maximumFractionDigits:2})} {m.unit}</option>)}</select></label>
        <label className="full">Tipo de movimentação<select value={movementForm.movement_type} onChange={e=>setMovementForm({...movementForm,movement_type:e.target.value as StockMovement["movement_type"],quantity:"",request_id:""})}>
          <option value="entrada">Entrada — aumenta o estoque físico</option>
          <option value="saida">Saída — reduz o estoque físico</option>
              <option value="ajuste">Ajuste — informar o saldo físico contado</option>
        </select></label>
        <label className="full">{movementForm.movement_type==="ajuste"?"Saldo físico contado":"Quantidade"}<input type="number" min={movementForm.movement_type==="ajuste"?"0":"0.01"} step="0.01" value={movementForm.quantity} onChange={e=>setMovementForm({...movementForm,quantity:e.target.value})} placeholder={movementForm.movement_type==="ajuste"?"Informe o saldo físico encontrado":"Informe a quantidade"}/></label>
        <label className="full">Observações<textarea rows={3} value={movementForm.notes} onChange={e=>setMovementForm({...movementForm,notes:e.target.value})} placeholder="Motivo ou detalhes da movimentação..."/></label>
      </div>
      {movementForm.movement_type==="ajuste"&&<div className="notice" style={{marginTop:12}}>Informe o saldo físico total encontrado na contagem. O sistema calculará e registrará automaticamente a diferença.</div>}
      <div className="modalActions"><button className="secondary" onClick={()=>setShowStockMovement(false)}>Cancelar</button><button className="primary" onClick={createStockMovement} disabled={stockSaving||!movementForm.material_id||movementForm.quantity===""}>{stockSaving?"Registrando...":"Registrar movimentação"}</button></div>
    </div></div>}
    {showNew&&<div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setShowNew(false)}}><div className="modal"><div className="modalHead"><div><h2>Nova solicitação</h2><p>Preencha os dados para registrar uma demanda.</p></div><button className="iconButton" onClick={()=>setShowNew(false)}><X/></button></div><div className="formGrid"><label className="full">Título da solicitação<input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Ex.: Criar material para campanha"/></label><label>Área responsável<select value={form.areaId} onChange={e=>setForm({...form,areaId:e.target.value})}>{areas.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label><label>Responsável<select value={form.ownerId} onChange={e=>setForm({...form,ownerId:e.target.value})} disabled={areaMembers.length===1 || areaMembers.length===0}><option value="">{areaMembers.length===1?"Atribuído automaticamente":"Selecione um responsável"}</option>{areaMembers.map(m=><option key={m.profile_id} value={m.profile_id}>{m.full_name}</option>)}</select><small>{areaMembers.length===1?`Responsável definido automaticamente: ${areaMembers[0].full_name}.`:areaMembers.length>1?"Selecione um dos responsáveis disponíveis nesta área.":"Carregando responsáveis ou nenhum integrante ativo encontrado."}</small></label><label>Prioridade<select value={form.priority} disabled={!isManager} onChange={e=>setForm({...form,priority:e.target.value as Priority})}>{(["Baixa","Média","Alta","Urgente"] as Priority[]).map(p=><option key={p}>{p}</option>)}</select><small>{isManager?"Definida pelo gestor.":"A prioridade será definida pelo gestor."}</small></label><label>Prazo de entrega<input type="date" value={form.due} onChange={e=>setForm({...form,due:e.target.value})}/></label><label className="full">Descrição<textarea rows={4} value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Descreva o que precisa ser realizado..."/></label></div><div className="modalActions"><button className="secondary" onClick={()=>setShowNew(false)}>Cancelar</button><button className="primary" onClick={createTask} disabled={saving||!form.title.trim()||!form.due||!form.areaId||areaMembers.length===0||(areaMembers.length>1&&!form.ownerId)}>{saving?"Salvando...":"Criar solicitação"}</button></div></div></div>}
    {selectedMember&&<div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setSelectedMember(null)}}><div className="modal" style={{width:"96vw",maxWidth:"1600px",height:"94vh",maxHeight:"94vh",boxSizing:"border-box",overflowY:"auto",padding:"28px 32px"}}><div className="modalHead"><div><p className="eyebrow">GESTÃO DA EQUIPE</p><h2>{selectedMember.full_name}</h2><p>{selectedMember.email||"E-mail não informado"}</p></div><button className="iconButton" onClick={()=>setSelectedMember(null)}><X/></button></div>
      {profile?.role==="admin"?<><div className="formGrid"><label className="full">Nome completo<input value={memberForm.full_name} onChange={e=>setMemberForm({...memberForm,full_name:e.target.value})}/></label><label>Perfil de acesso<select value={memberForm.role} onChange={e=>setMemberForm({...memberForm,role:e.target.value as Profile["role"]})}><option value="colaborador">Colaborador</option><option value="gestor">Gestor</option><option value="admin">Administrador</option></select></label><div className="full"><span style={{display:"block",fontWeight:600,marginBottom:10}}>Áreas vinculadas</span><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(210px,1fr))",gap:10,padding:14,border:"1px solid #dfe3eb",borderRadius:10}}>{areas.map(a=><label key={a.id} style={{display:"flex",alignItems:"center",gap:9,fontWeight:400,cursor:"pointer"}}><input type="checkbox" checked={memberForm.area_ids.includes(a.id)} onChange={e=>setMemberForm(old=>({...old,area_ids:e.target.checked?[...old.area_ids,a.id]:old.area_ids.filter(id=>id!==a.id)}))} style={{width:16,height:16,margin:0}}/>{a.name}</label>)}</div><small style={{display:"block",marginTop:7,color:"#667085"}}>Selecione uma ou mais áreas para este colaborador.</small></div><div className="full" style={{padding:14,border:"1px solid #dfe3eb",borderRadius:10}}><b style={{display:"block",marginBottom:8}}>Permissão de estoque</b>{memberForm.role==="admin"?<small>Administradores possuem acesso automático ao gerenciamento de estoque.</small>:<label style={{display:"flex",alignItems:"center",gap:9,fontWeight:400,cursor:"pointer"}}><input type="checkbox" checked={memberForm.stock_manager} onChange={e=>setMemberForm({...memberForm,stock_manager:e.target.checked})} style={{width:16,height:16,margin:0}}/>Gerenciar Estoque</label>}<small style={{display:"block",marginTop:7,color:"#667085"}}>Quando habilitada, a pessoa poderá cadastrar materiais e registrar movimentações de estoque.</small></div><label className="full">Situação<select value={memberForm.active?"true":"false"} onChange={e=>setMemberForm({...memberForm,active:e.target.value==="true"})}><option value="true">Ativo</option><option value="false">Inativo</option></select></label></div>{memberMessage&&<div className="errorBox" style={{marginTop:14}}>{memberMessage}</div>}<div className="modalActions"><button className="secondary" onClick={()=>setSelectedMember(null)}>Cancelar</button><button className="primary" onClick={saveMember} disabled={memberSaving||!memberForm.full_name.trim()}>{memberSaving?"Salvando...":"Salvar alterações"}</button></div></>:<><div className="detailGrid"><div><small>Nome completo</small><b>{selectedMember.full_name}</b></div><div><small>E-mail</small><b>{selectedMember.email||"Não informado"}</b></div><div><small>Perfil de acesso</small><b>{selectedMember.role==="admin"?"Administrador":selectedMember.role==="gestor"?"Gestor":"Colaborador"}</b></div><div><small>Situação</small><b>{selectedMember.active?"Ativo":"Inativo"}</b></div><div><small>Áreas vinculadas</small><b>{(selectedMember.area_ids||[]).length ? areas.filter(a=>(selectedMember.area_ids||[]).includes(a.id)).map(a=>a.name).join(" · ") : "Não definidas"}</b></div><div><small>Permissão de estoque</small><b>{selectedMember.role==="admin"?"Acesso automático":selectedMember.stock_manager?"Gerencia estoque":"Sem permissão"}</b></div></div><div className="modalActions"><button className="secondary" onClick={()=>setSelectedMember(null)}>Fechar</button></div></>}
      <div className="panel" style={{marginTop:22}}>
        <div className="panelHead"><div><h3>Demandas atribuídas</h3><p>Acompanhamento das atividades sob responsabilidade de {selectedMember.full_name}.</p></div><span className="muted">{selectedMemberTasks.length} demanda(s)</span></div>
        <div className="stats" style={{gridTemplateColumns:"repeat(4,minmax(0,1fr))",marginBottom:18}}>
          <Stat icon={<ClipboardList/>} label="Total" value={selectedMemberTasks.length} tone="blue"/>
          <Stat icon={<Activity/>} label="Em andamento" value={memberTasksInProgress} tone="violet"/>
          <Stat icon={<CheckCircle2/>} label="Concluídas" value={memberTasksDone} tone="green"/>
          <Stat icon={<AlertTriangle/>} label="Atrasadas" value={memberTasksLate} tone="red"/>
        </div>
        <div className="toolbar" style={{alignItems:"end",gap:18,flexWrap:"wrap"}}><div><b>Lista de demandas</b><p className="muted">Clique em uma demanda para abrir os detalhes e supervisionar o andamento.</p></div><div style={{width:"min(240px,100%)"}}><label className="scheduleFieldLabel" htmlFor="member-task-status">Filtrar por status</label><select id="member-task-status" className="scheduleSelect" value={memberTaskStatus} onChange={e=>setMemberTaskStatus(e.target.value)}><option value="Todas">Todos os status</option>{(["Recebida","Em análise","Aguardando aprovação","Em execução","Concluída","Cancelada"] as Status[]).map(status=><option key={status} value={status}>{status}</option>)}</select></div></div>
        <div style={{maxHeight:"48vh",overflowY:"auto",width:"100%"}}><TaskTable tasks={pageItems("memberTasks",visibleMemberTasks)} onSelect={task=>{setSelectedMember(null);setSelected(task)}} unreadCounts={unreadCounts}/><Pagination {...paginationProps("memberTasks",visibleMemberTasks.length)}/></div>
      </div>
    </div></div>}
    {selected&&<div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setSelected(null)}}><div className="modal requestDetailModal"><div className="modalHead"><div><p className="eyebrow">PROTOCOLO #{selected.protocol}</p><h2>{selected.title}</h2><p>{selected.area} · Aberta em {new Date(selected.created+"T12:00:00").toLocaleDateString("pt-BR")}</p></div><button className="iconButton" onClick={()=>setSelected(null)}><X/></button></div><div className="detailGrid"><div><small>Responsável</small><b>{selected.owner}</b></div><div><small>Prazo</small><b>{new Date(selected.due+"T12:00:00").toLocaleDateString("pt-BR")}</b></div><div><small>Prioridade</small><b>{selected.priority}</b></div><div><small>Status atual</small><StatusBadge status={selected.status}/></div></div><p className="description">{selected.description||"Sem descrição adicional."}</p>
      {pendingTaskUpdate&&pendingTaskUpdate.task.id===selected.id&&<div style={{padding:14,marginTop:14,border:"1px solid #d9c5f0",background:"#fbf8ff",borderRadius:10}}><b style={{color:"#54218a"}}>Confirmar alteração?</b><p style={{margin:"7px 0 12px",fontSize:13,color:"#5f5b6b"}}>Confira a mudança antes de salvar e fechar a solicitação.</p><div style={{display:"grid",gap:5,marginBottom:14,fontSize:13,color:"#454253"}}>{pendingTaskUpdate.patch.status&&<div><b>Status:</b> {pendingTaskUpdate.task.status} → {pendingTaskUpdate.patch.status}</div>}{pendingTaskUpdate.patch.priority&&<div><b>Prioridade:</b> {pendingTaskUpdate.task.priority} → {pendingTaskUpdate.patch.priority}</div>}{pendingTaskUpdate.patch.ownerId!==undefined&&<div><b>Responsável:</b> {pendingTaskUpdate.task.owner} → {pendingTaskUpdate.patch.ownerId?members.find(member=>member.id===pendingTaskUpdate.patch.ownerId)?.full_name||"Responsável selecionado":"Não atribuído"}</div>}</div><div className="modalActions" style={{marginTop:0}}><button className="secondary" onClick={()=>setPendingTaskUpdate(null)}>Cancelar</button><button className="primary" onClick={()=>void updateTask(pendingTaskUpdate.task,pendingTaskUpdate.patch)}>Confirmar, salvar e fechar</button></div></div>}
      {(isManager || (selected.ownerId===profile?.id && selected.requesterId!==profile?.id))?<label>Atualizar status<select value={selected.status} onChange={e=>{const nextStatus=e.target.value as Status;if(nextStatus==="Concluída"&&selected.status!=="Concluída"){setCompleteConfirm(true);return;}setPendingTaskUpdate({task:selected,patch:{status:nextStatus}});}}>{(["Recebida","Em análise","Aguardando aprovação","Em execução","Concluída","Cancelada"] as Status[]).map(s=><option key={s}>{s}</option>)}</select></label>:<p className="notice">O status é atualizado pelo responsável pela demanda ou pela gestão. O solicitante pode acompanhar a solicitação, mas não alterar seu status.</p>}{completeConfirm&&<div style={{padding:14,marginTop:12,border:"1px solid #f5d08a",background:"#fffbeb",borderRadius:10}}><b style={{color:"#92400e"}}>Confirmar conclusão da solicitação?</b><div className="modalActions" style={{marginTop:0}}><button className="secondary" onClick={()=>setCompleteConfirm(false)}>Voltar</button><button className="primary" onClick={()=>updateTask(selected,{status:"Concluída"})}>Confirmar conclusão</button></div></div>}{isManager&&<><label>Responsável<select value={selected.ownerId||""} onChange={e=>setPendingTaskUpdate({task:selected,patch:{ownerId:e.target.value||null}})}><option value="">Selecione um responsável</option>{selectedAreaMembers.map(m=><option key={m.profile_id} value={m.profile_id}>{m.full_name}</option>)}</select><small>Somente integrantes ativos da área {selected.area} podem ser atribuídos.</small></label><label>Prioridade<select value={selected.priority} onChange={e=>setPendingTaskUpdate({task:selected,patch:{priority:e.target.value as Priority}})}>{(["Baixa","Média","Alta","Urgente"] as Priority[]).map(s=><option key={s}>{s}</option>)}</select></label></>}{(isManager || selected.requesterId===profile?.id)&&<div style={{marginTop:18}}>
      {deleteConfirm ? <div style={{padding:14,border:"1px solid #fecaca",background:"#fff7f7",borderRadius:10}}>
        <b style={{color:"#b42318"}}>Confirmar exclusão?</b>
        <p style={{margin:"6px 0 12px",fontSize:13,color:"#667085"}}>A solicitação será retirada das listas, mas permanecerá preservada no histórico do banco de dados.</p>
        <div className="modalActions" style={{marginTop:0}}><button className="secondary" onClick={()=>setDeleteConfirm(false)} disabled={deletingTask}>Cancelar</button><button onClick={()=>deleteTask(selected)} disabled={deletingTask} style={{background:"#b42318",color:"white",border:0,borderRadius:9,padding:"10px 16px",fontWeight:600,cursor:"pointer"}}>{deletingTask?"Excluindo...":"Confirmar exclusão"}</button></div>
      </div> : <div className="modalActions"><button className="secondary" onClick={()=>setSelected(null)}>Fechar</button><button onClick={()=>setDeleteConfirm(true)} style={{background:"#fff",color:"#b42318",border:"1px solid #fda29b",borderRadius:9,padding:"10px 16px",fontWeight:600,cursor:"pointer"}}>Excluir solicitação</button></div>}
    </div>}{!isManager&&selected.requesterId!==profile?.id&&<div className="modalActions"><button className="secondary" onClick={()=>setSelected(null)}>Fechar</button></div>}      <section style={{marginTop:22,padding:18,border:"1px solid #e8e3ef",borderRadius:14,background:"#fcfbfe"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap",marginBottom:14}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{width:36,height:36,display:"grid",placeItems:"center",borderRadius:11,background:"#f2eaff",color:"#7a1bd8"}}><MessageCircle size={18}/></span>
            <div><h3 style={{margin:0,fontSize:15,color:"#292536"}}>Conversa da solicitação</h3><p style={{margin:"3px 0 0",fontSize:12,color:"#858397"}}>Mensagens entre o solicitante e os responsáveis pela demanda.</p></div>
          </div>
          <span style={{fontSize:11,fontWeight:700,color:(unreadCounts[selected.id]||0)>0?"#7020c5":"#667085",background:(unreadCounts[selected.id]||0)>0?"#f2e8ff":"#f1f1f5",padding:"6px 10px",borderRadius:20}}>{unreadCounts[selected.id]||0} não lida(s)</span>
        </div>
        <div style={{display:"grid",gap:10,maxHeight:320,overflowY:"auto",padding:"4px 2px 10px"}}>
          {commentsLoading&&!requestComments.length?<div className="emptyTable">Carregando conversa...</div>:!requestComments.length?<div className="emptyTable">Nenhuma mensagem ainda. Use o campo abaixo para iniciar a conversa.</div>:pageItems("comments",requestComments).map(message=>{
            const mine=message.author_id===profile?.id;
            return <div key={message.id} style={{display:"flex",justifyContent:mine?"flex-end":"flex-start"}}>
              <div style={{maxWidth:"88%",minWidth:150,padding:"10px 12px",borderRadius:12,border:mine?"1px solid #e2d2f4":"1px solid #e7e8ef",background:mine?"#f5edff":"#fff"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:14,marginBottom:6}}>
                  <b style={{fontSize:12,color:mine?"#7020c5":"#333244"}}>{mine?"Você":message.author_name}</b>
                  <small style={{fontSize:10,color:"#858397",whiteSpace:"nowrap"}}>{new Date(message.created_at).toLocaleString("pt-BR")}</small>
                </div>
                <p style={{margin:0,fontSize:13,lineHeight:1.55,color:"#454253",whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{message.body}</p>
              </div>
            </div>;
          })}
        </div><Pagination {...paginationProps("comments",requestComments.length)}/>
        {commentsError&&<div className="errorBox" style={{marginTop:10}}>{commentsError}</div>}
        <div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) auto",alignItems:"end",gap:10,marginTop:12}}>
          <label style={{display:"grid",gap:6,fontSize:12,fontWeight:600,color:"#565568"}}>Nova mensagem
            <textarea rows={3} maxLength={5000} value={commentDraft} onChange={e=>setCommentDraft(e.target.value)} placeholder="Escreva uma mensagem para os participantes desta solicitação..." style={{width:"100%",boxSizing:"border-box",resize:"vertical",padding:"11px 12px",border:"1px solid #dedbe6",borderRadius:10,fontFamily:"inherit",fontSize:13,outlineColor:"#9b5cdb",background:"#fff"}}/>
            <small style={{fontWeight:400,color:"#858397"}}>{commentDraft.length}/5000 caracteres</small>
          </label>
          <button className="primary" type="button" onClick={sendRequestComment} disabled={commentsSending||!commentDraft.trim()||commentDraft.trim().length>5000} style={{height:42,whiteSpace:"nowrap"}}>{commentsSending?"Enviando...":<><Send size={15}/> Enviar</>}</button>
        </div>
      </section>

      {dataError&&<div className="errorBox" style={{marginTop:12}}>{dataError}</div>}</div></div>}
  </main>;
}
function Pagination({page,pageSize,total,totalPages,onPageChange,onPageSizeChange}:{page:number;pageSize:number;total:number;totalPages:number;onPageChange:(page:number)=>void;onPageSizeChange:(size:number)=>void}) { if(total<=10&&pageSize===10)return null; const start=total?((page-1)*pageSize)+1:0; const end=Math.min(page*pageSize,total); const pages=Array.from({length:totalPages},(_,i)=>i+1); const visible=pages.length<=5?pages:[...new Set([1,...pages.filter(p=>Math.abs(p-page)<=1),totalPages])].sort((a,b)=>a-b); return <div className="listPagination"><span className="paginationSummary">Exibindo <b>{start}–{end}</b> de <b>{total}</b> registros</span><div className="paginationControls"><label className="paginationSize">Por página<select value={pageSize} onChange={e=>onPageSizeChange(Number(e.target.value))}><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option></select></label><button type="button" className="paginationButton" disabled={page<=1} onClick={()=>onPageChange(page-1)}>Anterior</button>{visible.map((p,index)=><span key={p} style={{display:"contents"}}>{index>0&&p-visible[index-1]>1&&<span className="paginationDots">…</span>}<button type="button" className={`paginationButton paginationNumber ${page===p?"active":""}`} aria-current={page===p?"page":undefined} onClick={()=>onPageChange(p)}>{p}</button></span>)}<button type="button" className="paginationButton" disabled={page>=totalPages} onClick={()=>onPageChange(page+1)}>Próxima</button></div></div>; }
function Stat({icon,label,value,tone}:{icon:React.ReactNode,label:string,value:number,tone:string}) { return <div className="statCard"><div className={`statIcon ${tone}`}>{icon}</div><div><small>{label}</small><strong>{value}</strong></div></div>; }
function StatusBadge({status}:{status:Status}) { return <span className={`status ${statusClass[status]}`}>{status}</span>; }
function TaskTable({tasks,onSelect,unreadCounts={}}:{tasks:Task[],onSelect:(t:Task)=>void,unreadCounts?:Record<string,number>}) { if(!tasks.length)return <div className="emptyTable">Nenhuma solicitação cadastrada no Supabase.</div>; return <div className="tableWrap"><table><thead><tr><th>Solicitação</th><th>Área</th><th>Responsável</th><th>Prioridade</th><th>Prazo</th><th>Status</th></tr></thead><tbody>{tasks.map(t=><tr key={t.id} onClick={()=>onSelect(t)}><td><b>#{t.protocol}</b><span>{t.title}</span>{(unreadCounts[t.id]||0)>0&&<span style={{display:"inline-flex",alignItems:"center",gap:5,marginTop:5,padding:"4px 8px",borderRadius:20,background:"#f2e8ff",color:"#7020c5",fontSize:10,fontWeight:700}}><MessageCircle size={11}/>{unreadCounts[t.id]} não lida(s)</span>}</td><td>{t.area}</td><td>{t.owner}</td><td><span className={`priority ${t.priority.toLowerCase()}`}>{t.priority}</span></td><td>{new Date(t.due+"T12:00:00").toLocaleDateString("pt-BR")}</td><td><StatusBadge status={t.status}/></td></tr>)}</tbody></table></div>; }


