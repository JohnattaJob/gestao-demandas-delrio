import {
  BarChart3,
  CalendarDays,
  ChevronDown,
  ClipboardCheck,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Package,
  Settings,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type UserRole = "admin" | "gestor" | "colaborador" | null;

type SidebarProps = {
  active: string;
  onNavigate: (name: string) => void;
  mobileOpen: boolean;
  onClose: () => void;
  taskCount: number;
  userName: string | null;
  userRole: UserRole;
  onSignOut: () => void | Promise<void>;
};

const navigation: { name: string; icon: LucideIcon; adminOnly?: boolean }[] = [
  { name: "Dashboard", icon: LayoutDashboard },
  { name: "Solicitações", icon: ClipboardList },
  { name: "Pedidos de Materiais", icon: ClipboardCheck },
  { name: "Cronograma", icon: CalendarDays },
  { name: "Colaboradores", icon: Users },
  { name: "Estoque", icon: Package },
  { name: "Relatórios", icon: BarChart3 },
  { name: "Configurações", icon: Settings },
  { name: "Auditoria", icon: ShieldCheck, adminOnly: true },
];

export default function Sidebar({
  active,
  onNavigate,
  mobileOpen,
  onClose,
  taskCount,
  userName,
  userRole,
  onSignOut,
}: SidebarProps) {
  const displayName = userName || "Usuário";
  const initials = displayName
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const roleLabel =
    userRole === "admin"
      ? "Administrador"
      : userRole === "gestor"
        ? "Gestor"
        : "Colaborador";

  return (
    <aside className={`sidebar ${mobileOpen ? "open" : ""}`}>
      <div className="brand">
        <img
          src="/logo-delrio-branco.svg"
          alt="DelRio"
          className="brandLogo sidebarBrandLogo"
        />
        <div>
          <small>GESTÃO DE DEMANDAS</small>
        </div>
        <button
          type="button"
          className="closeMenu"
          onClick={onClose}
          aria-label="Fechar menu"
        >
          <X />
        </button>
      </div>

      <div className="workspace">
        <span className="dot" />
        Ambiente de Marketing
        <ChevronDown size={14} />
      </div>

      <div className="navLabel">MENU PRINCIPAL</div>

      {navigation
        .filter((item) => !item.adminOnly || userRole === "admin")
        .map(({ name, icon: Icon }) => (
          <button
            type="button"
            key={name}
            className={`navItem ${active === name ? "active" : ""}`}
            aria-current={active === name ? "page" : undefined}
            onClick={() => {
              onNavigate(name);
              onClose();
            }}
          >
            <Icon size={18} />
            {name}
            {name === "Solicitações" && (
              <span className="navCount">{taskCount}</span>
            )}
          </button>
        ))}

      <div className="sidebarBottom">
        <div className="userAvatar">{initials}</div>
        <div>
          <b>{displayName}</b>
          <small>{roleLabel}</small>
        </div>
        <button
          type="button"
          className="logoutIcon"
          title="Sair"
          aria-label="Sair do sistema"
          onClick={onSignOut}
        >
          <LogOut size={16} />
        </button>
      </div>
    </aside>
  );
}