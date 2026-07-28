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
      community_posts: {
        Row: { id: string; group_id: string; author_id: string; author_name: string; body: string; file_url: string | null; file_kind: string | null; link_url: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; group_id: string; author_id: string; author_name: string; body: string; file_url?: string | null; file_kind?: string | null; link_url?: string | null; created_at?: string; updated_at?: string }
        Update: { id?: string; group_id?: string; author_id?: string; author_name?: string; body?: string; file_url?: string | null; file_kind?: string | null; link_url?: string | null; created_at?: string; updated_at?: string }
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
      devolutivas: {
        Row: {
          agreements: string | null
          assessment_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          duration_min: number | null
          id: string
          mentor_id: string
          next_at: string | null
          notes: string | null
          person_id: string
          response_id: string | null
          scheduled_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          agreements?: string | null
          assessment_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          duration_min?: number | null
          id?: string
          mentor_id: string
          next_at?: string | null
          notes?: string | null
          person_id: string
          response_id?: string | null
          scheduled_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          agreements?: string | null
          assessment_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          duration_min?: number | null
          id?: string
          mentor_id?: string
          next_at?: string | null
          notes?: string | null
          person_id?: string
          response_id?: string | null
          scheduled_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "devolutivas_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devolutivas_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: false
            referencedRelation: "test_responses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devolutivas_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessment_responses"
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
          created_at: string
          description: string | null
          id: string
          mentor_id: string
          name: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          mentor_id: string
          name: string
          type?: string
          updated_at?: string
        }
        Update: {
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
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
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
      people: {
        Row: {
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
          updated_at: string
          user_id: string | null
        }
        Insert: {
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
          updated_at?: string
          user_id?: string | null
        }
        Update: {
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
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
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
          updated_at: string
          user_id: string
        }
        Insert: {
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
          updated_at?: string
          user_id: string
        }
        Update: {
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
          updated_at?: string
          user_id?: string
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
          created_at: string
          group_id: string
          team_member_id: string
        }
        Insert: {
          can_download_reports?: boolean
          created_at?: string
          group_id: string
          team_member_id: string
        }
        Update: {
          can_download_reports?: boolean
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
          sort_order?: number
          type?: Database["public"]["Enums"]["question_type"]
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_questions_version_id_fkey"
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
          person_id: string
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
          person_id: string
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
          person_id?: string
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
          id: string
          instrument_id: string
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
          id?: string
          instrument_id: string
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
          id?: string
          instrument_id?: string
          is_published?: boolean
          is_template?: boolean
          mentor_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_versions_instrument_id_fkey"
            columns: ["instrument_id"]
            isOneToOne: false
            referencedRelation: "instruments"
            referencedColumns: ["id"]
          },
        ]
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
      meus_grupos_como_avaliado: { Args: Record<string, never>; Returns: string[] }
      posso_ver_grupo: { Args: { p_group_id: string }; Returns: boolean }
      nome_do_mentor: { Args: { p_user_id: string }; Returns: string | null }
      claim_student_profile: { Args: Record<string, never>; Returns: number }
      update_my_person: {
        Args: { _full_name: string; _phone?: string | null; _avatar_url?: string | null }
        Returns: number
      }
      can_see_track: { Args: { _track_id: string }; Returns: boolean }
      can_edit_track: { Args: { _track_id: string }; Returns: boolean }
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
      ],
    },
  },
} as const
