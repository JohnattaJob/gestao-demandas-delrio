
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const colaboradores = [
  {
    nome: 'Bianca Monte',
    email: 'bianca.monte@delrio.com.br',
    area: 'Criação',
    role: 'colaborador'
  },
  {
    nome: 'Sabrina Silva',
    email: 'sabrina.silva@delrio.com.br',
    area: 'Eventos e Ações',
    role: 'colaborador'
  },
  {
    nome: 'Iara Lins',
    email: 'iara.lins@delrio.com.br',
    area: 'Materiais e Estoque',
    role: 'colaborador'
  },
  {
    nome: 'Tatiana Lowaatzki',
    email: 'tatiana.lowatzki@delrio.com.br',
    area: 'Planejamento e Marketing',
    role: 'gestor'
  },
  {
    nome: 'Drielly Duarte',
    email: 'drielly.duarte@delrio.com.br',
    area: 'Social Media',
    role: 'colaborador'
  }
];

async function executar() {
  const credenciais = [];

  for (const pessoa of colaboradores) {
    console.log(`Processando ${pessoa.nome}...`);

    const { data: area, error: erroArea } = await supabase
      .from('areas')
      .select('id')
      .eq('name', pessoa.area)
      .single();

    if (erroArea || !area) {
      throw new Error(`Área não encontrada: ${pessoa.area}`);
    }

    let { data: perfil, error: erroPerfil } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', pessoa.email)
      .maybeSingle();

    if (erroPerfil) throw erroPerfil;

    let senha = null;

    if (!perfil) {
      senha = randomBytes(24).toString('base64url');

      const { data, error } = await supabase.auth.admin.createUser({
        email: pessoa.email,
        password: senha,
        email_confirm: true,
        user_metadata: {
          full_name: pessoa.nome
        }
      });

      if (error) throw error;

      perfil = { id: data.user.id };
      console.log(`Conta criada: ${pessoa.email}`);
    } else {
      console.log(`Conta já existente: ${pessoa.email}`);
    }

    const { error: erroAtualizacao } = await supabase
      .from('profiles')
      .update({
        full_name: pessoa.nome,
        role: pessoa.role,
        area_id: area.id,
        active: true
      })
      .eq('id', perfil.id);

    if (erroAtualizacao) throw erroAtualizacao;

    const { data: vinculo, error: erroVinculo } = await supabase
      .from('profile_areas')
      .select('profile_id')
      .eq('profile_id', perfil.id)
      .eq('area_id', area.id)
      .maybeSingle();

    if (erroVinculo) throw erroVinculo;

    if (!vinculo) {
      const { error } = await supabase
        .from('profile_areas')
        .insert({
          profile_id: perfil.id,
          area_id: area.id
        });

      if (error) throw error;
    }

    if (senha) {
      credenciais.push({
        nome: pessoa.nome,
        email: pessoa.email,
        senha
      });
    }

    console.log(`Concluído: ${pessoa.nome}`);
  }

  console.log('\n=== NOVAS CREDENCIAIS ===');
  console.table(credenciais);

  console.log('\nCadastro em lote finalizado.');
}

executar().catch(error => {
  console.error('Erro no cadastro:', error.message);
  process.exitCode = 1;
});
