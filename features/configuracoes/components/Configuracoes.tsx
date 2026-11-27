import { Layers } from "lucide-react";

type ConfiguracoesProps = {
  areaNames: string[];
  userEmail: string | null;
  userRole: string | null;
};

export default function Configuracoes({ areaNames, userEmail, userRole }: ConfiguracoesProps) {
  return (
    <>
      <div className="pageHeading">
        <div>
          <p className="eyebrow">ADMINISTRAÇÃO</p>
          <h1>Configurações</h1>
          <p className="sub">Parâmetros do ambiente e sua conta.</p>
        </div>
      </div>
      <div className="panel">
        <h3>Áreas cadastradas no Supabase</h3>
        <div className="areaList">
          {areaNames.map(area => (
            <div key={area}>
              <Layers size={17} />
              {area}
              <span>Ativa</span>
            </div>
          ))}
        </div>
        <p className="notice">
          Usuário conectado: {userEmail}. Perfil: {userRole}. A prioridade é controlada por gestores e administradores.
        </p>
      </div>
    </>
  );
}
