"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import {
  Activity, BarChart3, CalendarDays, CheckCircle2, ChevronDown, ClipboardList,
  Clock3, Download, LayoutDashboard, LogOut, Menu, Package, Plus, Search, Settings,
  Users, X, AlertTriangle, Layers, ArrowUpRight, RefreshCw, ClipboardCheck, PackageCheck, History,
  MessageCircle, Send, Bell, ShieldCheck, FileSearch, ImagePlus, Upload
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import MainLayout from "@/components/layout/MainLayout";
import Pagination from "@/components/shared/Pagination";
import Stat from "@/components/shared/Stat";
import TaskTable from "@/components/shared/TaskTable";
import Dashboard from "@/features/dashboard/components/Dashboard";
import Solicitacoes from "@/features/solicitacoes/components/Solicitacoes";
import PedidosMateriais from "@/features/materiais/components/PedidosMateriais";
import Cronograma from "@/features/cronograma/components/Cronograma";
import Colaboradores from "@/features/colaboradores/components/Colaboradores";
import Estoque from "@/features/estoque/components/Estoque";
import Relatorios from "@/features/relatorios/components/Relatorios";
import Configuracoes from "@/features/configuracoes/components/Configuracoes";
import StatusBadge from "@/components/ui/StatusBadge";
import type { Status, Priority, AreaAssignment, Task } from "@/types";

type Area = { id: string; name: string };
type Profile = { id: string; full_name: string; email: string | null; role: "admin" | "gestor" | "colaborador"; area_id: string | null; area_ids?: string[]; active: boolean; stock_manager: boolean };
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
const defaultAreas = ["Criação","Trade Marketing","Eventos e Ações","Materiais e Estoque","E-commerce","Planejamento e Marketing","Social Media"];

