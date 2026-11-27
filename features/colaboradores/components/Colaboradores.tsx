"use client";

import { RefreshCw } from "lucide-react";
import Pagination from "@/components/shared/Pagination";
import type { Area, Profile } from "@/types";

type Props = {
  members: Profile[];
  areas: Area[];
  isAdmin: boolean;
  onRefresh: () => void;
  onSelectMember: (member: Profile) => void;
  pageItems: <T,>(key: string, items: T[]) => T[];
  paginationProps: (key: string, total: number) => React.ComponentProps<typeof Pagination>;
};

export default function Colaboradores({
  members,
  areas,
  isAdmin,
  onRefresh,
  onSelectMember,
  pageItems,
  paginationProps,
}: Props) {
  return (
    <>
      <div className="pageHeading">
        <div>
          <p className="eyebrow">EQUIPE</p>
          <h1>Colaboradores</h1>
          <p className="sub">Gerencie áreas, perfis e situação dos usuários cadastrados.</p>
        </div>
        <button className="secondary" onClick={onRefresh}>
          <RefreshCw size={15} /> Atualizar lista
        </button>
      </div>

      <div className="panel">
        <div className="panelHead">
          <div>
            <h3>Equipe cadastrada</h3>
            <p>{members.length} colaborador(es) cadastrado(s)</p>
          </div>
        </div>

        {isAdmin && (
          <div className="notice">
            Para adicionar uma pessoa, primeiro crie o usuário em Supabase → Authentication → Users → Add user. O banco cria o perfil automaticamente. Depois atualize esta lista para gerenciar sua área e função.
          </div>
        )}

        <div className="memberGrid">
          {pageItems("members", members).map((m) => (
            <button
              className="memberCard memberButton"
              key={m.id}
              onClick={() => onSelectMember(m)}
            >
              <div className="userAvatar">
                {m.full_name.split(" ").map((x) => x[0]).slice(0, 2).join("")}
              </div>
              <b>{m.full_name}</b>
              <small>{m.email || "Sem e-mail"}</small>
              <small>
                {m.role === "admin"
                  ? "Administrador"
                  : m.role === "gestor"
                    ? "Gestor"
                    : "Colaborador"}
              </small>
              <small>
                {(m.area_ids || []).length
                  ? areas
                      .filter((a) => (m.area_ids || []).includes(a.id))
                      .map((a) => a.name)
                      .join(" · ")
                  : "Área não definida"}
              </small>
            </button>
          ))}

          {!members.length && (
            <div className="emptyTable">
              Nenhum colaborador visível para este perfil.
            </div>
          )}
        </div>

        <Pagination {...paginationProps("members", members.length)} />
      </div>
    </>
  );
}
