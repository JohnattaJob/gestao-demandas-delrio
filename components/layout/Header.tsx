import { Bell, Menu, X } from "lucide-react";
import Pagination from "@/components/shared/Pagination";

type HeaderNotification = {
  id: string;
  title: string;
  message: string;
  notification_type: string;
  material_order_id: string | null;
  is_read: boolean;
  created_at: string;
};

type PaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
};

type HeaderProps = {
  active: string;
  onOpenMenu: () => void;
  userName: string | null;
  dataLoading: boolean;
  notifications: HeaderNotification[];
  notificationsLoading: boolean;
  notificationsError: string;
  showNotifications: boolean;
  onToggleNotifications: () => void;
  onCloseNotifications: () => void;
  onMarkAllRead: () => void | Promise<void>;
  onOpenNotification: (notification: HeaderNotification) => void | Promise<void>;
  unreadNotificationCount: number;
  paginationProps: PaginationProps;
};

export default function Header({
  active,
  onOpenMenu,
  userName,
  dataLoading,
  notifications,
  notificationsLoading,
  notificationsError,
  showNotifications,
  onToggleNotifications,
  onCloseNotifications,
  onMarkAllRead,
  onOpenNotification,
  unreadNotificationCount,
  paginationProps,
}: HeaderProps) {
  const displayName = userName || "Usuário";
  const initials = displayName
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="topbar">
      <button
        type="button"
        className="menuButton"
        onClick={onOpenMenu}
        aria-label="Abrir menu"
      >
        <Menu />
      </button>

      <div className="crumb">
        Marketing <span>/</span> {active}
      </div>

      <div className="topRight">
        <div className="notificationWrap">
          <button
            className="notificationBell"
            type="button"
            aria-label="Abrir notificações"
            title="Notificações"
            aria-expanded={showNotifications}
            onClick={onToggleNotifications}
          >
            <Bell size={19} />
            {unreadNotificationCount > 0 && (
              <span className="notificationBadge">
                {unreadNotificationCount > 99
                  ? "99+"
                  : unreadNotificationCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="notificationPanel">
              <div className="notificationPanelHead">
                <div>
                  <b>Notificações</b>
                  <small>{unreadNotificationCount} não lida(s)</small>
                </div>

                <div className="notificationPanelActions">
                  <button
                    className="textButton"
                    type="button"
                    onClick={onMarkAllRead}
                    disabled={!unreadNotificationCount}
                  >
                    Marcar todas como lidas
                  </button>

                  <button
                    className="iconButton"
                    type="button"
                    aria-label="Fechar notificações"
                    onClick={onCloseNotifications}
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              {notificationsError && (
                <div className="notificationError">
                  {notificationsError}
                </div>
              )}

              {notificationsLoading && !notifications.length ? (
                <div className="notificationEmpty">
                  Carregando notificações...
                </div>
              ) : !notifications.length ? (
                <div className="notificationEmpty">
                  Você ainda não tem notificações.
                </div>
              ) : (
                <>
                  <div className="notificationList">
                    {notifications
                      .slice(
                        (paginationProps.page - 1) *
                          paginationProps.pageSize,
                        paginationProps.page *
                          paginationProps.pageSize
                      )
                      .map((item) => (
                        <button
                          type="button"
                          key={item.id}
                          className={`notificationItem ${
                            item.is_read ? "read" : "unread"
                          }`}
                          onClick={() => void onOpenNotification(item)}
                        >
                          <span className="notificationItemDot" />

                          <span className="notificationItemContent">
                            <b>{item.title}</b>
                            <span>{item.message}</span>
                            <small>
                              {new Date(item.created_at).toLocaleString(
                                "pt-BR",
                                {
                                  dateStyle: "short",
                                  timeStyle: "short",
                                }
                              )}
                            </small>
                          </span>
                        </button>
                      ))}
                  </div>

                  <Pagination
                    {...paginationProps}
                    total={notifications.length}
                  />
                </>
              )}
            </div>
          )}
        </div>

        <span className="online">
          <i />
          {dataLoading ? "Sincronizando" : "Conectado ao Supabase"}
        </span>

        <div className="userAvatar">{initials}</div>
      </div>
    </header>
  );
}