export default function Home() {
  const [session,setSession] = useState<Session|null>(null);
  const [authLoading,setAuthLoading] = useState(true);
  const [email,setEmail] = useState("");
  const [password,setPassword] = useState("");
  const [loginLoading,setLoginLoading] = useState(false);
  const [loginError,setLoginError] = useState("");
  const [forgotPasswordMode,setForgotPasswordMode] = useState(false);
  const [passwordRecoveryMode,setPasswordRecoveryMode] = useState(false);
  const [recoveryEmailSent,setRecoveryEmailSent] = useState(false);
  const [recoveryMessage,setRecoveryMessage] = useState("");
  const [recoveryError,setRecoveryError] = useState("");
  const [newPassword,setNewPassword] = useState("");
  const [confirmNewPassword,setConfirmNewPassword] = useState("");
  const [recoveryLoading,setRecoveryLoading] = useState(false);
  const [profile,setProfile] = useState<Profile|null>(null);
  const [areas,setAreas] = useState<Area[]>([]);
  const [tasks,setTasks] = useState<Task[]>([]);
  const [members,setMembers] = useState<Profile[]>([]);
  const [formAreaIds,setFormAreaIds] = useState<string[]>([]);
  const [formOwners,setFormOwners] = useState<Record<string,string>>({});
  const [formMembersByArea,setFormMembersByArea] = useState<Record<string,AreaMember[]>>({});
  const [detailMembersByArea,setDetailMembersByArea] = useState<Record<string,AreaMember[]>>({});
  const [dataLoading,setDataLoading] = useState(false);
  const [dataError,setDataError] = useState("");
  const [active,setActive] = useState("Dashboard");
  const [stockSection,setStockSection] = useState<"materiais"|"alertas"|"consumo">("materiais");
  const [search,setSearch] = useState("");
  const [requestUserFilter,setRequestUserFilter] = useState("Todos");
  const [requestStatusFilter,setRequestStatusFilter] = useState<Status|"Todos">("Todos");
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
  const [memberEditing,setMemberEditing] = useState(false);
  const [memberConfirmOpen,setMemberConfirmOpen] = useState(false);
  const [memberMessage,setMemberMessage] = useState("");
  const [memberTaskStatus,setMemberTaskStatus] = useState("Todas");
  const [deleteConfirm,setDeleteConfirm] = useState(false);
  const [deletingTask,setDeletingTask] = useState(false);
  const [completeConfirm,setCompleteConfirm] = useState(false);
  const [pendingTaskUpdate,setPendingTaskUpdate] = useState<{task:Task;patch:Partial<Task>}|null>(null);
  const [pendingAreaStatus,setPendingAreaStatus] = useState<{task:Task;assignment:AreaAssignment;nextStatus:Status}|null>(null);
  const [memberForm,setMemberForm] = useState({full_name:"",role:"colaborador" as Profile["role"],area_ids:[] as string[],active:true,stock_manager:false});
  const [saving,setSaving] = useState(false);
  const [form,setForm] = useState({title:"",priority:"Média" as Priority,due:"",description:""});
  const isManager = profile?.role === "admin" || profile?.role === "gestor";
  const canManageStock = profile?.role === "admin" || profile?.stock_manager === true;

  const [stockMaterials,setStockMaterials] = useState<Material[]>([]);
  const [stockMovements,setStockMovements] = useState<StockMovement[]>([]);
  const [stockLoading,setStockLoading] = useState(false);
  const [stockError,setStockError] = useState("");
  const [movementError,setMovementError] = useState("");
  const [stockSaving,setStockSaving] = useState(false);
  const [showNewMaterial,setShowNewMaterial] = useState(false);
  const [editingMaterialId,setEditingMaterialId] = useState<string|null>(null);
  const [materialImageFile,setMaterialImageFile] = useState<File|null>(null);
  const [materialImagePreview,setMaterialImagePreview] = useState("");
  const [removeMaterialImage,setRemoveMaterialImage] = useState(false);
  const [isMaterialImageDragging,setIsMaterialImageDragging] = useState(false);
  const [materialImageUrls,setMaterialImageUrls] = useState<Record<string,string>>({});
  const [showStockMovement,setShowStockMovement] = useState(false);
  const [stockSearch,setStockSearch] = useState("");
  const [stockReportMaterial,setStockReportMaterial] = useState("Todos");
  const [stockReportType,setStockReportType] = useState("Todos");
  const [stockReportStart,setStockReportStart] = useState("");
  const [stockReportEnd,setStockReportEnd] = useState("");
  const [stockConsumptionMaterial,setStockConsumptionMaterial] = useState("Todos");
  const [stockConsumptionStart,setStockConsumptionStart] = useState("");
  const [stockConsumptionEnd,setStockConsumptionEnd] = useState("");
  const [materialForm,setMaterialForm] = useState({name:"",sku:"",description:"",unit:"un",minimum_quantity:"0"});
  const [movementForm,setMovementForm] = useState({material_id:"",movement_type:"entrada" as StockMovement["movement_type"],quantity:"",request_id:"",notes:""});
  const [materialOrders,setMaterialOrders] = useState<MaterialOrder[]>([]);
  const [ordersStartDate,setOrdersStartDate] = useState("");
  const [ordersEndDate,setOrdersEndDate] = useState("");
  const [ordersPeriodPreset,setOrdersPeriodPreset] = useState<"all"|"month"|"last30"|"last90"|"year"|"custom">("all");
  const [ordersStatusFilter,setOrdersStatusFilter] = useState<MaterialOrderStatus|"todos">("todos");
  const [ordersAreaFilter,setOrdersAreaFilter] = useState("todos");
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
    const { data: listener } = supabase.auth.onAuthStateChange((event,nextSession) => { setSession(nextSession); if(event === "SIGNED_OUT") setProfile(null); if(event === "PASSWORD_RECOVERY"){setPasswordRecoveryMode(true);setForgotPasswordMode(false);setRecoveryError("");setRecoveryMessage("");} });
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
        supabase.from("requests").select("id,protocol,title,description,area_id,requester_id,owner_id,priority,status,due_date,created_at,completed_at,deleted_at, area:areas!requests_area_id_fkey(name), owner:profiles!requests_owner_id_fkey(full_name), requester:profiles!requests_requester_id_fkey(full_name), request_areas(area_id,owner_id,status,is_primary,completed_at,area:areas(name),owner:profiles(full_name))").is("deleted_at",null).order("created_at",{ascending:false}),
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
      const mapped = (requestResult.data||[]).map((r:any):Task => {
        const assignments:AreaAssignment[] = (r.request_areas||[]).map((ra:any)=>({areaId:ra.area_id,area:ra.area?.name||"Área não definida",ownerId:ra.owner_id,owner:ra.owner?.full_name||"Não atribuído",status:dbToStatus[ra.status]||"Recebida",isPrimary:!!ra.is_primary,completedAt:ra.completed_at||null}));
        const primary=assignments.find(a=>a.isPrimary);
        return {id:r.id,protocol:Number(r.protocol),title:r.title,area:primary?.area||r.area?.name||"Área não definida",areaId:primary?.areaId||r.area_id,owner:primary?.owner||r.owner?.full_name||"Não atribuído",ownerId:primary?.ownerId||r.owner_id,requester:r.requester?.full_name||"Solicitante",requesterId:r.requester_id,priority:dbToPriority[r.priority]||"Média",status:dbToStatus[r.status]||"Recebida",due:r.due_date,created:r.created_at?.slice(0,10)||"",completedAt:r.completed_at||null,description:r.description||"",areaAssignments:assignments};
      });
      setTasks(mapped);
      setSelected(current => current ? (mapped.find(task=>task.id===current.id)||current) : null);
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
    if (!selected) { setPendingTaskUpdate(null); setPendingAreaStatus(null); }
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
  useEffect(() => { setListPagination(old=>Object.fromEntries(Object.entries(old).map(([key,value])=>[key,{...value,page:1}]))); },[search,requestUserFilter,scheduleOwnerFilter,scheduleAreaFilter,scheduleStatusFilter,schedulePeriod,scheduleStartDate,scheduleEndDate,stockSearch,stockReportMaterial,stockReportType,stockReportStart,stockReportEnd,reportDateMode,reportPeriod,reportStartDate,reportEndDate,reportAreaFilter,reportOwnerFilter,reportStatusFilter,auditSearch,auditActorFilter,auditModuleFilter,auditActionFilter,auditStartDate,auditEndDate,memberTaskStatus,ordersStartDate,ordersEndDate]);


  useEffect(() => {
    let active = true;
    async function loadSelectedAreaMembers() {
      if (!supabase || !selected || !isManager) { setDetailMembersByArea({}); return; }
      const client = supabase;
      const entries = await Promise.all(selected.areaAssignments.map(async assignment => {
        const {data,error}=await client.rpc("get_area_members",{target_area:assignment.areaId});
        if(error) throw error;
        return [assignment.areaId,(data||[]) as AreaMember[]] as const;
      }));
      if (!active) return;
      const map=Object.fromEntries(entries); setDetailMembersByArea(map);
    }
    loadSelectedAreaMembers().catch(error=>{if(active)setDataError(`Não foi possível carregar os responsáveis das áreas: ${error.message}`);});
    return () => { active = false; };
  }, [selected?.id, isManager]);


  async function signIn(e:FormEvent) {
    e.preventDefault(); if (!supabase) return;
    setLoginLoading(true); setLoginError("");
    const {error} = await supabase.auth.signInWithPassword({email:email.trim(),password});
    if (error) setLoginError(error.message === "Invalid login credentials" ? "E-mail ou senha incorretos." : error.message);
    setLoginLoading(false);
  }
  async function requestPasswordReset(e:FormEvent) {
    e.preventDefault(); if(!supabase)return;
    setRecoveryLoading(true);setRecoveryError("");setRecoveryMessage("");
    const {error}=await supabase.auth.resetPasswordForEmail(email.trim(),{redirectTo:window.location.origin});
    if(error)setRecoveryError("Não foi possível enviar o e-mail agora. Tente novamente em instantes.");
    else setRecoveryEmailSent(true);
    setRecoveryLoading(false);
  }
  async function updatePassword(e:FormEvent) {
    e.preventDefault();if(!supabase)return;
    setRecoveryError("");setRecoveryMessage("");
    if(newPassword.length<8){setRecoveryError("A nova senha deve ter pelo menos 8 caracteres.");return;}
    if(newPassword!==confirmNewPassword){setRecoveryError("As senhas não coincidem.");return;}
    setRecoveryLoading(true);
    const {error}=await supabase.auth.updateUser({password:newPassword});
    if(error)setRecoveryError("Não foi possível atualizar a senha. Solicite um novo link de recuperação.");
    else {setPasswordRecoveryMode(false);setForgotPasswordMode(false);setNewPassword("");setConfirmNewPassword("");setRecoveryMessage("Senha redefinida com sucesso. Você já pode entrar com sua nova senha.");await supabase.auth.signOut();setPassword("");}
    setRecoveryLoading(false);
  }
  async function signOut() { if (supabase) await supabase.auth.signOut(); setTasks([]); setMembers([]); setProfile(null); }

  const filtered = useMemo(() => tasks.filter(t => {
    const matchesSearch = [t.title,t.owner,t.area,t.status,String(t.protocol),...t.areaAssignments.flatMap(a=>[a.area,a.owner,a.status])].join(" ").toLowerCase().includes(search.toLowerCase());
    const matchesUser = requestUserFilter === "Todos"
      || (requestUserFilter === "Sem responsável" && t.areaAssignments.every(a=>!a.ownerId))
      || t.areaAssignments.some(a=>a.ownerId===requestUserFilter);
    const matchesStatus = requestStatusFilter === "Todos" || t.status === requestStatusFilter;
    return matchesSearch && matchesUser && matchesStatus;
  }),[tasks,search,requestUserFilter,requestStatusFilter]);
  const requestUsers = useMemo(() => {
    const unique = new Map<string,string>();
    tasks.forEach(task => task.areaAssignments.forEach(a=>{if(a.ownerId)unique.set(a.ownerId,a.owner);}));
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
    dashboardTasks.forEach(task => task.areaAssignments.forEach(assignment => {
      if (!assignment.ownerId) return;
      const current = grouped.get(assignment.ownerId) || {id:assignment.ownerId,name:assignment.owner,total:0,inProgress:0,done:0,late:0,cancelled:0};
      current.total += 1;
      if (assignment.status === "Em análise" || assignment.status === "Aguardando aprovação" || assignment.status === "Em execução") current.inProgress += 1;
      if (assignment.status === "Concluída") current.done += 1;
      if (assignment.status === "Cancelada") current.cancelled += 1;
      if (assignment.status !== "Concluída" && assignment.status !== "Cancelada" && task.due && new Date(task.due+"T23:59:00") < new Date()) current.late += 1;
      grouped.set(assignment.ownerId,current);
    }));
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
    if (reportAreaFilter !== "Todas" && !task.areaAssignments.some(a=>a.areaId===reportAreaFilter)) return false;
    if (reportOwnerFilter === "Sem responsável" && task.areaAssignments.some(a=>a.ownerId)) return false;
    if (reportOwnerFilter !== "Todos" && reportOwnerFilter !== "Sem responsável" && !task.areaAssignments.some(a=>a.ownerId===reportOwnerFilter)) return false;
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
  const reportByArea = areaNames.map(name=>({name,total:reportTasks.filter(t=>t.areaAssignments.some(a=>a.area===name)).length})).filter(x=>x.total>0).sort((a,b)=>b.total-a.total);
  const reportByOwner = (() => {
    const grouped = new Map<string,{id:string;name:string;total:number;done:number;inProgress:number;late:number}>();
    reportTasks.forEach(task=>task.areaAssignments.forEach(assignment=>{const key=assignment.ownerId||"unassigned";const item=grouped.get(key)||{id:key,name:assignment.ownerId?assignment.owner:"Sem responsável",total:0,done:0,inProgress:0,late:0};item.total++;if(assignment.status==="Concluída")item.done++;if(assignment.status==="Em execução"||assignment.status==="Em análise"||assignment.status==="Aguardando aprovação")item.inProgress++;if(assignment.status!=="Concluída"&&assignment.status!=="Cancelada"&&task.due&&new Date(task.due+"T23:59:00")<new Date())item.late++;grouped.set(key,item);}));
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
      ["Protocolo","Solicitação","Área responsável","Responsável da área","Status da área","Solicitante","Prioridade","Status geral","Data de abertura","Prazo","Data de conclusão"],
      ...[...reportTasks].sort((a,b)=>b.created.localeCompare(a.created)).flatMap(task=>task.areaAssignments.map(assignment=>[
        String(task.protocol),task.title,assignment.area,assignment.owner,assignment.status,task.requester,task.priority,task.status,
        formatDate(task.created),formatDate(task.due),formatDate(task.completedAt?.slice(0,10)||"")
      ]))
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
    if (scheduleOwnerFilter === "Sem responsável" && task.areaAssignments.some(a=>a.ownerId)) return false;
    if (scheduleOwnerFilter !== "Todos" && scheduleOwnerFilter !== "Sem responsável" && !task.areaAssignments.some(a=>a.ownerId===scheduleOwnerFilter)) return false;
    if (scheduleAreaFilter !== "Todas" && !task.areaAssignments.some(a=>a.areaId===scheduleAreaFilter)) return false;
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
  const selectedMemberAssignments = useMemo(() => selectedMember ? tasks.flatMap(task=>task.areaAssignments.filter(a=>a.ownerId===selectedMember.id).map(assignment=>({task,assignment}))) : [], [tasks, selectedMember]);
  const selectedMemberTasks = useMemo(() => [...new Map(selectedMemberAssignments.map(item=>[item.task.id,item.task])).values()], [selectedMemberAssignments]);
  const visibleMemberTasks = useMemo(() => memberTaskStatus === "Todas" ? selectedMemberTasks : [...new Map(selectedMemberAssignments.filter(item=>item.assignment.status===memberTaskStatus).map(item=>[item.task.id,item.task])).values()], [selectedMemberTasks, selectedMemberAssignments, memberTaskStatus]);
  const memberTasksLate = selectedMemberAssignments.filter(({task,assignment}) => assignment.status !== "Concluída" && assignment.status !== "Cancelada" && task.due && new Date(task.due + "T23:59:00") < new Date()).length;
  const memberTasksInProgress = selectedMemberAssignments.filter(({assignment}) => assignment.status === "Em execução" || assignment.status === "Em análise" || assignment.status === "Aguardando aprovação").length;
  const memberTasksDone = selectedMemberAssignments.filter(({assignment}) => assignment.status === "Concluída").length;
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
  const filteredConsumptionMovements = useMemo(() => stockMovements.filter(movement => {
    if (movement.movement_type !== "saida") return false;
    if (stockConsumptionMaterial !== "Todos" && movement.material_id !== stockConsumptionMaterial) return false;
    const movementDate = movement.created_at.slice(0,10);
    if (stockConsumptionStart && movementDate < stockConsumptionStart) return false;
    if (stockConsumptionEnd && movementDate > stockConsumptionEnd) return false;
    return true;
  }),[stockMovements,stockConsumptionMaterial,stockConsumptionStart,stockConsumptionEnd]);
  const stockConsumptionSummary = useMemo(() => ({
    movements: filteredConsumptionMovements.length,
    materials: new Set(filteredConsumptionMovements.map(movement=>movement.material_id)).size,
    units: new Set(filteredConsumptionMovements.map(movement=>stockMaterials.find(item=>item.id===movement.material_id)?.unit).filter(Boolean)).size
  }),[filteredConsumptionMovements,stockMaterials]);
  const stockConsumptionByMaterial = useMemo(() => {
    const totals = new Map<string,number>();
    filteredConsumptionMovements.forEach(movement=>totals.set(movement.material_id,(totals.get(movement.material_id)||0)+Math.abs(Number(movement.quantity)||0)));
    return [...totals.entries()].map(([materialId,quantity])=>({material:stockMaterials.find(item=>item.id===materialId),materialId,quantity})).sort((a,b)=>b.quantity-a.quantity);
  },[filteredConsumptionMovements,stockMaterials]);
  const stockConsumptionByMonth = useMemo(() => {
    const totals = new Map<string,number>();
    filteredConsumptionMovements.forEach(movement=>{const month=movement.created_at.slice(0,7);totals.set(month,(totals.get(month)||0)+1);});
    return [...totals.entries()].sort((a,b)=>a[0].localeCompare(b[0])).slice(-6).map(([month,quantity])=>({month,label:new Date(month+"-01T12:00:00").toLocaleDateString("pt-BR",{month:"short",year:"2-digit"}),quantity}));
  },[filteredConsumptionMovements]);
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
  const orderCreatedDate = (createdAt:string) => { const date=new Date(createdAt); const year=date.getFullYear(); const month=String(date.getMonth()+1).padStart(2,"0"); const day=String(date.getDate()).padStart(2,"0"); return `${year}-${month}-${day}`; };
  const orderDateInputValue = (date:Date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
  const applyOrdersPeriod = (preset:"all"|"month"|"last30"|"last90"|"year"|"custom") => {
    setOrdersPeriodPreset(preset);
    const today = new Date();
    const end = orderDateInputValue(today);
    if (preset==="all") { setOrdersStartDate(""); setOrdersEndDate(""); return; }
    if (preset==="custom") return;
    let startDate = new Date(today.getFullYear(),today.getMonth(),today.getDate());
    if (preset==="month") startDate = new Date(today.getFullYear(),today.getMonth(),1);
    if (preset==="last30") startDate.setDate(startDate.getDate()-29);
    if (preset==="last90") startDate.setDate(startDate.getDate()-89);
    if (preset==="year") startDate = new Date(today.getFullYear(),0,1);
    setOrdersStartDate(orderDateInputValue(startDate));
    setOrdersEndDate(end);
  };
  const ordersDateRangeInvalid = Boolean(ordersStartDate && ordersEndDate && ordersStartDate>ordersEndDate);
  const filteredMaterialOrders = ordersDateRangeInvalid ? [] : materialOrders.filter(order=>{const date=orderCreatedDate(order.created_at);return (!ordersStartDate||date>=ordersStartDate)&&(!ordersEndDate||date<=ordersEndDate)&&(ordersStatusFilter==="todos"||order.status===ordersStatusFilter)&&(ordersAreaFilter==="todos"||order.area_id===ordersAreaFilter);});
  const selectedOrder = materialOrders.find(order=>order.id===selectedMaterialOrder) || null;
  const unreadNotificationCount = notifications.filter(item=>!item.is_read).length;
  const selectedOrderItems = materialOrderItems.filter(item=>item.order_id===selectedMaterialOrder);
  const selectedOrderHistory = materialOrderHistory.filter(item=>item.order_id===selectedMaterialOrder);
  const pendingManagerOrders = filteredMaterialOrders.filter(order=>order.status==="aguardando_aprovacao_gestor").length;
  const pendingStockOrders = filteredMaterialOrders.filter(order=>order.status==="aguardando_aprovacao_estoque").length;
  const activeMaterialOrders = filteredMaterialOrders.filter(order=>["em_separacao","aguardando_retirada"].includes(order.status)).length;

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

  async function toggleFormArea(areaId:string, checked:boolean) {
    if (!supabase) return;
    if (!checked) { setFormAreaIds(old=>old.filter(id=>id!==areaId)); setFormOwners(old=>{const next={...old};delete next[areaId];return next;}); setFormMembersByArea(old=>{const next={...old};delete next[areaId];return next;}); return; }
    setFormAreaIds(old=>old.includes(areaId)?old:[...old,areaId]);
    const {data,error}=await supabase.rpc("get_area_members",{target_area:areaId});
    if(error){setDataError(error.message);return;}
    setFormMembersByArea(old=>({...old,[areaId]:(data||[]) as AreaMember[]}));
    if((data||[]).length===1)setFormOwners(old=>({...old,[areaId]:(data as AreaMember[])[0].profile_id}));
  }

  async function createTask() {
    if (!supabase || !profile || !form.title.trim() || !form.due || !formAreaIds.length) return;
    const missingArea=formAreaIds.find(id=>!(formMembersByArea[id]||[]).length);
    if(missingArea){setDataError(`A área ${areas.find(a=>a.id===missingArea)?.name||""} não possui responsáveis ativos.`);return;}
    const ownerIds=formAreaIds.map(id=>formOwners[id]||((formMembersByArea[id]||[]).length===1?formMembersByArea[id][0].profile_id:""));
    if(ownerIds.some(id=>!id)){setDataError("Selecione um responsável para cada área.");return;}
    if(ownerIds.some((id,index)=>!(formMembersByArea[formAreaIds[index]]||[]).some(m=>m.profile_id===id))){setDataError("Há responsável que não pertence à área selecionada.");return;}
    setSaving(true);setDataError("");
    const {error}=await supabase.rpc("create_request_with_areas",{p_title:form.title.trim(),p_description:form.description.trim()||null,p_area_ids:formAreaIds,p_owner_ids:ownerIds,p_priority:priorityToDb[form.priority],p_due_date:form.due});
    if(error)setDataError(error.message);else{setShowNew(false);setForm({title:"",priority:"Média",due:"",description:""});setFormAreaIds([]);setFormOwners({});setFormMembersByArea({});if(session?.user)await loadData(session.user);}
    setSaving(false);
  }
  function selectMaterialImage(file:File|null) {
    if (!file) return;

    if (!["image/jpeg","image/png","image/webp"].includes(file.type)) {
      setStockError("Selecione uma imagem JPG, PNG ou WebP.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setStockError("A imagem deve ter no máximo 5 MB.");
      return;
    }

    if (materialImagePreview.startsWith("blob:")) {
      URL.revokeObjectURL(materialImagePreview);
    }

    setStockError("");
    setMaterialImageFile(file);
    setMaterialImagePreview(URL.createObjectURL(file));
    setRemoveMaterialImage(false);
  }

  function removeSelectedMaterialImage() {
    if (materialImagePreview.startsWith("blob:")) {
      URL.revokeObjectURL(materialImagePreview);
    }

    setMaterialImageFile(null);
    setMaterialImagePreview("");
    setRemoveMaterialImage(true);
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
    if (!movementForm.material_id) { setMovementError("Selecione um material."); return; }
    if (!Number.isFinite(amount) || amount < 0 || (movementForm.movement_type !== "ajuste" && amount <= 0)) {
      setMovementError(movementForm.movement_type === "ajuste"
        ? "Informe um saldo físico contado válido (zero ou maior)."
        : "Informe uma quantidade maior que zero.");
      return;
    }
    setStockSaving(true);
    setMovementError("");
    const { data, error } = await supabase.rpc("register_stock_movement", {
      p_material_id: movementForm.material_id,
      p_movement_type: movementForm.movement_type,
      p_quantity: amount,
      p_request_id: null,
      p_notes: movementForm.notes.trim() || null
    });
    if (error) {
      setMovementError(error.message);
    } else {
      setMovementError("");
      setShowStockMovement(false);
      setMovementForm(old => ({...old,quantity:"",request_id:"",notes:""}));
      await loadStock();
      if (movementForm.movement_type === "ajuste" && data === null) {
        setStockError("Nenhum ajuste foi necessário: o saldo informado já corresponde ao estoque registrado.");
      }
    }
    setStockSaving(false);
  }

  function exportStockConsumption() {
    const csvCell = (value:unknown) => '"' + String(value ?? "").replace(/"/g,'""') + '"';
    const formatDate = (value:string) => value ? new Date(value).toLocaleString("pt-BR") : "—";
    const rows:unknown[][] = [
      ["ANÁLISE DE CONSUMO DE MATERIAIS"],
      ["Critério","Somente movimentações do tipo saída; reservas, cancelamentos e ajustes não são contabilizados"],
      ["Material",stockConsumptionMaterial==="Todos"?"Todos os materiais":stockMaterials.find(item=>item.id===stockConsumptionMaterial)?.name||"Material selecionado"],
      ["Data inicial",stockConsumptionStart||"Todo o período"],
      ["Data final",stockConsumptionEnd||"Todo o período"],
      [],["INDICADORES"],["Saídas registradas",String(stockConsumptionSummary.movements)],["Materiais consumidos",String(stockConsumptionSummary.materials)],["Unidades de medida distintas",String(stockConsumptionSummary.units)],
      [],["CONSUMO POR MATERIAL"],["Material","Código","Quantidade consumida","Unidade"],
      ...stockConsumptionByMaterial.map(item=>[item.material?.name||"Material não encontrado",item.material?.sku||"",String(item.quantity),item.material?.unit||""]),
      [],["DETALHAMENTO"],["Data","Material","Código","Quantidade","Unidade","Origem","Observações"],
      ...filteredConsumptionMovements.map(movement=>{const material=stockMaterials.find(item=>item.id===movement.material_id);const request=tasks.find(item=>item.id===movement.request_id);return [formatDate(movement.created_at),material?.name||"Material não encontrado",material?.sku||"",String(Math.abs(Number(movement.quantity)||0)),material?.unit||"",request?"Solicitação #"+request.protocol:movement.material_order_id?"Pedido de materiais":"Movimentação manual",movement.notes||""];})
    ];
    const csv="\uFEFF"+rows.map(row=>row.map(csvCell).join(";")).join("\r\n");
    const blob=new Blob([csv],{type:"text/csv;charset=utf-8;"});const url=URL.createObjectURL(blob);const link=document.createElement("a");link.href=url;link.download="analise-consumo-estoque.csv";document.body.appendChild(link);link.click();document.body.removeChild(link);URL.revokeObjectURL(url);
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
    setMemberConfirmOpen(false);
    setMemberEditing(false);
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
    if ((patch.priority !== undefined || patch.ownerId !== undefined) && !isManager) { setDataError("Somente gestores e administradores podem alterar a prioridade ou o responsável."); return; }
    const update:any={}; if(patch.priority&&isManager)update.priority=priorityToDb[patch.priority];
    if(Object.keys(update).length){const {error}=await supabase.from("requests").update(update).eq("id",task.id);if(error){setDataError(error.message);return;}}
    setPendingTaskUpdate(null);setSelected(null);if(session?.user)await loadData(session.user);
  }

  async function reassignAreaOwner(task:Task, assignment:AreaAssignment, ownerId:string) {
    if(!supabase||!isManager||!ownerId)return;
    const {error}=await supabase.rpc("assign_request_area",{p_request_id:task.id,p_area_id:assignment.areaId,p_owner_id:ownerId,p_is_primary:assignment.isPrimary});
    if(error){setDataError(error.message);return;} setDataError(""); if(session?.user)await loadData(session.user);
  }

  async function updateAreaStatus(task:Task, assignment:AreaAssignment, nextStatus:Status) {
    if(!supabase||!profile)return;
    if(!isManager&&(assignment.ownerId!==profile.id||task.requesterId===profile.id)){setDataError("Somente o responsável da área pode atualizar seu status. O solicitante não pode alterar o status da própria solicitação.");return;}
    const {error}=await supabase.from("request_areas").update({status:statusToDb[nextStatus]}).eq("request_id",task.id).eq("area_id",assignment.areaId);
    if(error){setDataError(error.message);return;}setPendingAreaStatus(null);setDataError("");if(session?.user)await loadData(session.user);
  }

  if (authLoading) return <div className="authScreen"><div className="authCard"><img src="/logo-delrio.svg" alt="DelRio" className="brandLogo authBrandLogo" /><h1>Gestão de Demandas DelRio</h1><p>Verificando sua sessão...</p></div></div>;
  if(passwordRecoveryMode) return <div className="authScreen"><form className="authCard" onSubmit={updatePassword}><div className="authBrand"><img src="/logo-delrio.svg" alt="DelRio" className="brandLogo authBrandLogo" /><div><small>GESTÃO DE DEMANDAS</small></div></div><p className="eyebrow">RECUPERAÇÃO DE ACESSO</p><h1>Defina sua nova senha</h1><p className="authSub">Escolha uma senha com pelo menos 8 caracteres.</p><label>Nova senha<input type="password" autoComplete="new-password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} placeholder="Digite a nova senha" minLength={8} required/></label><label>Confirmar nova senha<input type="password" autoComplete="new-password" value={confirmNewPassword} onChange={e=>setConfirmNewPassword(e.target.value)} placeholder="Digite novamente a nova senha" minLength={8} required/></label>{recoveryError&&<div className="errorBox">{recoveryError}</div>}<button className="primary authSubmit" disabled={recoveryLoading}>{recoveryLoading?"Salvando...":"Redefinir senha"}</button></form></div>;
  if (!session) return <div className="authScreen"><form className="authCard" onSubmit={forgotPasswordMode?requestPasswordReset:signIn}><div className="authBrand"><img src="/logo-delrio.svg" alt="DelRio" className="brandLogo authBrandLogo" /><div><small>GESTÃO DE DEMANDAS</small></div></div><p className="eyebrow">AMBIENTE DE MARKETING</p><h1>{forgotPasswordMode?"Recuperar senha":"Acesse sua conta"}</h1><p className="authSub">{forgotPasswordMode?"Informe seu e-mail cadastrado para receber o link de redefinição.":"Entre com seu e-mail e senha cadastrados no sistema."}</p><label>E-mail<input type="email" autoComplete="username" value={email} onChange={e=>{setEmail(e.target.value);setRecoveryEmailSent(false);setRecoveryError("");}} placeholder="seuemail@delrio.com.br" required/></label>{!forgotPasswordMode&&<label>Senha<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Digite sua senha" required/></label>}{loginError&&!forgotPasswordMode&&<div className="errorBox">{loginError}</div>}{recoveryError&&<div className="errorBox">{recoveryError}</div>}{recoveryEmailSent&&<div className="successBox">Se o endereço estiver cadastrado, você receberá um e-mail com as instruções para redefinir sua senha.</div>}{!forgotPasswordMode?<button type="button" className="textButton" onClick={()=>{setForgotPasswordMode(true);setLoginError("");setRecoveryError("");}}>Esqueci minha senha</button>:<button className="primary authSubmit" disabled={recoveryLoading}>{recoveryLoading?"Enviando...":"Enviar link de recuperação"}</button>}{forgotPasswordMode&&<button type="button" className="textButton" onClick={()=>{setForgotPasswordMode(false);setRecoveryEmailSent(false);setRecoveryError("");}}>Voltar para o login</button>}{!forgotPasswordMode&&<button className="primary authSubmit" disabled={loginLoading}>{loginLoading?"Entrando...":"Entrar"}</button>}<small className="authFoot">Acesso restrito à equipe autorizada.</small></form></div>;

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
  return <MainLayout
    sidebarProps={{
      active,
      onNavigate: (name) => {
        setActive(name);
        setSelected(null);
      },
      mobileOpen: mobileMenu,
      onClose: () => setMobileMenu(false),
      taskCount: tasks.length,
      userName: profile?.full_name ?? null,
      userRole: profile?.role ?? null,
      onSignOut: signOut,
    }}
    headerProps={{
      active,
      onOpenMenu: () => setMobileMenu(true),
      userName: profile?.full_name ?? null,
      dataLoading,
      notifications,
      notificationsLoading,
      notificationsError,
      showNotifications,
      unreadNotificationCount,
      onToggleNotifications: () => setShowNotifications(old => !old),
      onCloseNotifications: () => setShowNotifications(false),
      onMarkAllRead: markAllNotificationsRead,
      onOpenNotification: openNotification,
      paginationProps: paginationProps("notifications", notifications.length),
    }}
    overlays={
      <>
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
        <div className="full materialImageField">
          <span className="materialImageLabel">Imagem do material</span>
          <label
            htmlFor="material-image-input"
            className={`materialImageDropzone ${isMaterialImageDragging?"isDragging":""}`}
            onDragOver={e=>{e.preventDefault();setIsMaterialImageDragging(true);}}
            onDragLeave={e=>{e.preventDefault();setIsMaterialImageDragging(false);}}
            onDrop={e=>{e.preventDefault();setIsMaterialImageDragging(false);selectMaterialImage(e.dataTransfer.files?.[0]||null);}}
          >
            <span className="materialImageIcon"><ImagePlus size={25}/></span>
            <span className="materialImageEmpty">
              <strong>Arraste uma imagem até aqui</strong>
              <small>ou clique para selecionar um arquivo</small>
            </span>
            <span className="materialImageSelect"><Upload size={15}/> Escolher imagem</span>
            <small className="materialImageHint">JPG, PNG ou WebP · Máximo de 5 MB</small>
          </label>
          <input
            id="material-image-input"
            className="materialImageInput"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={e=>{selectMaterialImage(e.target.files?.[0]||null);e.currentTarget.value="";}}
          />
        </div>
      </div>
      {materialImagePreview&&<div className="materialImagePreview">
        <div className="materialImagePreviewInfo">
          <img src={materialImagePreview} alt="Pré-visualização da imagem do material"/>
          <div>
            <strong>{materialImageFile?.name||"Imagem atual do material"}</strong>
            <small>{materialImageFile?(materialImageFile.size/1024/1024).toFixed(2)+" MB":"Imagem já cadastrada"}</small>
          </div>
        </div>
        <button type="button" className="secondary materialImageRemove" onClick={removeSelectedMaterialImage}>
          <X size={15}/> Remover imagem
        </button>
      </div>}
      {editingMaterialId&&!materialImagePreview&&<div className="notice" style={{marginTop:12}}>Nenhuma imagem selecionada. Selecione um arquivo para adicionar uma imagem.</div>}
      {!editingMaterialId&&<div className="notice" style={{marginTop:14}}>Estoque inicial: <b>0 {materialForm.unit||"un"}</b>. Para adicionar quantidade, registre uma movimentação do tipo Entrada após cadastrar.</div>}
      <div className="modalActions"><button className="secondary" onClick={()=>setShowNewMaterial(false)}>Cancelar</button><button className="primary" onClick={createMaterial} disabled={stockSaving||!materialForm.name.trim()}>{stockSaving?"Salvando...":editingMaterialId?"Salvar alterações":"Cadastrar material"}</button></div>
    </div></div>}
    {showStockMovement&&<div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget){setShowStockMovement(false);setMovementError("");}}}><div className="modal">
      <div className="modalHead"><div><h2>Nova movimentação</h2><p>Registre entradas, saídas ou ajustes físicos. Reservas são controladas em Pedidos de Materiais.</p></div><button className="iconButton" onClick={()=>{setShowStockMovement(false);setMovementError("");}}><X/></button></div>
      {movementError&&<div className="errorBox" role="alert" style={{marginBottom:14}}>{movementError}</div>}
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
      <div className="modalActions"><button className="secondary" onClick={()=>{setShowStockMovement(false);setMovementError("");}}>Cancelar</button><button className="primary" onClick={createStockMovement} disabled={stockSaving||!movementForm.material_id||movementForm.quantity===""}>{stockSaving?"Registrando...":"Registrar movimentação"}</button></div>
    </div></div>}
    {showNew&&<div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setShowNew(false)}}><div className="modal"><div className="modalHead"><div><h2>Nova solicitação</h2><p>Selecione uma ou mais áreas e defina um responsável para cada uma.</p></div><button className="iconButton" onClick={()=>setShowNew(false)}><X/></button></div><div className="formGrid"><label className="full">Título da solicitação<input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Ex.: Criar material para campanha"/></label><div className="full" style={{padding:15,border:"1px solid #e7d8f7",borderRadius:14,background:"linear-gradient(135deg,#fcf8ff 0%,#ffffff 100%)",boxShadow:"inset 3px 0 0 #7a1bd8"}}>
  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,marginBottom:12,flexWrap:"wrap"}}>
    <div><b style={{display:"flex",alignItems:"center",gap:8,color:"#54218a"}}><span style={{width:8,height:8,borderRadius:99,background:"#7a1bd8",boxShadow:"0 0 0 4px #f0e4ff"}}/>Áreas responsáveis</b><small style={{display:"block",marginTop:6,color:"#746582"}}>Adicione as áreas e defina um responsável para cada uma.</small></div>
    <button type="button" className="secondary" onClick={()=>{const nextArea=areas.find(area=>!formAreaIds.includes(area.id));if(nextArea)void toggleFormArea(nextArea.id,true);}} disabled={formAreaIds.length>=areas.length} style={{whiteSpace:"nowrap",background:"#f3e9ff",border:"1px solid #dfc8f5",color:"#7020c5"}}><Plus size={15}/> Adicionar área</button>
  </div>
  <div style={{display:"grid",gap:10}}>
    {formAreaIds.map(areaId=>{
      const a=areas.find(x=>x.id===areaId);
      const list=formMembersByArea[areaId]||[];
      return <div key={areaId} style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) minmax(0,1fr) 42px",alignItems:"start",gap:12,padding:14,border:"1px solid #dfcff0",borderLeft:"3px solid #a66bdd",borderRadius:12,background:"#fff"}}>
        <label style={{minWidth:0}}>Área responsável
          <select value={areaId} onChange={async e=>{const nextAreaId=e.target.value;if(nextAreaId&&nextAreaId!==areaId){await toggleFormArea(areaId,false);await toggleFormArea(nextAreaId,true);}}}>
            {areas.filter(area=>area.id===areaId||!formAreaIds.includes(area.id)).map(area=><option key={area.id} value={area.id}>{area.name}</option>)}
          </select>
        </label>
        <label style={{minWidth:0}}>Responsável
          <select value={formOwners[areaId]||""} disabled={list.length===1||list.length===0} onChange={e=>setFormOwners(old=>({...old,[areaId]:e.target.value}))}>
            <option value="">{list.length===1?"Atribuído automaticamente":"Selecione um responsável"}</option>
            {list.map(m=><option key={m.profile_id} value={m.profile_id}>{m.full_name}</option>)}
          </select>
          <small>{list.length===1?`Responsável definido automaticamente: ${list[0].full_name}.`:list.length?"Selecione um integrante ativo desta área.":"Carregando responsáveis..."}</small>
        </label>
        <button type="button" className="iconButton" title={`Remover área ${a?.name||""}`} aria-label={`Remover área ${a?.name||""}`} onClick={()=>void toggleFormArea(areaId,false)} style={{width:42,height:42,border:"1px solid #e1e4ec",borderRadius:9,background:"#fff",alignSelf:"center"}}><X size={17}/></button>
      </div>;
    })}
    {!formAreaIds.length&&<div style={{padding:18,border:"1px dashed #d5d9e3",borderRadius:12,color:"#667085",fontSize:13}}>Nenhuma área adicionada. Clique em “Adicionar área” para começar.</div>}
  </div>
</div><label>Prioridade<select value={form.priority} disabled={!isManager} onChange={e=>setForm({...form,priority:e.target.value as Priority})}>{(["Baixa","Média","Alta","Urgente"] as Priority[]).map(p=><option key={p}>{p}</option>)}</select><small>{isManager?"Definida pelo gestor.":"A prioridade será definida pelo gestor."}</small></label><label>Prazo de entrega<input type="date" value={form.due} onChange={e=>setForm({...form,due:e.target.value})}/></label><label className="full">Descrição<textarea rows={4} value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Descreva o que precisa ser realizado..."/></label></div><div className="modalActions"><button className="secondary" onClick={()=>setShowNew(false)}>Cancelar</button><button className="primary" onClick={createTask} disabled={saving||!form.title.trim()||!form.due||!formAreaIds.length||formAreaIds.some(id=>!(formMembersByArea[id]||[]).length)||formAreaIds.some(id=>(formMembersByArea[id]||[]).length>1&&!formOwners[id])}>{saving?"Salvando...":"Criar solicitação"}</button></div></div></div>}
    {selectedMember&&<div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setSelectedMember(null)}}><div className="modal" style={{width:"96vw",maxWidth:"1600px",height:"94vh",maxHeight:"94vh",boxSizing:"border-box",overflowY:"auto",padding:"28px 32px"}}><div className="modalHead"><div><p className="eyebrow">GESTÃO DA EQUIPE</p><h2>{selectedMember.full_name}</h2><p>{selectedMember.email||"E-mail não informado"}</p></div><button className="iconButton" onClick={()=>setSelectedMember(null)}><X/></button></div>
      {profile?.role==="admin"?<><div className="formGrid"><label className="full">Nome completo<input value={memberForm.full_name} disabled={!memberEditing} onChange={e=>setMemberForm({...memberForm,full_name:e.target.value})}/></label><label>Perfil de acesso<select value={memberForm.role} disabled={!memberEditing} onChange={e=>setMemberForm({...memberForm,role:e.target.value as Profile["role"]})}><option value="colaborador">Colaborador</option><option value="gestor">Gestor</option><option value="admin">Administrador</option></select></label><label>Situação<select value={memberForm.active?"true":"false"} disabled={!memberEditing} onChange={e=>setMemberForm({...memberForm,active:e.target.value==="true"})}><option value="true">Ativo</option><option value="false">Inativo</option></select></label></div><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,420px),1fr))",gap:16,marginTop:16,alignItems:"stretch"}}><section style={{minWidth:0,padding:18,border:"1px solid #e3e5ed",borderRadius:14,background:memberEditing?"#fff":"#fafafd",opacity:memberEditing?1:.88}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,flexWrap:"wrap",marginBottom:14}}><div><b style={{display:"block",fontSize:14,color:"#252238"}}>Áreas vinculadas</b><small style={{display:"block",marginTop:4,color:"#777487"}}>Defina em quais áreas este colaborador poderá atuar.</small></div><span style={{padding:"5px 10px",borderRadius:20,background:"#f3edfb",color:"#7020c5",fontSize:12,fontWeight:700}}>{memberForm.area_ids.length} selecionada(s)</span></div><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:10}}>{areas.map(a=><label key={a.id} style={{display:"flex",alignItems:"center",gap:11,minHeight:44,padding:"9px 12px",border:memberForm.area_ids.includes(a.id)?"1px solid #c9afe8":"1px solid #e7e8ee",borderRadius:10,background:memberForm.area_ids.includes(a.id)?"#faf7ff":"#fff",fontWeight:500,color:"#383548",cursor:memberEditing?"pointer":"default",transition:"background .15s,border-color .15s"}}><input type="checkbox" disabled={!memberEditing} checked={memberForm.area_ids.includes(a.id)} onChange={e=>setMemberForm(old=>({...old,area_ids:e.target.checked?[...old.area_ids,a.id]:old.area_ids.filter(id=>id!==a.id)}))} style={{width:17,height:17,margin:0,accentColor:"#7a1bd8",flexShrink:0}}/><span>{a.name}</span></label>)}</div><small style={{display:"block",marginTop:11,color:"#777487"}}>É possível vincular o colaborador a mais de uma área.</small></section><section style={{minWidth:0,padding:18,border:"1px solid #e3e5ed",borderRadius:14,background:memberEditing?"#fff":"#fafafd",opacity:memberEditing?1:.88}}><div style={{marginBottom:14}}><b style={{display:"block",fontSize:14,color:"#252238"}}>Permissão de estoque</b><small style={{display:"block",marginTop:4,color:"#777487"}}>Controle o acesso às operações de estoque independentemente das áreas vinculadas.</small></div>{memberForm.role==="admin"?<div style={{display:"flex",alignItems:"center",gap:12,padding:14,border:"1px solid #d9c8ed",borderRadius:11,background:"#faf7ff"}}><span style={{display:"grid",placeItems:"center",width:36,height:36,borderRadius:10,background:"#efe4fb",color:"#7020c5",fontSize:18,fontWeight:700}}>✓</span><div><b style={{display:"block",fontSize:13,color:"#3d2856"}}>Acesso automático</b><small style={{color:"#777487"}}>Administradores possuem acesso automático ao gerenciamento de estoque.</small></div></div>:<label style={{display:"flex",alignItems:"center",gap:12,padding:14,border:memberForm.stock_manager?"1px solid #c9afe8":"1px solid #e7e8ee",borderRadius:11,background:memberForm.stock_manager?"#faf7ff":"#fff",cursor:memberEditing?"pointer":"default"}}><input type="checkbox" disabled={!memberEditing} checked={memberForm.stock_manager} onChange={e=>setMemberForm({...memberForm,stock_manager:e.target.checked})} style={{width:18,height:18,margin:0,accentColor:"#7a1bd8",flexShrink:0}}/><span><b style={{display:"block",fontSize:13,color:"#383548"}}>Gerenciar Estoque</b><small style={{display:"block",marginTop:3,color:"#777487"}}>Permite cadastrar materiais e registrar movimentações de estoque.</small></span></label>}</section></div>{memberMessage&&<div className="errorBox" style={{marginTop:14}}>{memberMessage}</div>}<div className="modalActions">{!memberEditing?<><button className="secondary" onClick={()=>setSelectedMember(null)}>Fechar</button><button className="primary" onClick={()=>{setMemberMessage("");setMemberEditing(true)}}><Users size={15}/> Editar cadastro</button></>:<><button className="secondary" onClick={()=>{setMemberForm({full_name:selectedMember.full_name,role:selectedMember.role,area_ids:selectedMember.area_ids||[],active:selectedMember.active,stock_manager:selectedMember.stock_manager===true});setMemberEditing(false);setMemberConfirmOpen(false);setMemberMessage("");}}>Cancelar edição</button><button className="primary" onClick={()=>setMemberConfirmOpen(true)} disabled={memberSaving||!memberForm.full_name.trim()}>Revisar alterações</button></>}</div>{memberConfirmOpen&&<div style={{marginTop:16,padding:16,border:"1px solid #d9c5f0",background:"#fbf8ff",borderRadius:12}}><b style={{color:"#54218a"}}>Confirmar alterações do colaborador?</b><p style={{margin:"7px 0 12px",fontSize:13,color:"#5f5b6b"}}>Confira os dados antes de salvar. Nenhuma alteração será aplicada até sua confirmação.</p><div style={{display:"grid",gap:6,marginBottom:14,fontSize:13,color:"#454253"}}>{memberForm.full_name!==selectedMember.full_name&&<div><b>Nome:</b> {selectedMember.full_name} → {memberForm.full_name}</div>}{memberForm.role!==selectedMember.role&&<div><b>Perfil:</b> {selectedMember.role} → {memberForm.role}</div>}{memberForm.active!==selectedMember.active&&<div><b>Situação:</b> {selectedMember.active?"Ativo":"Inativo"} → {memberForm.active?"Ativo":"Inativo"}</div>}{JSON.stringify([...memberForm.area_ids].sort())!==JSON.stringify([...(selectedMember.area_ids||[])].sort())&&<div><b>Áreas vinculadas:</b> {areas.filter(a=>(selectedMember.area_ids||[]).includes(a.id)).map(a=>a.name).join(", ")||"Nenhuma"} → {areas.filter(a=>memberForm.area_ids.includes(a.id)).map(a=>a.name).join(", ")||"Nenhuma"}</div>}{memberForm.stock_manager!==(selectedMember.stock_manager===true)&&<div><b>Permissão de estoque:</b> {selectedMember.stock_manager?"Habilitada":"Desabilitada"} → {memberForm.stock_manager?"Habilitada":"Desabilitada"}</div>}{memberForm.full_name===selectedMember.full_name&&memberForm.role===selectedMember.role&&memberForm.active===selectedMember.active&&memberForm.stock_manager===(selectedMember.stock_manager===true)&&JSON.stringify([...memberForm.area_ids].sort())===JSON.stringify([...(selectedMember.area_ids||[])].sort())&&<span>Nenhuma alteração foi realizada.</span>}</div><div className="modalActions" style={{marginTop:0}}><button className="secondary" onClick={()=>setMemberConfirmOpen(false)} disabled={memberSaving}>Voltar e revisar</button><button className="primary" onClick={()=>void saveMember()} disabled={memberSaving||!memberForm.full_name.trim()}>{memberSaving?"Salvando...":"Confirmar e salvar"}</button></div></div>}</>:<><div className="detailGrid"><div><small>Nome completo</small><b>{selectedMember.full_name}</b></div><div><small>E-mail</small><b>{selectedMember.email||"Não informado"}</b></div><div><small>Perfil de acesso</small><b>{selectedMember.role==="admin"?"Administrador":selectedMember.role==="gestor"?"Gestor":"Colaborador"}</b></div><div><small>Situação</small><b>{selectedMember.active?"Ativo":"Inativo"}</b></div><div><small>Áreas vinculadas</small><b>{(selectedMember.area_ids||[]).length ? areas.filter(a=>(selectedMember.area_ids||[]).includes(a.id)).map(a=>a.name).join(" · ") : "Não definidas"}</b></div><div><small>Permissão de estoque</small><b>{selectedMember.role==="admin"?"Acesso automático":selectedMember.stock_manager?"Gerencia estoque":"Sem permissão"}</b></div></div><div className="modalActions"><button className="secondary" onClick={()=>setSelectedMember(null)}>Fechar</button></div></>}
      <div className="panel" style={{marginTop:22}}>
        <div className="panelHead"><div><h3>Demandas atribuídas</h3><p>Acompanhamento das atividades sob responsabilidade de {selectedMember.full_name}.</p></div><span className="muted">{selectedMemberTasks.length} demanda(s)</span></div>
        <div className="stats" style={{gridTemplateColumns:"repeat(4,minmax(0,1fr))",marginBottom:18}}>
          <Stat icon={<ClipboardList/>} label="Total" value={selectedMemberTasks.length} tone="blue"/>
          <Stat icon={<Activity/>} label="Áreas em andamento" value={memberTasksInProgress} tone="violet"/>
          <Stat icon={<CheckCircle2/>} label="Áreas concluídas" value={memberTasksDone} tone="green"/>
          <Stat icon={<AlertTriangle/>} label="Áreas atrasadas" value={memberTasksLate} tone="red"/>
        </div>
        <div className="toolbar" style={{alignItems:"end",gap:18,flexWrap:"wrap"}}><div><b>Lista de demandas</b><p className="muted">Clique em uma demanda para abrir os detalhes e supervisionar o andamento.</p></div><div style={{width:"min(240px,100%)"}}><label className="scheduleFieldLabel" htmlFor="member-task-status">Filtrar por status</label><select id="member-task-status" className="scheduleSelect" value={memberTaskStatus} onChange={e=>setMemberTaskStatus(e.target.value)}><option value="Todas">Todos os status</option>{(["Recebida","Em análise","Aguardando aprovação","Em execução","Concluída","Cancelada"] as Status[]).map(status=><option key={status} value={status}>{status}</option>)}</select></div></div>
        <div style={{maxHeight:"48vh",overflowY:"auto",width:"100%"}}><TaskTable tasks={pageItems("memberTasks",visibleMemberTasks)} onSelect={task=>{setSelectedMember(null);setSelected(task)}} unreadCounts={unreadCounts}/><Pagination {...paginationProps("memberTasks",visibleMemberTasks.length)}/></div>
      </div>
    </div></div>}
    {selected&&<div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setSelected(null)}}><div className="modal requestDetailModal"><div className="modalHead"><div><p className="eyebrow">PROTOCOLO #{selected.protocol}</p><h2>{selected.title}</h2><p>{selected.area} · Aberta em {new Date(selected.created+"T12:00:00").toLocaleDateString("pt-BR")}</p></div><button className="iconButton" onClick={()=>setSelected(null)}><X/></button></div><div className="detailGrid"><div><small>Áreas responsáveis</small><b>{selected.areaAssignments.map(a=>a.area).join(" · ")||selected.area}</b></div><div><small>Prazo</small><b>{new Date(selected.due+"T12:00:00").toLocaleDateString("pt-BR")}</b></div><div><small>Prioridade</small><b>{selected.priority}</b></div><div><small>Status geral</small><StatusBadge status={selected.status}/></div></div><section className="requestDescription">
  <div className="requestSectionHeading">
    <span className="requestSectionIcon"> <ClipboardList size={17}/> </span>
    <div><h3>Descrição da solicitação</h3><p>Detalhamento do que precisa ser realizado</p></div>
  </div>
  <p>{selected.description?.trim()||"Nenhuma descrição adicional foi informada."}</p>
