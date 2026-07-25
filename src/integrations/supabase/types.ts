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
      assessment_responses: {
        Row: {
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
      people: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          mentor_id: string
          notes: string | null
          phone: string | null
          profession: string | null
          role: string
          role_at_company: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id?: string
          mentor_id: string
          notes?: string | null
          phone?: string | null
          profession?: string | null
          role?: string
          role_at_company?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          mentor_id?: string
          notes?: string | null
          phone?: string | null
          profession?: string | null
          role?: string
          role_at_company?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          brand_color: string | null
          company_name: string | null
          created_at: string
          full_name: string | null
          logo_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          brand_color?: string | null
          company_name?: string | null
          created_at?: string
          full_name?: string | null
          logo_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          brand_color?: string | null
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
