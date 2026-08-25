export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      action_plans: {
        Row: {
          answers: Json
          id: string
          response_id: string
          updated_at: string
        }
        Insert: {
          answers?: Json
          id?: string
          response_id: string
          updated_at?: string
        }
        Update: {
          answers?: Json
          id?: string
          response_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_plans_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: true
            referencedRelation: "test_responses"
            referencedColumns: ["id"]
          },
        ]
      }
      eventos: {
        Row: { id: string; conta_id: string; titulo: string; descricao: string | null; quando: string; termina_em: string | null; imagem_url: string | null; link_url: string | null; duracao_min: number | null; criado_por: string | null; created_at: string; updated_at: string; aula_id: string | null }
        Insert: { id?: string; conta_id: string; titulo: string; descricao?: string | null; quando: string; termina_em?: string | null; imagem_url?: string | null; link_url?: string | null; duracao_min?: number | null; criado_por?: string | null; created_at?: string; updated_at?: string; aula_id?: string | null }
        Update: { id?: string; conta_id?: string; titulo?: string; descricao?: string | null; quando?: string; termina_em?: string | null; imagem_url?: string | null; link_url?: string | null; duracao_min?: number | null; criado_por?: string | null; created_at?: string; updated_at?: string; aula_id?: string | null }
        Relationships: []
      }
      evento_destinos: {
        Row: { id: string; evento_id: string; group_id: string | null; person_id: string | null }
        Insert: { id?: string; evento_id: string; group_id?: string | null; person_id?: string | null }
        Update: { id?: string; evento_id?: string; group_id?: string | null; person_id?: string | null }
        Relationships: []
      }
      google_agendas_criadas: {
        Row: { mentor_id: string; calendar_id: string; criado_em: string }
        Insert: { mentor_id: string; calendar_id: string; criado_em?: string }
        Update: { mentor_id?: string; calendar_id?: string; criado_em?: string }
        Relationships: []
      }
      google_conexoes: {
        Row: { user_id: string; refresh_token: string; calendar_id: string | null; email: string | null; conectado_em: string; ultimo_erro: string | null; ultimo_uso_em: string | null }
        Insert: { user_id: string; refresh_token: string; calendar_id?: string | null; email?: string | null; conectado_em?: string; ultimo_erro?: string | null; ultimo_uso_em?: string | null }
        Update: { user_id?: string; refresh_token?: string; calendar_id?: string | null; email?: string | null; conectado_em?: string; ultimo_erro?: string | null; ultimo_uso_em?: string | null }
        Relationships: []
      }
      google_eventos: {
        Row: { id: string; user_id: string; origem: string; origem_id: string; google_event_id: string; criado_em: string }
        Insert: { id?: string; user_id: string; origem: string; origem_id: string; google_event_id: string; criado_em?: string }
        Update: { id?: string; user_id?: string; origem?: string; origem_id?: string; google_event_id?: string; criado_em?: string }
        Relationships: []
      }
      academy_banners: {
        Row: { id: string; mentor_id: string; imagem_url: string; link_url: string | null; titulo: string | null; ordem: number; ativo: boolean; created_at: string }
        Insert: { id?: string; mentor_id: string; imagem_url: string; link_url?: string | null; titulo?: string | null; ordem?: number; ativo?: boolean; created_at?: string }
        Update: { id?: string; mentor_id?: string; imagem_url?: string; link_url?: string | null; titulo?: string | null; ordem?: number; ativo?: boolean; created_at?: string }
        Relationships: []
      }
      biblioteca_materiais: {
        Row: { id: string; mentor_id: string; titulo: string; descricao: string | null; url: string; kind: string; categoria: string | null; capa_url: string | null; pasta_id: string | null; created_at: string; arquivo_proprio: boolean }
        Insert: { id?: string; mentor_id: string; titulo: string; descricao?: string | null; url: string; kind?: string; categoria?: string | null; capa_url?: string | null; pasta_id?: string | null; created_at?: string; arquivo_proprio?: boolean }
        Update: { id?: string; mentor_id?: string; titulo?: string; descricao?: string | null; url?: string; kind?: string; categoria?: string | null; capa_url?: string | null; pasta_id?: string | null; created_at?: string; arquivo_proprio?: boolean }
        Relationships: [
          {
            foreignKeyName: "biblioteca_materiais_pasta_id_fkey"
            columns: ["pasta_id"]
            isOneToOne: false
            referencedRelation: "biblioteca_pastas"
            referencedColumns: ["id"]
          },
        ]
      }
      biblioteca_pastas: {
        Row: { id: string; mentor_id: string; titulo: string; descricao: string | null; capa_url: string | null; ordem: number; created_at: string }
        Insert: { id?: string; mentor_id: string; titulo: string; descricao?: string | null; capa_url?: string | null; ordem?: number; created_at?: string }
        Update: { id?: string; mentor_id?: string; titulo?: string; descricao?: string | null; capa_url?: string | null; ordem?: number; created_at?: string }
        Relationships: []
      }
      biblioteca_pasta_destinos: {
        Row: { id: string; pasta_id: string; group_id: string | null; person_id: string | null; created_at: string }
        Insert: { id?: string; pasta_id: string; group_id?: string | null; person_id?: string | null; created_at?: string }
        Update: { id?: string; pasta_id?: string; group_id?: string | null; person_id?: string | null; created_at?: string }
        Relationships: [
          {
            foreignKeyName: "biblioteca_pasta_destinos_pasta_id_fkey"
            columns: ["pasta_id"]
            isOneToOne: false
            referencedRelation: "biblioteca_pastas"
            referencedColumns: ["id"]
          },
        ]
      }
      biblioteca_material_destinos: {
        Row: { id: string; material_id: string; group_id: string | null; person_id: string | null; created_at: string }
        Insert: { id?: string; material_id: string; group_id?: string | null; person_id?: string | null; created_at?: string }
        Update: { id?: string; material_id?: string; group_id?: string | null; person_id?: string | null; created_at?: string }
        Relationships: [
          {
            foreignKeyName: "biblioteca_material_destinos_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "biblioteca_materiais"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacoes: {
        Row: { id: string; user_id: string; conta_id: string; tipo: string; titulo: string; corpo: string | null; link: string | null; ator_nome: string | null; lida_em: string | null; created_at: string }
        Insert: { id?: string; user_id: string; conta_id: string; tipo: string; titulo: string; corpo?: string | null; link?: string | null; ator_nome?: string | null; lida_em?: string | null; created_at?: string }
        Update: { id?: string; user_id?: string; conta_id?: string; tipo?: string; titulo?: string; corpo?: string | null; link?: string | null; ator_nome?: string | null; lida_em?: string | null; created_at?: string }
        Relationships: []
      }
      pontos: {
        Row: { id: string; user_id: string; mentor_id: string; acao: string; pontos: number; referencia: string | null; created_at: string }
        Insert: { id?: string; user_id: string; mentor_id: string; acao: string; pontos: number; referencia?: string | null; created_at?: string }
        Update: { id?: string; user_id?: string; mentor_id?: string; acao?: string; pontos?: number; referencia?: string | null; created_at?: string }
        Relationships: []
      }
      community_post_groups: {
        Row: { post_id: string; group_id: string }
        Insert: { post_id: string; group_id: string }
        Update: { post_id?: string; group_id?: string }
        Relationships: [
          {
            foreignKeyName: "community_post_groups_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      community_posts: {
        Row: { id: string; author_id: string; author_name: string; body: string; file_url: string | null; file_kind: string | null; link_url: string | null; conta_id: string; created_at: string; updated_at: string }
        Insert: { id?: string; author_id: string; author_name: string; body: string; file_url?: string | null; file_kind?: string | null; link_url?: string | null; conta_id?: string; created_at?: string; updated_at?: string }
        Update: { id?: string; author_id?: string; author_name?: string; body?: string; file_url?: string | null; file_kind?: string | null; link_url?: string | null; conta_id?: string; created_at?: string; updated_at?: string }
        Relationships: []
      }
      community_comments: {
        Row: { id: string; post_id: string; author_id: string; author_name: string; body: string; created_at: string }
        Insert: { id?: string; post_id: string; author_id: string; author_name: string; body: string; created_at?: string }
        Update: { id?: string; post_id?: string; author_id?: string; author_name?: string; body?: string; created_at?: string }
        Relationships: []
      }
      community_reactions: {
        Row: { post_id: string; user_id: string; created_at: string }
        Insert: { post_id: string; user_id: string; created_at?: string }
        Update: { post_id?: string; user_id?: string; created_at?: string }
        Relationships: []
      }
      community_poll_options: {
        Row: { id: string; post_id: string; texto: string; ordem: number; conta_id: string; created_at: string }
        Insert: { id?: string; post_id: string; texto: string; ordem: number; conta_id?: string; created_at?: string }
        Update: { id?: string; post_id?: string; texto?: string; ordem?: number; conta_id?: string; created_at?: string }
        Relationships: []
      }
      community_poll_votes: {
        Row: { id: string; post_id: string; option_id: string; voter_id: string; voter_name: string; conta_id: string; created_at: string; updated_at: string }
        Insert: { id?: string; post_id: string; option_id: string; voter_id: string; voter_name: string; conta_id?: string; created_at?: string; updated_at?: string }
        Update: { id?: string; post_id?: string; option_id?: string; voter_id?: string; voter_name?: string; conta_id?: string; created_at?: string; updated_at?: string }
        Relationships: []
      }
      community_post_eventos: {
        Row: { post_id: string; evento_id: string | null; conta_id: string; created_at: string }
        Insert: { post_id: string; evento_id?: string | null; conta_id?: string; created_at?: string }
        Update: { post_id?: string; evento_id?: string | null; conta_id?: string; created_at?: string }
        Relationships: [
          {
            foreignKeyName: "community_post_eventos_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos"
            referencedColumns: ["id"]
          },
        ]
      }
      mentorias: {
        Row: {
          created_at: string
          id: string
          link_id: string | null
          mentor_id: string
          observacoes: string | null
          person_id: string
          sessoes_contratadas: number
          status: string
          titulo: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          link_id?: string | null
          mentor_id: string
          observacoes?: string | null
          person_id: string
          sessoes_contratadas?: number
          status?: string
          titulo?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          link_id?: string | null
          mentor_id?: string
          observacoes?: string | null
          person_id?: string
          sessoes_contratadas?: number
          status?: string
          titulo?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mentorias_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentorias_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "mentoria_links"
            referencedColumns: ["id"]
          },
        ]
      }
      mentoria_sessoes: {
        Row: {
          avaliacao_comentario: string | null
          avaliacao_estrelas: number | null
          avaliada_em: string | null
          cancelada_em: string | null
          cancelada_por: string | null
          cancelamento_motivo: string | null
          checklist_titulo: string | null
          concluida_em: string | null
          confirmado_em: string | null
          created_at: string
          duracao_real_min: number | null
          id: string
          link_id: string | null
          link_url: string | null
          local: string | null
          mentor_id: string
          mentoria_id: string
          modalidade: string
          origem: string
          quando: string
          remarcacoes: number
          resumo: string | null
          status: string
          termina_em: string | null
          updated_at: string
        }
        Insert: {
          avaliacao_comentario?: string | null
          avaliacao_estrelas?: number | null
          avaliada_em?: string | null
          cancelada_em?: string | null
          cancelada_por?: string | null
          cancelamento_motivo?: string | null
          checklist_titulo?: string | null
          concluida_em?: string | null
          confirmado_em?: string | null
          created_at?: string
          duracao_real_min?: number | null
          id?: string
          link_id?: string | null
          link_url?: string | null
          local?: string | null
          mentor_id: string
          mentoria_id: string
          modalidade: string
          origem?: string
          quando: string
          remarcacoes?: number
          resumo?: string | null
          status?: string
          termina_em?: string | null
          updated_at?: string
        }
        Update: {
          avaliacao_comentario?: string | null
          avaliacao_estrelas?: number | null
          avaliada_em?: string | null
          cancelada_em?: string | null
          cancelada_por?: string | null
          cancelamento_motivo?: string | null
          checklist_titulo?: string | null
          concluida_em?: string | null
          confirmado_em?: string | null
          created_at?: string
          duracao_real_min?: number | null
          id?: string
          link_id?: string | null
          link_url?: string | null
          local?: string | null
          mentor_id?: string
          mentoria_id?: string
          modalidade?: string
          origem?: string
          quando?: string
          remarcacoes?: number
          resumo?: string | null
          status?: string
          termina_em?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mentoria_sessoes_mentoria_id_fkey"
            columns: ["mentoria_id"]
            isOneToOne: false
            referencedRelation: "mentorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentoria_sessoes_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "mentoria_links"
            referencedColumns: ["id"]
          },
        ]
      }
      mentoria_disponibilidade: {
        Row: {
          ativo: boolean
          created_at: string
          dia_semana: number
          hora_fim: string
          hora_inicio: string
          id: string
          mentor_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          dia_semana: number
          hora_fim: string
          hora_inicio: string
          id?: string
          mentor_id: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          dia_semana?: number
          hora_fim?: string
          hora_inicio?: string
          id?: string
          mentor_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      mentoria_links: {
        Row: {
          antecedencia_max_dias: number
          antecedencia_min_horas: number
          ativo: boolean
          cancelamento_min_horas: number
          created_at: string
          descricao: string | null
          duracao_min: number
          id: string
          intervalo_min: number
          lembrete_horas: number[]
          link_url: string | null
          local: string | null
          max_remarcacoes: number
          mentor_id: string
          modalidade: string
          permite_cancelar: boolean
          permite_remarcar: boolean
          slug: string
          teto_por_dia: number | null
          titulo: string
          updated_at: string
          usa_google_freebusy: boolean
        }
        Insert: {
          antecedencia_max_dias?: number
          antecedencia_min_horas?: number
          ativo?: boolean
          cancelamento_min_horas?: number
          created_at?: string
          descricao?: string | null
          duracao_min: number
          id?: string
          intervalo_min?: number
          lembrete_horas?: number[]
          link_url?: string | null
          local?: string | null
          max_remarcacoes?: number
          mentor_id: string
          modalidade?: string
          permite_cancelar?: boolean
          permite_remarcar?: boolean
          slug: string
          teto_por_dia?: number | null
          titulo: string
          updated_at?: string
          usa_google_freebusy?: boolean
        }
        Update: {
          antecedencia_max_dias?: number
          antecedencia_min_horas?: number
          ativo?: boolean
          cancelamento_min_horas?: number
          created_at?: string
          descricao?: string | null
          duracao_min?: number
          id?: string
          intervalo_min?: number
          lembrete_horas?: number[]
          link_url?: string | null
          local?: string | null
          max_remarcacoes?: number
          mentor_id?: string
          modalidade?: string
          permite_cancelar?: boolean
          permite_remarcar?: boolean
          slug?: string
          teto_por_dia?: number | null
          titulo?: string
          updated_at?: string
          usa_google_freebusy?: boolean
        }
        Relationships: []
      }
      mentoria_arquivos: {
        Row: {
          caminho: string
          created_at: string
          id: string
          mentor_id: string
          nome: string
          sessao_id: string
          tamanho_bytes: number
          tipo: string
        }
        Insert: {
          caminho: string
          created_at?: string
          id?: string
          mentor_id: string
          nome: string
          sessao_id: string
          tamanho_bytes: number
          tipo: string
        }
        Update: {
          caminho?: string
          created_at?: string
          id?: string
          mentor_id?: string
          nome?: string
          sessao_id?: string
          tamanho_bytes?: number
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "mentoria_arquivos_sessao_id_fkey"
            columns: ["sessao_id"]
            isOneToOne: false
            referencedRelation: "mentoria_sessoes"
            referencedColumns: ["id"]
          },
        ]
      }
      mentoria_tarefas: {
        Row: {
          concluida: boolean
          concluida_em: string | null
          created_at: string
          id: string
          mentor_id: string
          ordem: number
          sessao_id: string
          titulo: string
        }
        Insert: {
          concluida?: boolean
          concluida_em?: string | null
          created_at?: string
          id?: string
          mentor_id: string
          ordem?: number
          sessao_id: string
          titulo: string
        }
        Update: {
          concluida?: boolean
          concluida_em?: string | null
          created_at?: string
          id?: string
          mentor_id?: string
          ordem?: number
          sessao_id?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "mentoria_tarefas_sessao_id_fkey"
            columns: ["sessao_id"]
            isOneToOne: false
            referencedRelation: "mentoria_sessoes"
            referencedColumns: ["id"]
          },
        ]
      }
      lembretes_enviados: {
        Row: {
          destinatario: string
          enviado_em: string
          horas: number
          id: string
          sessao_id: string
        }
        Insert: {
          destinatario: string
          enviado_em?: string
          horas: number
          id?: string
          sessao_id: string
        }
        Update: {
          destinatario?: string
          enviado_em?: string
          horas?: number
          id?: string
          sessao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lembretes_enviados_sessao_id_fkey"
            columns: ["sessao_id"]
            isOneToOne: false
            referencedRelation: "mentoria_sessoes"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_responses: {
        Row: {
          previous_assessment_id: string | null
          canceled_at: string | null
          attempt: number
          expires_at: string | null
          created_at: string
          group_id: string | null
          id: string
          mentor_id: string
          person_id: string
          started_at: string | null
          status: string
          submitted_at: string | null
        }
        Insert: {
          previous_assessment_id?: string | null
          canceled_at?: string | null
          attempt?: number
          expires_at?: string | null
          created_at?: string
          group_id?: string | null
          id?: string
          mentor_id: string
          person_id: string
          started_at?: string | null
          status?: string
          submitted_at?: string | null
        }
        Update: {
          previous_assessment_id?: string | null
          canceled_at?: string | null
          attempt?: number
          expires_at?: string | null
          created_at?: string
          group_id?: string | null
          id?: string
          mentor_id?: string
          person_id?: string
          started_at?: string | null
          status?: string
          submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assessment_responses_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      email_logs: {
        Row: {
          assessment_id: string | null
          created_at: string
          error: string | null
          id: string
          kind: string
          mentor_id: string
          person_id: string | null
          provider_id: string | null
          response_id: string | null
          status: string
          subject: string
          to_email: string
        }
        Insert: {
          assessment_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          kind: string
          mentor_id: string
          person_id?: string | null
          provider_id?: string | null
          response_id?: string | null
          status: string
          subject: string
          to_email: string
        }
        Update: {
          assessment_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          kind?: string
          mentor_id?: string
          person_id?: string | null
          provider_id?: string | null
          response_id?: string | null
          status?: string
          subject?: string
          to_email?: string
        }
        Relationships: []
      }
      export_logs: {
        Row: {
          exported_at: string
          exported_by: string
          formato: string
          id: string
          kind: string
          owner_id: string
          row_count: number
        }
        Insert: {
          exported_at?: string
          exported_by: string
          formato: string
          id?: string
          kind?: string
          owner_id: string
          row_count: number
        }
        Update: {
          exported_at?: string
          exported_by?: string
          formato?: string
          id?: string
          kind?: string
          owner_id?: string
          row_count?: number
        }
        Relationships: []
      }
      group_instruments: {
        Row: {
          added_at: string
          group_id: string
          instrument_id: string
          version_id: string | null
        }
        Insert: {
          added_at?: string
          group_id: string
          instrument_id: string
          version_id?: string | null
        }
        Update: {
          added_at?: string
          group_id?: string
          instrument_id?: string
          version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_instruments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_instruments_instrument_id_fkey"
            columns: ["instrument_id"]
            isOneToOne: false
            referencedRelation: "instruments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_instruments_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "test_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          added_at: string
          group_id: string
          person_id: string
        }
        Insert: {
          added_at?: string
          group_id: string
          person_id: string
        }
        Update: {
          added_at?: string
          group_id?: string
          person_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          areas_aluno: string[] | null
          created_at: string
          description: string | null
          id: string
          mentor_id: string
          name: string
          type: string
          updated_at: string
        }
        Insert: {
          areas_aluno?: string[] | null
          created_at?: string
          description?: string | null
          id?: string
          mentor_id: string
          name: string
          type?: string
          updated_at?: string
        }
        Update: {
          areas_aluno?: string[] | null
          created_at?: string
          description?: string | null
          id?: string
          mentor_id?: string
          name?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      invite_links: {
        Row: {
          created_at: string
          expires_at: string | null
          group_id: string | null
          id: string
          is_active: boolean
          max_responses: number | null
          mentor_id: string
          response_count: number
          title: string | null
          version_ids: string[]
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          group_id?: string | null
          id?: string
          is_active?: boolean
          max_responses?: number | null
          mentor_id: string
          response_count?: number
          title?: string | null
          version_ids: string[]
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          group_id?: string | null
          id?: string
          is_active?: boolean
          max_responses?: number | null
          mentor_id?: string
          response_count?: number
          title?: string | null
          version_ids?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "invite_links_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      instruments: {
        Row: {
          accent: string | null
          category: string
          created_at: string
          description: string | null
          duration_min: number
          id: string
          name: string
          short_name: string
          updated_at: string
        }
        Insert: {
          accent?: string | null
          category: string
          created_at?: string
          description?: string | null
          duration_min?: number
          id: string
          name: string
          short_name: string
          updated_at?: string
        }
        Update: {
          accent?: string | null
          category?: string
          created_at?: string
          description?: string | null
          duration_min?: number
          id?: string
          name?: string
          short_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      mentors: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          owner_id: string
          specialty: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name: string
          owner_id: string
          specialty?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          owner_id?: string
          specialty?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      option_scores: {
        Row: {
          dimension_id: string
          id: string
          option_id: string
          points: number
        }
        Insert: {
          dimension_id: string
          id?: string
          option_id: string
          points?: number
        }
        Update: {
          dimension_id?: string
          id?: string
          option_id?: string
          points?: number
        }
        Relationships: [
          {
            foreignKeyName: "option_scores_dimension_id_fkey"
            columns: ["dimension_id"]
            isOneToOne: false
            referencedRelation: "test_dimensions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "option_scores_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "test_options"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_tracks: {
        Row: {
          audience: string
          cover_url: string | null
          created_at: string
          description: string | null
          id: string
          is_published: boolean
          owner_id: string
          percentual_minimo: number
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          audience?: string
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          owner_id: string
          percentual_minimo?: number
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          audience?: string
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          owner_id?: string
          percentual_minimo?: number
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      learning_track_destinos: {
        Row: {
          created_at: string
          group_id: string | null
          id: string
          person_id: string | null
          track_id: string
        }
        Insert: {
          created_at?: string
          group_id?: string | null
          id?: string
          person_id?: string | null
          track_id: string
        }
        Update: {
          created_at?: string
          group_id?: string | null
          id?: string
          person_id?: string | null
          track_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_track_destinos_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "learning_tracks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_track_destinos_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_track_destinos_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_modules: {
        Row: {
          created_at: string
          description: string | null
          id: string
          parent_id: string | null
          sort_order: number
          title: string
          track_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          parent_id?: string | null
          sort_order?: number
          title: string
          track_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          parent_id?: string | null
          sort_order?: number
          title?: string
          track_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_modules_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "learning_tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_lessons: {
        Row: {
          created_at: string
          description: string | null
          duration_min: number | null
          id: string
          is_published: boolean
          module_id: string
          sort_order: number
          title: string
          track_id: string
          updated_at: string
          video_url: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration_min?: number | null
          id?: string
          is_published?: boolean
          module_id: string
          sort_order?: number
          title: string
          track_id: string
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          duration_min?: number | null
          id?: string
          is_published?: boolean
          module_id?: string
          sort_order?: number
          title?: string
          track_id?: string
          updated_at?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "learning_lessons_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "learning_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_materials: {
        Row: {
          created_at: string
          id: string
          kind: string
          lesson_id: string
          sort_order: number
          title: string
          track_id: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          lesson_id: string
          sort_order?: number
          title: string
          track_id: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          lesson_id?: string
          sort_order?: number
          title?: string
          track_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_materials_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "learning_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_progress: {
        Row: {
          completed_at: string
          id: string
          lesson_id: string
          track_id: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          id?: string
          lesson_id: string
          track_id: string
          user_id: string
        }
        Update: {
          completed_at?: string
          id?: string
          lesson_id?: string
          track_id?: string
          user_id?: string
        }
        Relationships: []
      }
      treinamentos: {
        Row: { id: string; mentor_id: string; titulo: string; descricao: string | null; capa_url: string | null; publicado: boolean; created_at: string; updated_at: string; tolerancia_atraso_min: number; percentual_minimo: number }
        Insert: { id?: string; mentor_id: string; titulo: string; descricao?: string | null; capa_url?: string | null; publicado?: boolean; created_at?: string; updated_at?: string; tolerancia_atraso_min?: number; percentual_minimo?: number }
        Update: { id?: string; mentor_id?: string; titulo?: string; descricao?: string | null; capa_url?: string | null; publicado?: boolean; created_at?: string; updated_at?: string; tolerancia_atraso_min?: number; percentual_minimo?: number }
        Relationships: []
      }
      treinamento_modulos: {
        Row: { id: string; treinamento_id: string; titulo: string; ordem: number }
        Insert: { id?: string; treinamento_id: string; titulo: string; ordem?: number }
        Update: { id?: string; treinamento_id?: string; titulo?: string; ordem?: number }
        Relationships: [
          {
            foreignKeyName: "treinamento_modulos_treinamento_id_fkey"
            columns: ["treinamento_id"]
            isOneToOne: false
            referencedRelation: "treinamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      treinamento_aulas: {
        Row: { id: string; modulo_id: string; titulo: string; descricao: string | null; comeca_em: string | null; termina_em: string | null; local: string | null; ordem: number; fechada_em: string | null; fechada_por: string | null; cancelada: boolean; local_lat: number | null; local_lng: number | null; local_raio_m: number; local_travado_em: string | null }
        Insert: { id?: string; modulo_id: string; titulo: string; descricao?: string | null; comeca_em?: string | null; termina_em?: string | null; local?: string | null; ordem?: number; fechada_em?: string | null; fechada_por?: string | null; cancelada?: boolean; local_lat?: number | null; local_lng?: number | null; local_raio_m?: number; local_travado_em?: string | null }
        Update: { id?: string; modulo_id?: string; titulo?: string; descricao?: string | null; comeca_em?: string | null; termina_em?: string | null; local?: string | null; ordem?: number; fechada_em?: string | null; fechada_por?: string | null; cancelada?: boolean; local_lat?: number | null; local_lng?: number | null; local_raio_m?: number; local_travado_em?: string | null }
        Relationships: [
          {
            foreignKeyName: "treinamento_aulas_modulo_id_fkey"
            columns: ["modulo_id"]
            isOneToOne: false
            referencedRelation: "treinamento_modulos"
            referencedColumns: ["id"]
          },
        ]
      }
      treinamento_anotacoes: {
        Row: { aula_id: string; texto: string; updated_at: string }
        Insert: { aula_id: string; texto: string; updated_at?: string }
        Update: { aula_id?: string; texto?: string; updated_at?: string }
        Relationships: [
          {
            foreignKeyName: "treinamento_anotacoes_aula_id_fkey"
            columns: ["aula_id"]
            isOneToOne: true
            referencedRelation: "treinamento_aulas"
            referencedColumns: ["id"]
          },
        ]
      }
      treinamento_presencas: {
        Row: { id: string; aula_id: string; person_id: string; group_id: string | null; group_nome: string | null; origem: string; escaneado_em: string | null; registrado_em: string; registrado_por: string | null; marcado_por_nome: string | null; observacao: string | null; situacao: string | null; passe_nonce: string | null; distancia_m: number | null }
        Insert: { id?: string; aula_id: string; person_id: string; group_id?: string | null; group_nome?: string | null; origem?: string; escaneado_em?: string | null; registrado_em?: string; registrado_por?: string | null; marcado_por_nome?: string | null; observacao?: string | null; situacao?: string | null; passe_nonce?: string | null; distancia_m?: number | null }
        Update: { id?: string; aula_id?: string; person_id?: string; group_id?: string | null; group_nome?: string | null; origem?: string; escaneado_em?: string | null; registrado_em?: string; registrado_por?: string | null; marcado_por_nome?: string | null; observacao?: string | null; situacao?: string | null; passe_nonce?: string | null; distancia_m?: number | null }
        Relationships: [
          {
            foreignKeyName: "treinamento_presencas_aula_id_fkey"
            columns: ["aula_id"]
            isOneToOne: false
            referencedRelation: "treinamento_aulas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treinamento_presencas_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      treinamento_avaliacoes: {
        Row: { id: string; aula_id: string; person_id: string; conta_id: string; estrelas: number; comentario: string | null; avaliada_em: string }
        Insert: { id?: string; aula_id: string; person_id: string; conta_id: string; estrelas: number; comentario?: string | null; avaliada_em?: string }
        Update: { id?: string; aula_id?: string; person_id?: string; conta_id?: string; estrelas?: number; comentario?: string | null; avaliada_em?: string }
        Relationships: [
          {
            foreignKeyName: "treinamento_avaliacoes_aula_id_fkey"
            columns: ["aula_id"]
            isOneToOne: false
            referencedRelation: "treinamento_aulas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treinamento_avaliacoes_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      treinamento_aula_conclusoes: {
        Row: { id: string; aula_id: string; person_id: string; conta_id: string; concluida_em: string }
        Insert: { id?: string; aula_id: string; person_id: string; conta_id: string; concluida_em?: string }
        Update: { id?: string; aula_id?: string; person_id?: string; conta_id?: string; concluida_em?: string }
        Relationships: [
          {
            foreignKeyName: "treinamento_aula_conclusoes_aula_id_fkey"
            columns: ["aula_id"]
            isOneToOne: false
            referencedRelation: "treinamento_aulas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treinamento_aula_conclusoes_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      treinamento_materiais: {
        Row: { id: string; aula_id: string; titulo: string; url: string; kind: string; ordem: number; created_at: string; visivel_aluno: boolean }
        Insert: { id?: string; aula_id: string; titulo: string; url: string; kind?: string; ordem?: number; created_at?: string; visivel_aluno?: boolean }
        Update: { id?: string; aula_id?: string; titulo?: string; url?: string; kind?: string; ordem?: number; created_at?: string; visivel_aluno?: boolean }
        Relationships: [
          {
            foreignKeyName: "treinamento_materiais_aula_id_fkey"
            columns: ["aula_id"]
            isOneToOne: false
            referencedRelation: "treinamento_aulas"
            referencedColumns: ["id"]
          },
        ]
      }
      treinamento_grupos: {
        Row: { treinamento_id: string; group_id: string }
        Insert: { treinamento_id: string; group_id: string }
        Update: { treinamento_id?: string; group_id?: string }
        Relationships: [
          {
            foreignKeyName: "treinamento_grupos_treinamento_id_fkey"
            columns: ["treinamento_id"]
            isOneToOne: false
            referencedRelation: "treinamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treinamento_grupos_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      people: {
        Row: { perfil_visivel: boolean;
          invite_link_id: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          mentor_id: string
          notes: string | null
          phone: string | null
          profession: string | null
          role: string
          avatar_url: string | null
          role_at_company: string | null
          company_name: string | null
          banner_url: string | null
          linkedin_url: string | null
          instagram_url: string | null
          site_url: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: { perfil_visivel?: boolean;
          invite_link_id?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          mentor_id: string
          notes?: string | null
          phone?: string | null
          profession?: string | null
          role?: string
          avatar_url?: string | null
          role_at_company?: string | null
          company_name?: string | null
          banner_url?: string | null
          linkedin_url?: string | null
          instagram_url?: string | null
          site_url?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: { perfil_visivel?: boolean;
          invite_link_id?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          mentor_id?: string
          notes?: string | null
          phone?: string | null
          profession?: string | null
          role?: string
          avatar_url?: string | null
          role_at_company?: string | null
          company_name?: string | null
          banner_url?: string | null
          linkedin_url?: string | null
          instagram_url?: string | null
          site_url?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: { company_cnpj: string | null; company_seal_name: string | null; company_phone: string | null;
          avatar_url: string | null
          email_from: string | null
          brand_color: string | null
          brand_accent_color: string | null
          invite_message: string | null
          reminder_message: string | null
          report_allow_pdf: boolean
          report_hidden_blocks: string[]
          report_show_brand: boolean
          result_message: string | null
          site_url: string | null
          support_email: string | null
          company_name: string | null
          created_at: string
          full_name: string | null
          logo_url: string | null
          icon_url: string | null
          login_imagem_url: string | null
          login_frase: string | null
          login_rodape: string | null
          updated_at: string
          user_id: string
        }
        Insert: { company_cnpj?: string | null; company_seal_name?: string | null; company_phone?: string | null;
          avatar_url?: string | null
          email_from?: string | null
          brand_color?: string | null
          brand_accent_color?: string | null
          invite_message?: string | null
          reminder_message?: string | null
          report_allow_pdf?: boolean
          report_hidden_blocks?: string[]
          report_show_brand?: boolean
          result_message?: string | null
          site_url?: string | null
          support_email?: string | null
          company_name?: string | null
          created_at?: string
          full_name?: string | null
          logo_url?: string | null
          icon_url?: string | null
          login_imagem_url?: string | null
          login_frase?: string | null
          login_rodape?: string | null
          updated_at?: string
          user_id: string
        }
        Update: { company_cnpj?: string | null; company_seal_name?: string | null; company_phone?: string | null;
          avatar_url?: string | null
          email_from?: string | null
          brand_color?: string | null
          brand_accent_color?: string | null
          invite_message?: string | null
          reminder_message?: string | null
          report_allow_pdf?: boolean
          report_hidden_blocks?: string[]
          report_show_brand?: boolean
          result_message?: string | null
          site_url?: string | null
          support_email?: string | null
          company_name?: string | null
          created_at?: string
          full_name?: string | null
          logo_url?: string | null
          icon_url?: string | null
          login_imagem_url?: string | null
          login_frase?: string | null
          login_rodape?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      dominios_conta: {
        Row: {
          id: string
          dominio: string
          owner_id: string
          padrao: boolean
          created_at: string
        }
        Insert: {
          id?: string
          dominio: string
          owner_id: string
          padrao?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          dominio?: string
          owner_id?: string
          padrao?: boolean
          created_at?: string
        }
        Relationships: []
      }
      report_content: {
        Row: {
          band_max: number | null
          band_min: number | null
          body: string
          created_at: string
          dimension_key: string
          id: string
          mode: string
          section: string
          sort_order: number
          title: string | null
          version_id: string | null
        }
        Insert: {
          band_max?: number | null
          band_min?: number | null
          body: string
          created_at?: string
          dimension_key: string
          id?: string
          mode?: string
          section: string
          sort_order?: number
          title?: string | null
          version_id?: string | null
        }
        Update: {
          band_max?: number | null
          band_min?: number | null
          body?: string
          created_at?: string
          dimension_key?: string
          id?: string
          mode?: string
          section?: string
          sort_order?: number
          title?: string | null
          version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_content_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "test_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          person_id: string | null
          accepted_at: string | null
          created_at: string
          email: string
          id: string
          invite_expires_at: string | null
          invite_token: string
          kind: string
          name: string
          owner_id: string
          permissions: string[]
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          person_id?: string | null
          accepted_at?: string | null
          created_at?: string
          email: string
          id?: string
          invite_expires_at?: string | null
          invite_token?: string
          kind: string
          name: string
          owner_id: string
          permissions?: string[]
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          person_id?: string | null
          accepted_at?: string | null
          created_at?: string
          email?: string
          id?: string
          invite_expires_at?: string | null
          invite_token?: string
          kind?: string
          name?: string
          owner_id?: string
          permissions?: string[]
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      team_member_groups: {
        Row: {
          can_download_reports: boolean
          can_schedule_mentorias: boolean
          created_at: string
          group_id: string
          team_member_id: string
        }
        Insert: {
          can_download_reports?: boolean
          can_schedule_mentorias?: boolean
          created_at?: string
          group_id: string
          team_member_id: string
        }
        Update: {
          can_download_reports?: boolean
          can_schedule_mentorias?: boolean
          created_at?: string
          group_id?: string
          team_member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_member_groups_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_member_groups_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      test_answers: {
        Row: {
          created_at: string
          id: string
          payload: Json
          question_id: string
          response_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          payload?: Json
          question_id: string
          response_id: string
        }
        Update: {
          created_at?: string
          id?: string
          payload?: Json
          question_id?: string
          response_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "test_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_answers_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: false
            referencedRelation: "test_responses"
            referencedColumns: ["id"]
          },
        ]
      }
      test_dimensions: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          id: string
          key: string
          label: string
          sort_order: number
          version_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          key: string
          label: string
          sort_order?: number
          version_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          label?: string
          sort_order?: number
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_dimensions_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "test_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      test_options: {
        Row: {
          created_at: string
          id: string
          label: string
          question_id: string
          sort_order: number
          value: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string
          question_id: string
          sort_order?: number
          value?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          question_id?: string
          sort_order?: number
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "test_options_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "test_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      test_questions: {
        Row: {
          config: Json
          created_at: string
          helper: string | null
          id: string
          prompt: string
          required: boolean
          section_id: string | null
          sort_order: number
          type: Database["public"]["Enums"]["question_type"]
          version_id: string
        }
        Insert: {
          config?: Json
          created_at?: string
          helper?: string | null
          id?: string
          prompt?: string
          required?: boolean
          section_id?: string | null
          sort_order?: number
          type: Database["public"]["Enums"]["question_type"]
          version_id: string
        }
        Update: {
          config?: Json
          created_at?: string
          helper?: string | null
          id?: string
          prompt?: string
          required?: boolean
          section_id?: string | null
          sort_order?: number
          type?: Database["public"]["Enums"]["question_type"]
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_questions_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "test_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_questions_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "test_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      test_sections: {
        Row: {
          created_at: string
          description: string | null
          id: string
          mentor_id: string
          sort_order: number
          title: string
          version_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          mentor_id?: string
          sort_order?: number
          title: string
          version_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          mentor_id?: string
          sort_order?: number
          title?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_sections_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "test_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      test_responses: {
        Row: {
          previous_response_id: string | null
          canceled_at: string | null
          attempt: number
          expires_at: string | null
          assessment_response_id: string | null
          assessment_sort: number
          computed_scores: Json | null
          created_at: string
          dominant_dimension_id: string | null
          group_id: string | null
          id: string
          kind: string
          mentor_id: string
          parent_response_id: string | null
          person_id: string | null
          rater_name: string | null
          result_band_id: string | null
          started_at: string | null
          status: string
          submitted_at: string | null
          updated_at: string
          version_id: string
        }
        Insert: {
          previous_response_id?: string | null
          canceled_at?: string | null
          attempt?: number
          expires_at?: string | null
          assessment_response_id?: string | null
          assessment_sort?: number
          computed_scores?: Json | null
          created_at?: string
          dominant_dimension_id?: string | null
          group_id?: string | null
          id?: string
          kind?: string
          mentor_id: string
          parent_response_id?: string | null
          person_id?: string | null
          rater_name?: string | null
          result_band_id?: string | null
          started_at?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
          version_id: string
        }
        Update: {
          previous_response_id?: string | null
          canceled_at?: string | null
          attempt?: number
          expires_at?: string | null
          assessment_response_id?: string | null
          assessment_sort?: number
          computed_scores?: Json | null
          created_at?: string
          dominant_dimension_id?: string | null
          group_id?: string | null
          id?: string
          kind?: string
          mentor_id?: string
          parent_response_id?: string | null
          person_id?: string | null
          rater_name?: string | null
          result_band_id?: string | null
          started_at?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_responses_assessment_response_id_fkey"
            columns: ["assessment_response_id"]
            isOneToOne: false
            referencedRelation: "assessment_responses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_responses_dominant_dimension_id_fkey"
            columns: ["dominant_dimension_id"]
            isOneToOne: false
            referencedRelation: "test_dimensions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_responses_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_responses_parent_response_id_fkey"
            columns: ["parent_response_id"]
            isOneToOne: false
            referencedRelation: "test_responses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_responses_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_responses_result_band_id_fkey"
            columns: ["result_band_id"]
            isOneToOne: false
            referencedRelation: "test_result_bands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_responses_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "test_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      test_result_bands: {
        Row: {
          created_at: string
          description: string | null
          dimension_id: string | null
          id: string
          max_score: number
          min_score: number
          mode: string
          sort_order: number
          title: string
          version_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          dimension_id?: string | null
          id?: string
          max_score?: number
          min_score?: number
          mode?: string
          sort_order?: number
          title: string
          version_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          dimension_id?: string | null
          id?: string
          max_score?: number
          min_score?: number
          mode?: string
          sort_order?: number
          title?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_result_bands_dimension_id_fkey"
            columns: ["dimension_id"]
            isOneToOne: false
            referencedRelation: "test_dimensions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_result_bands_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "test_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      test_versions: {
        Row: {
          created_at: string
          derived_config: Json | null
          description: string | null
          forked_from_id: string | null
          has_interpretation: boolean
          id: string
          instrument_id: string
          is_anonymous: boolean
          is_published: boolean
          is_template: boolean
          mentor_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          derived_config?: Json | null
          description?: string | null
          forked_from_id?: string | null
          has_interpretation?: boolean
          id?: string
          instrument_id: string
          is_anonymous?: boolean
          is_published?: boolean
          is_template?: boolean
          mentor_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          derived_config?: Json | null
          description?: string | null
          forked_from_id?: string | null
          has_interpretation?: boolean
          id?: string
          instrument_id?: string
          is_anonymous?: boolean
          is_published?: boolean
          is_template?: boolean
          mentor_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_versions_forked_from_id_fkey"
            columns: ["forked_from_id"]
            isOneToOne: false
            referencedRelation: "test_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_versions_instrument_id_fkey"
            columns: ["instrument_id"]
            isOneToOne: false
            referencedRelation: "instruments"
            referencedColumns: ["id"]
          },
        ]
      }
      certificados: {
        Row: {
          codigo: string
          conta_id: string
          emitido_em: string
          id: string
          nome_item: string
          nome_pessoa: string
          percentual_atingido: number
          percentual_exigido: number
          person_id: string
          treinamento_id: string | null
          trilha_id: string | null
        }
        Insert: {
          codigo?: string
          conta_id: string
          emitido_em?: string
          id?: string
          nome_item: string
          nome_pessoa: string
          percentual_atingido: number
          percentual_exigido: number
          person_id: string
          treinamento_id?: string | null
          trilha_id?: string | null
        }
        Update: {
          codigo?: string
          conta_id?: string
          emitido_em?: string
          id?: string
          nome_item?: string
          nome_pessoa?: string
          percentual_atingido?: number
          percentual_exigido?: number
          person_id?: string
          treinamento_id?: string | null
          trilha_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "certificados_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificados_treinamento_id_fkey"
            columns: ["treinamento_id"]
            isOneToOne: false
            referencedRelation: "treinamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificados_trilha_id_fkey"
            columns: ["trilha_id"]
            isOneToOne: false
            referencedRelation: "learning_tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      verificacao_certificado_limite: {
        Row: {
          janela_inicio: string
          origem: string
          tentativas: number
        }
        Insert: {
          janela_inicio?: string
          origem: string
          tentativas?: number
        }
        Update: {
          janela_inicio?: string
          origem?: string
          tentativas?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_team_invite: {
        Args: { _token: string }
        Returns: { id: string; kind: string; owner_id: string }[]
      }
      acting_account: { Args: Record<string, never>; Returns: string }
      promover_a_mentor: { Args: { p_person_id: string }; Returns: string }
      rebaixar_mentor: { Args: { p_person_id: string }; Returns: undefined }
      meus_grupos_como_avaliado: { Args: Record<string, never>; Returns: string[] }
      posso_ver_grupo: { Args: { p_group_id: string }; Returns: boolean }
      posso_ver_treinamento: { Args: { p_trein: string }; Returns: boolean }
      posso_dar_aula: { Args: { p_aula: string }; Returns: boolean }
      nome_do_mentor: { Args: { p_user_id: string }; Returns: string | null }
      claim_student_profile: { Args: Record<string, never>; Returns: number }
      claim_team_membership: { Args: Record<string, never>; Returns: number }
      update_my_person: {
        Args: {
          _full_name: string; _phone?: string | null; _avatar_url?: string | null
          _company_name?: string | null; _banner_url?: string | null
          _linkedin_url?: string | null; _instagram_url?: string | null; _site_url?: string | null
        }
        Returns: number
      }
      posso_agendar_mentoria: { Args: { p_person_id: string }; Returns: boolean }
      marcar_tarefa_mentoria: {
        Args: { _tarefa_id: string; _concluida: boolean }
        Returns: undefined
      }
      avaliar_sessao_mentoria: {
        Args: { _sessao_id: string; _estrelas: number; _comentario: string | null }
        Returns: undefined
      }
      avaliar_aula: {
        Args: { _aula_id: string; _estrelas: number; _comentario: string | null }
        Returns: undefined
      }
      marcar_conclusao_aula: {
        Args: { _aula_id: string }
        Returns: undefined
      }
      desmarcar_conclusao_aula: {
        Args: { _aula_id: string }
        Returns: undefined
      }
      can_see_track: { Args: { _track_id: string }; Returns: boolean }
      can_edit_track: { Args: { _track_id: string }; Returns: boolean }
      track_liberada: { Args: { _track_id: string }; Returns: boolean }
      aluno_pode: { Args: { p_area: string }; Returns: boolean }
      bib_pasta_liberada: { Args: { _pasta_id: string }; Returns: boolean }
      bib_material_liberado: { Args: { _material_id: string }; Returns: boolean }
      bib_pastas_liberadas: { Args: { _person_id?: string | null }; Returns: string[] }
      bib_materiais_liberados: { Args: { _person_id?: string | null }; Returns: string[] }
      minhas_areas: { Args: Record<string, never>; Returns: string[] }
      areas_da_pessoa: { Args: { p_person_id: string }; Returns: string[] }
      trilhas_liberadas: { Args: { _person_id?: string | null }; Returns: string[] }
      member_kind: { Args: Record<string, never>; Returns: string }
      claim_invite_link: {
        Args: { link_id: string }
        Returns: Database["public"]["Tables"]["invite_links"]["Row"][]
      }
      option_version_id: { Args: { _option_id: string }; Returns: string }
      owns_test_version: { Args: { _version_id: string }; Returns: boolean }
      question_version_id: { Args: { _question_id: string }; Returns: string }
      response_mentor_id: { Args: { _response_id: string }; Returns: string }
      test_version_is_template: {
        Args: { _version_id: string }
        Returns: boolean
      }
    }
    Enums: {
      question_type:
        | "multiple_choice"
        | "checkboxes"
        | "linear_scale"
        | "ranking"
        | "drag_order"
        | "forced_choice"
        | "short_text"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      question_type: [
        "multiple_choice",
        "checkboxes",
        "linear_scale",
        "ranking",
        "drag_order",
        "forced_choice",
        "short_text",
      ],
    },
  },
} as const