</section>
<section className="requestAreaSection">
  <div className="requestSectionHeading">
    <span className="requestSectionIcon"><Users size={17}/></span>
    <div><h3>Acompanhamento por área</h3><p>Responsáveis e andamento de cada área envolvida</p></div>
    <span className="requestAreaCount">{selected.areaAssignments.length} {selected.areaAssignments.length===1?"área":"áreas"}</span>
  </div>
  <div className="requestAreaList">
    {selected.areaAssignments.map(assignment=><article className="requestAreaCard" key={assignment.areaId}>
      <div className="requestAreaCardHead">
        <div className="requestAreaName">{assignment.area}{assignment.isPrimary&&<span className="requestPrimaryTag">Área principal</span>}</div>
        <StatusBadge status={assignment.status}/>
      </div>
      <div className="requestAreaOwner"><span>Responsável</span><strong>{assignment.owner}</strong></div>
      {isManager&&<label className="requestControlLabel">Reatribuir responsável
        <select className="scheduleSelect" value={assignment.ownerId} onChange={e=>void reassignAreaOwner(selected,assignment,e.target.value)}>
          {(detailMembersByArea[assignment.areaId]||[]).map(m=><option key={m.profile_id} value={m.profile_id}>{m.full_name}</option>)}
        </select>
      </label>}
      {(isManager||(assignment.ownerId===profile?.id&&selected.requesterId!==profile?.id))?<label className="requestControlLabel">Atualizar status desta área
        <select className="scheduleSelect" value={pendingAreaStatus?.task.id===selected.id&&pendingAreaStatus.assignment.areaId===assignment.areaId?pendingAreaStatus.nextStatus:assignment.status} onChange={e=>{const nextStatus=e.target.value as Status;if(nextStatus===assignment.status){setPendingAreaStatus(null);return;}setPendingAreaStatus({task:selected,assignment,nextStatus});}}>
          {(["Recebida","Em análise","Aguardando aprovação","Em execução","Concluída","Cancelada"] as Status[]).map(s=><option key={s}>{s}</option>)}
        </select>
      </label>:null}
    </article>)}
  </div>
