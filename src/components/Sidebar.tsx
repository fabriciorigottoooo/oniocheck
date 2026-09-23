import {
  Activity as ActivityIcon,
  CalendarDays,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  CircleDashed,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Users,
} from "lucide-react";
import type { Activity, Collab } from "@/lib/types";
import { activityParts, isOnline, relTime } from "@/lib/format";
import Avatar from "./Avatar";

type Props = {
  view: "active" | "done";
  counts: { active: number; done: number };
  agendaCount: number;
  onView: (v: "active" | "done") => void;
  onOpenAgenda: () => void;
  agendaActive: boolean;
  collaborators: Collab[];
  activities: Activity[];
  meId: string | null;
  meAvatarUrl?: string | null;
  meName?: string | null;
  now: number;
  collapsed: boolean;
  teamOpen: boolean;
  activityOpen: boolean;
  onToggleCollapse: () => void;
  onToggleTeam: () => void;
  onToggleActivity: () => void;
  onEditIdentity: () => void;
  onOpenAdmin: () => void;
  onOpenProfile: () => void;
  onLogout: () => void;
  onSelectCollaborator?: (id: string) => void;
};

export default function Sidebar({
  view,
  counts,
  agendaCount,
  onView,
  onOpenAgenda,
  agendaActive,
  collaborators,
  activities,
  meId,
  meAvatarUrl,
  meName,
  now,
  collapsed,
  teamOpen,
  activityOpen,
  onToggleCollapse,
  onToggleTeam,
  onToggleActivity,
  onEditIdentity,
  onOpenAdmin,
  onOpenProfile,
  onLogout,
  onSelectCollaborator,
}: Props) {
  const onlineN = collaborators.filter((c) => isOnline(c, now)).length;
  const sorted = [...collaborators].sort((a, b) => {
    const oa = isOnline(a, now) ? 0 : 1;
    const ob = isOnline(b, now) ? 0 : 1;
    if (oa !== ob) return oa - ob;
    if (a.id === meId) return -1;
    if (b.id === meId) return 1;
    return a.name.localeCompare(b.name, "pt-BR");
  });

  return (
    <aside className={`side${collapsed ? " collapsed" : ""}`}>
      <div className="brand-row">
        <div className="brand-wrap no-logo">
          <div className="brand-copy">
            <div className="brand">
              onio<span>check</span>
            </div>
          </div>
        </div>
        <button
          type="button"
          className="sidebar-toggle"
          onClick={onToggleCollapse}
          aria-label={collapsed ? "Expandir sidebar" : "Retrair sidebar"}
          title={collapsed ? "Expandir sidebar" : "Retrair sidebar"}
        >
          {collapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
        </button>
      </div>

      <div className="profile-summary" onClick={onOpenProfile} role="button" tabIndex={0} onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onOpenProfile();
      }}>
        {meAvatarUrl ? (
          <img src={meAvatarUrl} alt={meName ?? "Perfil"} className="profile-avatar" />
        ) : (
          <Avatar name={meName ?? "Você"} color={"#2d6fe8"} size={38} />
        )}
        <div className="profile-meta">
          <strong>{meName ?? "Você"}</strong>
          <span>Configurar perfil</span>
        </div>
      </div>

      <nav className="tabs" aria-label="Telas">
        <button
          className="tab"
          aria-pressed={view === "active"}
          onClick={() => onView("active")}
        >
          <span className="tab-icon"><CircleDashed size={14} /></span>
          <span>Em andamento</span>
          <span className="count">{counts.active}</span>
        </button>
        <button
          className="tab"
          aria-pressed={view === "done"}
          onClick={() => onView("done")}
        >
          <span className="tab-icon"><CheckCheck size={14} /></span>
          <span>Finalizados</span>
          <span className="count">{counts.done}</span>
        </button>
      </nav>

      <button
        className={`tab ${agendaActive ? "active" : ""}`}
        aria-pressed={agendaActive}
        onClick={onOpenAgenda}
      >
        <span className="tab-icon"><CalendarDays size={14} /></span>
        <span>Agenda</span>
        {agendaCount > 0 && <span className="count">{agendaCount}</span>}
      </button>

      <button
        className={`tab ${teamOpen ? "active" : ""}`}
        aria-pressed={teamOpen}
        onClick={onToggleTeam}
      >
        <span className="tab-icon"><Users size={14} /></span>
        <span>Equipe</span>
        <span className="count">{onlineN}</span>
      </button>

      <button
        className={`tab ${activityOpen ? "active" : ""}`}
        aria-pressed={activityOpen}
        onClick={onToggleActivity}
      >
        <span className="tab-icon"><ActivityIcon size={14} /></span>
        <span>Atividade recente</span>
        {activities.length > 0 && <span className="count">{Math.min(activities.length, 9)}</span>}
      </button>

      <div className="sidebar-logout-wrap">
        <button
          type="button"
          className={`danger logoff-btn${collapsed ? " icon-only" : ""}`}
          onClick={onLogout}
          title="Sair"
          aria-label="Sair da conta"
        >
          <LogOut size={14} />
          {!collapsed && "Sair"}
        </button>
      </div>

      <button
        className={`secondary admin-low${collapsed ? " icon-only" : ""}`}
        onClick={onOpenAdmin}
        title="Administrador"
        aria-label="Administrador"
      >
        <Settings size={14} />
        {!collapsed && "Administrador"}
      </button>
    </aside>
  );
}
