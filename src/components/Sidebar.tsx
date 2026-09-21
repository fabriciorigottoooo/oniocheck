import { Activity as ActivityIcon, Users } from "lucide-react";
import type { Activity, Collab } from "@/lib/types";
import { activityParts, isOnline, relTime } from "@/lib/format";
import Avatar from "./Avatar";

type Props = {
  view: "active" | "done";
  counts: { active: number; done: number };
  onView: (v: "active" | "done") => void;
  collaborators: Collab[];
  activities: Activity[];
  meId: string | null;
  meAvatarUrl?: string | null;
  meName?: string | null;
  now: number;
  onEditIdentity: () => void;
  onOpenAdmin: () => void;
  onOpenProfile: () => void;
};

export default function Sidebar({
  view,
  counts,
  onView,
  collaborators,
  activities,
  meId,
  meAvatarUrl,
  meName,
  now,
  onEditIdentity,
  onOpenAdmin,
  onOpenProfile,
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
    <aside className="side">
      <div className="brand-wrap">
        <img
          src="/logo_oniocheck_png.png"
          alt="Logo OnioCheck"
          className="brand-mark"
        />
        <div className="brand-copy">
          <div className="brand">
            onio<span>check</span>
          </div>
        </div>
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
          Em andamento <span className="count">{counts.active}</span>
        </button>
        <button
          className="tab"
          aria-pressed={view === "done"}
          onClick={() => onView("done")}
        >
          Finalizados <span className="count">{counts.done}</span>
        </button>
      </nav>

      <button className="secondary" onClick={onOpenAdmin}>
        Administrador
      </button>

      <div className="side-section team">
        <div className="side-label">
          <Users size={11} /> Equipe · {onlineN} online
        </div>
        {sorted.length ? (
          <div className="team-list">
            {sorted.map((c) => {
              const online = isOnline(c, now);
              const inner = (
                <>
                  <Avatar name={c.name} color={c.color} size={26} online={online} imageUrl={c.avatarUrl ?? null} />
                  <span className="team-meta">
                    <span className="name">
                      {c.name}
                      {c.id === meId && <span className="you">você</span>}
                    </span>
                    <span className="status">
                      {online ? (
                        <>
                          <span className="status-dot on" /> online agora
                        </>
                      ) : (
                        "visto " + relTime(c.lastSeenAt, now)
                      )}
                    </span>
                  </span>
                </>
              );
              return c.id === meId ? (
                <button
                  key={c.id}
                  className="team-row"
                  onClick={onEditIdentity}
                  title="Editar meu nome"
                >
                  {inner}
                </button>
              ) : (
                <div key={c.id} className="team-row">
                  {inner}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="team-empty">
            Compartilhe o link desta página — cada pessoa entra com o próprio
            nome e acompanha tudo em tempo real.
          </p>
        )}
      </div>

      <div className="side-section feed">
        <div className="side-label">
          <ActivityIcon size={11} /> Atividade recente
        </div>
        <div className="feed-list">
          {activities.length ? (
            activities.map((a) => {
              const { actor, msg } = activityParts(a);
              return (
                <div key={a.id} className="feed-item">
                  <Avatar name={a.actorName} color={a.actorColor} size={22} imageUrl={null} />
                  <div>
                    <p>
                      <strong>{actor}</strong> {msg}
                    </p>
                    <time>{relTime(a.createdAt, now)}</time>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="feed-empty">
              As ações da equipe aparecem aqui, em tempo real.
            </p>
          )}
        </div>
      </div>

      <p className="side-note">
        Seu processo, organizado em equipe. As marcações são salvas no servidor
        e aparecem na hora para todos.
      </p>
    </aside>
  );
}