</section>
      {pendingAreaStatus&&pendingAreaStatus.task.id===selected.id&&<div style={{padding:14,marginTop:14,border:"1px solid #d9c5f0",background:"#fbf8ff",borderRadius:10}}>
        <b style={{color:"#54218a"}}>{"Confirmar altera\u00e7\u00e3o do status?"}</b>
        <p style={{margin:"7px 0 12px",fontSize:13,color:"#5f5b6b"}}>{"Confira a mudan\u00e7a antes de salvar."}</p>
        <div style={{display:"grid",gap:5,marginBottom:14,fontSize:13,color:"#454253"}}>
          <div><b>{"\u00c1rea:"}</b> {pendingAreaStatus.assignment.area}</div>
          <div><b>{"Respons\u00e1vel:"}</b> {pendingAreaStatus.assignment.owner}</div>
          <div><b>Status atual:</b> {pendingAreaStatus.assignment.status}</div>
          <div><b>Novo status:</b> {pendingAreaStatus.nextStatus}</div>
        </div>
        <div className="modalActions" style={{marginTop:0}}>
          <button className="secondary" onClick={()=>setPendingAreaStatus(null)}>Cancelar</button>
          <button className="primary" onClick={()=>void updateAreaStatus(pendingAreaStatus.task,pendingAreaStatus.assignment,pendingAreaStatus.nextStatus)}>Confirmar e salvar</button>
        </div>
      </div>}
      {pendingTaskUpdate&&pendingTaskUpdate.task.id===selected.id&&<div style={{padding:14,marginTop:14,border:"1px solid #d9c5f0",background:"#fbf8ff",borderRadius:10}}><b style={{color:"#54218a"}}>Confirmar alteração?</b><p style={{margin:"7px 0 12px",fontSize:13,color:"#5f5b6b"}}>Confira a mudança antes de salvar e fechar a solicitação.</p><div style={{display:"grid",gap:5,marginBottom:14,fontSize:13,color:"#454253"}}>{pendingTaskUpdate.patch.status&&<div><b>Status:</b> {pendingTaskUpdate.task.status} → {pendingTaskUpdate.patch.status}</div>}{pendingTaskUpdate.patch.priority&&<div><b>Prioridade:</b> {pendingTaskUpdate.task.priority} → {pendingTaskUpdate.patch.priority}</div>}{pendingTaskUpdate.patch.ownerId!==undefined&&<div><b>Responsável:</b> {pendingTaskUpdate.task.owner} → {pendingTaskUpdate.patch.ownerId?members.find(member=>member.id===pendingTaskUpdate.patch.ownerId)?.full_name||"Responsável selecionado":"Não atribuído"}</div>}</div><div className="modalActions" style={{marginTop:0}}><button className="secondary" onClick={()=>setPendingTaskUpdate(null)}>Cancelar</button><button className="primary" onClick={()=>void updateTask(pendingTaskUpdate.task,pendingTaskUpdate.patch)}>Confirmar, salvar e fechar</button></div></div>}
      <p className="notice">O status geral é atualizado automaticamente conforme o andamento das áreas responsáveis.</p>{isManager&&<><label>Prioridade<select value={selected.priority} onChange={e=>setPendingTaskUpdate({task:selected,patch:{priority:e.target.value as Priority}})}>{(["Baixa","Média","Alta","Urgente"] as Priority[]).map(s=><option key={s}>{s}</option>)}</select></label></>}{(isManager || selected.requesterId===profile?.id)&&<div style={{marginTop:18}}>
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

      {dataError&&<div className="errorBox" style={{marginTop:12}}>{dataError}</div>}
      </div></div>}
      </>
    }
  >
