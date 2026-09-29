import {
  Activity as ActivityIcon,
  CalendarDays,
  CheckCheck,
  CircleDashed,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  Store,
  Users,
} from "lucide-react";
import Image from "next/image";
import type { Activity, Collab } from "@/lib/types";
import { isOnline } from "@/lib/format";

type Props = {
  view: "active" | "done";
  counts: { active: number; done: number };
  agendaCount: number;
  dashboardActive: boolean;
  storesActive: boolean;
  onView: (v: "active" | "done") => void;
  onOpenDashboard: () => void;
  onOpenAgenda: () => void;
  onOpenStores: () => void;
  agendaActive: boolean;
  collaborators: Collab[];
  activities: Activity[];
  now: number;
  collapsed: boolean;
  teamOpen: boolean;
  activityOpen: boolean;
  activityAlert: boolean;
  onToggleCollapse: () => void;
  onToggleTeam: () => void;
  onToggleActivity: () => void;
};

export default function Sidebar({
  view,
  counts,
  agendaCount,
  dashboardActive,
  storesActive,
  onView,
  onOpenDashboard,
  onOpenAgenda,
  onOpenStores,
  agendaActive,
  collaborators,
  activities,
  now,
  collapsed,
  teamOpen,
  activityOpen,
  activityAlert,
  onToggleCollapse,
  onToggleTeam,
  onToggleActivity,
}: Props) {
  const onlineN = collaborators.filter((c) => isOnline(c, now)).length;

  return (
    <aside className={`side${collapsed ? " collapsed" : ""}`}>
      <div className="brand-row">
        <div className="brand-wrap">
          <Image src="/logo_oniocheck_horizontal.png" alt="OnioCheck" width={1200} height={429} className="sidebar-brand-full" />
          <Image src="/favicon.png" alt="" aria-hidden="true" width={256} height={256} className="sidebar-brand-mark" />
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

      <nav className="tabs" aria-label="Telas">
        <button
          className="tab"
          title="Em andamento"
          aria-label={`Em andamento: ${counts.active}`}
          aria-pressed={view === "active"}
          onClick={() => onView("active")}
        >
          <span className="tab-icon"><CircleDashed size={14} /></span>
          <span>Em andamento</span>
          <span className="count">{counts.active}</span>
        </button>
        <button
          className="tab"
          title="Finalizados"
          aria-label={`Finalizados: ${counts.done}`}
          aria-pressed={view === "done"}
          onClick={() => onView("done")}
        >
          <span className="tab-icon"><CheckCheck size={14} /></span>
          <span>Finalizados</span>
          <span className="count">{counts.done}</span>
        </button>
      </nav>

      <button
        className={`tab ${dashboardActive ? "active" : ""}`}
        title="Dashboard"
        aria-pressed={dashboardActive}
        onClick={onOpenDashboard}
      >
        <span className="tab-icon"><LayoutDashboard size={14} /></span>
        <span>Dashboard</span>
      </button>

      <button
        className={`tab ${agendaActive ? "active" : ""}`}
        title="Agenda"
        aria-pressed={agendaActive}
        onClick={onOpenAgenda}
      >
        <span className="tab-icon"><CalendarDays size={14} /></span>
        <span>Agenda</span>
        {agendaCount > 0 && <span className="count">{agendaCount}</span>}
      </button>

      <button
        className={`tab ${storesActive ? "active" : ""}`}
        title="Cadastros/Lojas"
        aria-pressed={storesActive}
        onClick={onOpenStores}
      >
        <span className="tab-icon"><Store size={14} /></span>
        <span>Cadastros/Lojas</span>
      </button>

      <button
        className={`tab ${teamOpen ? "active" : ""}`}
        title="Equipe"
        aria-pressed={teamOpen}
        onClick={onToggleTeam}
      >
        <span className="tab-icon"><Users size={14} /></span>
        <span>Equipe</span>
        <span className="count">{onlineN}</span>
      </button>

      <button
        className={`tab ${activityOpen ? "active" : ""} ${activityAlert ? "has-alert" : ""}`}
        title="Atividade recente"
        aria-pressed={activityOpen}
        onClick={onToggleActivity}
      >
        <span className="tab-icon"><ActivityIcon size={14} /></span>
        <span>Atividade recente</span>
        <span className="tab-meta">
          {activities.length > 0 && <span className="count">{Math.min(activities.length, 9)}</span>}
          {activityAlert && <span className="activity-alert" aria-label="Novas atividades" />}
        </span>
      </button>

    </aside>
  );
}