<div className="content">
        {dataError&&<div className="errorBanner"><span>{dataError}</span><button onClick={()=>session?.user&&loadData(session.user)}>Tentar novamente</button></div>}
        {commentNotice&&<div className="notice" style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,marginBottom:16}}><span style={{display:"flex",alignItems:"center",gap:8}}><Bell size={16}/>{commentNotice}</span><button className="textButton" onClick={()=>setCommentNotice("")}>Fechar</button></div>}
        <style>{`.dashFilterNote{margin:12px 0 0;padding:10px 12px;border-radius:9px;background:#fff9eb;color:#8a641c;font-size:11px;line-height:1.5}`}</style>
        {active==="Dashboard" && <Dashboard
          dashboardDateMode={dashboardDateMode}
          setDashboardDateMode={setDashboardDateMode}
          dashboardPeriod={dashboardPeriod}
          setDashboardPeriod={setDashboardPeriod}
          dashboardStart={dashboardStart}
          setDashboardStart={setDashboardStart}
          dashboardEnd={dashboardEnd}
          setDashboardEnd={setDashboardEnd}
          dashboardDateLabel={dashboardDateLabel}
          dashboardTasks={dashboardTasks}
          dashboardInProgress={dashboardInProgress}
          dashboardDone={dashboardDone}
          dashboardLate={dashboardLate}
          areaNames={areaNames}
          requestsByOwner={requestsByOwner}
          dashboardOwnerItems={pageItems("dashboardOwners",requestsByOwner)}
          dashboardOwnersPagination={paginationProps("dashboardOwners",requestsByOwner.length)}
          unreadCounts={unreadCounts}
          onNewRequest={()=>setShowNew(true)}
          onNavigate={section=>setActive(section)}
          onSelectTask={setSelected}
        />}
        {active==="Solicitações" && <Solicitacoes
          search={search}
          onSearchChange={setSearch}
          requestUserFilter={requestUserFilter}
          onRequestUserFilterChange={setRequestUserFilter}
          requestStatusFilter={requestStatusFilter}
          onRequestStatusFilterChange={setRequestStatusFilter}
          requestUsers={requestUsers}
          hasUnassigned={tasks.some(t=>t.areaAssignments.length>0&&t.areaAssignments.every(a=>!a.ownerId))}
          filtered={filtered}
          unreadCounts={unreadCounts}
          onClearFilters={()=>{setSearch("");setRequestUserFilter("Todos");setRequestStatusFilter("Todos")}}
          onNewRequest={()=>setShowNew(true)}
          onSelectTask={setSelected}
          pagination={paginationProps("requests",filtered.length)}
        />}        {active==="Pedidos de Materiais" && <PedidosMateriais
  ordersLoading={ordersLoading}
  loadMaterialOrders={loadMaterialOrders}
  ordersError={ordersError}
  setOrdersError={setOrdersError}
  myOrderAreas={myOrderAreas}
  profile={profile}
  setOrderAreaId={setOrderAreaId}
  setShowNewMaterialOrder={setShowNewMaterialOrder}
  applyOrdersPeriod={applyOrdersPeriod}
  ordersPeriodPreset={ordersPeriodPreset}
  ordersStartDate={ordersStartDate}
  setOrdersStartDate={setOrdersStartDate}
  ordersEndDate={ordersEndDate}
  setOrdersEndDate={setOrdersEndDate}
  ordersStatusFilter={ordersStatusFilter}
  setOrdersStatusFilter={setOrdersStatusFilter}
  ordersAreaFilter={ordersAreaFilter}
  setOrdersAreaFilter={setOrdersAreaFilter}
  orderStatusLabels={orderStatusLabels}
  areas={areas}
  ordersDateRangeInvalid={ordersDateRangeInvalid}
  filteredMaterialOrders={filteredMaterialOrders}
  materialOrders={materialOrders}
  pendingManagerOrders={pendingManagerOrders}
  pendingStockOrders={pendingStockOrders}
  activeMaterialOrders={activeMaterialOrders}
  materialOrderItems={materialOrderItems}
  orderRequesterName={orderRequesterName}
  orderAreaName={orderAreaName}
  pageItems={pageItems}
  paginationProps={paginationProps}
  selectedOrder={selectedOrder}
  selectedOrderItems={selectedOrderItems}
  selectedOrderHistory={selectedOrderHistory}
  setSelectedMaterialOrder={setSelectedMaterialOrder}
  isManager={isManager}
  canManageStock={canManageStock}
  ordersSaving={ordersSaving}
  runMaterialOrderAction={runMaterialOrderAction}
/>}
        {active==="Cronograma" && <Cronograma
  scheduleOverdueCount={scheduleOverdueCount}
  scheduleTodayCount={scheduleTodayCount}
  scheduleNextSevenCount={scheduleNextSevenCount}
  nonCancelledTaskCount={tasks.filter(t=>t.status!=="Cancelada").length}
  scheduleTasks={scheduleTasks}
  scheduleToday={scheduleToday}
  schedulePeriod={schedulePeriod}
  setSchedulePeriod={setSchedulePeriod}
  scheduleOwnerFilter={scheduleOwnerFilter}
  setScheduleOwnerFilter={setScheduleOwnerFilter}
  scheduleAreaFilter={scheduleAreaFilter}
  setScheduleAreaFilter={setScheduleAreaFilter}
  scheduleStatusFilter={scheduleStatusFilter}
  setScheduleStatusFilter={setScheduleStatusFilter}
  scheduleStartDate={scheduleStartDate}
  setScheduleStartDate={setScheduleStartDate}
  scheduleEndDate={scheduleEndDate}
  setScheduleEndDate={setScheduleEndDate}
  requestUsers={requestUsers}
  hasUnassignedTasks={tasks.some(t=>t.areaAssignments.length>0&&t.areaAssignments.every(a=>!a.ownerId))}
  areas={areas}
  pageItems={pageItems}
  paginationProps={paginationProps}
  onSelectTask={setSelected}
/>}
{active==="Colaboradores" && <Colaboradores
  members={members}
  areas={areas}
  isAdmin={profile?.role==="admin"}
  onRefresh={()=>session?.user&&loadData(session.user)}
  onSelectMember={(m)=>{
    setSelectedMember(m);
    setMemberTaskStatus("Todas");
    setMemberForm({full_name:m.full_name,role:m.role,area_ids:m.area_ids||[],active:m.active,stock_manager:m.stock_manager===true});
    setMemberMessage("");
    setMemberEditing(false);
    setMemberConfirmOpen(false);
  }}
  pageItems={pageItems}
  paginationProps={paginationProps}
/>}
        {active==="Estoque" && <Estoque
  canManageStock={canManageStock}
  stockSection={stockSection}
  setStockSection={setStockSection}
  loadStock={loadStock}
  stockLoading={stockLoading}
  stockError={stockError}
  setStockError={setStockError}
  openNewMaterial={openNewMaterial}
  stockMaterials={stockMaterials}
  setMovementError={setMovementError}
  setMovementForm={setMovementForm}
  setShowStockMovement={setShowStockMovement}
  stockMovementSummary={stockMovementSummary}
  reservedByMaterial={reservedByMaterial}
  stockAlerts={stockAlerts}
  pageItems={pageItems}
  paginationProps={paginationProps}
  exportStockConsumption={exportStockConsumption}
  filteredConsumptionMovements={filteredConsumptionMovements}
  stockConsumptionMaterial={stockConsumptionMaterial}
  setStockConsumptionMaterial={setStockConsumptionMaterial}
  stockConsumptionStart={stockConsumptionStart}
  setStockConsumptionStart={setStockConsumptionStart}
  stockConsumptionEnd={stockConsumptionEnd}
  setStockConsumptionEnd={setStockConsumptionEnd}
  stockConsumptionSummary={stockConsumptionSummary}
  stockConsumptionByMonth={stockConsumptionByMonth}
  stockConsumptionByMaterial={stockConsumptionByMaterial}
  filteredMaterials={filteredMaterials}
  stockSearch={stockSearch}
  setStockSearch={setStockSearch}
  materialImageUrls={materialImageUrls}
  openEditMaterial={openEditMaterial}
  tasks={tasks}
  stockReportMaterial={stockReportMaterial}
  setStockReportMaterial={setStockReportMaterial}
  stockReportType={stockReportType}
  setStockReportType={setStockReportType}
  stockReportStart={stockReportStart}
  setStockReportStart={setStockReportStart}
  stockReportEnd={stockReportEnd}
  setStockReportEnd={setStockReportEnd}
  filteredStockMovements={filteredStockMovements}
  stockReportSummary={stockReportSummary}
  exportStockMovements={exportStockMovements}
/>}
        {active==="Relatórios" && <Relatorios
  exportReports={exportReports}
  reportDateMode={reportDateMode}
  setReportDateMode={setReportDateMode}
  reportAreaFilter={reportAreaFilter}
  setReportAreaFilter={setReportAreaFilter}
  reportOwnerFilter={reportOwnerFilter}
  setReportOwnerFilter={setReportOwnerFilter}
  reportStatusFilter={reportStatusFilter}
  setReportStatusFilter={setReportStatusFilter}
  reportPeriod={reportPeriod}
  setReportPeriod={setReportPeriod}
  reportStartDate={reportStartDate}
  setReportStartDate={setReportStartDate}
  reportEndDate={reportEndDate}
  setReportEndDate={setReportEndDate}
  areas={areas}
  requestUsers={requestUsers}
  tasks={tasks}
  reportDateLabel={reportDateLabel}
  reportTasks={reportTasks}
  reportReceived={reportReceived}
  reportAnalysis={reportAnalysis}
  reportAwaitingApproval={reportAwaitingApproval}
  reportExecuting={reportExecuting}
  reportDone={reportDone}
  reportCancelled={reportCancelled}
  reportLate={reportLate}
  reportOpenBase={reportOpenBase}
  reportCompletionBase={reportCompletionBase}
  reportCompletionRate={reportCompletionRate}
  reportOverdueRate={reportOverdueRate}
  reportByArea={reportByArea}
  reportByOwner={reportByOwner}
  pageItems={pageItems}
  paginationProps={paginationProps}
  onSelectTask={task=>setSelected(task)}
  unreadCounts={unreadCounts}
/>}
        {active==="Configurações" && <Configuracoes areaNames={areaNames} userEmail={profile?.email ?? null} userRole={profile?.role ?? null}/>}
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
  </MainLayout>;
}


