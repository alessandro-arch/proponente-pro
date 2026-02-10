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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          created_at: string
          entity: string
          entity_id: string | null
          id: string
          metadata_json: Json | null
          organization_id: string | null
          user_id: string | null
          user_role: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: string
          metadata_json?: Json | null
          organization_id?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
          metadata_json?: Json | null
          organization_id?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      cnpq_areas: {
        Row: {
          code: string
          full_path: string
          level: number
          name: string
          parent_code: string | null
        }
        Insert: {
          code: string
          full_path: string
          level: number
          name: string
          parent_code?: string | null
        }
        Update: {
          code?: string
          full_path?: string
          level?: number
          name?: string
          parent_code?: string | null
        }
        Relationships: []
      }
      editais: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          end_date: string | null
          id: string
          min_reviewers_per_proposal: number | null
          organization_id: string
          review_deadline: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["edital_status"]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          end_date?: string | null
          id?: string
          min_reviewers_per_proposal?: number | null
          organization_id: string
          review_deadline?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["edital_status"]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          end_date?: string | null
          id?: string
          min_reviewers_per_proposal?: number | null
          organization_id?: string
          review_deadline?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["edital_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "editais_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      edital_areas: {
        Row: {
          edital_id: string
          id: string
          knowledge_area_id: string
        }
        Insert: {
          edital_id: string
          id?: string
          knowledge_area_id: string
        }
        Update: {
          edital_id?: string
          id?: string
          knowledge_area_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "edital_areas_edital_id_fkey"
            columns: ["edital_id"]
            isOneToOne: false
            referencedRelation: "editais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edital_areas_knowledge_area_id_fkey"
            columns: ["knowledge_area_id"]
            isOneToOne: false
            referencedRelation: "knowledge_areas"
            referencedColumns: ["id"]
          },
        ]
      }
      edital_form_schemas: {
        Row: {
          created_at: string
          edital_id: string
          id: string
          is_active: boolean
          schema_json: Json
          version: number
        }
        Insert: {
          created_at?: string
          edital_id: string
          id?: string
          is_active?: boolean
          schema_json?: Json
          version?: number
        }
        Update: {
          created_at?: string
          edital_id?: string
          id?: string
          is_active?: boolean
          schema_json?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "edital_form_schemas_edital_id_fkey"
            columns: ["edital_id"]
            isOneToOne: false
            referencedRelation: "editais"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_areas: {
        Row: {
          created_at: string
          id: string
          name: string
          organization_id: string
          parent_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          organization_id: string
          parent_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_areas_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_areas_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "knowledge_areas"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address_city: string | null
          address_complement: string | null
          address_country: string | null
          address_neighborhood: string | null
          address_number: string | null
          address_state: string | null
          address_street: string | null
          address_zipcode: string | null
          cpf: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          instagram_url: string | null
          institution_affiliation: string | null
          keywords: string[] | null
          lattes_url: string | null
          linkedin_url: string | null
          mini_bio: string | null
          phone: string | null
          photo_url: string | null
          professional_position: string | null
          profile_completed: boolean | null
          profile_completed_at: string | null
          receive_editais_notifications: boolean | null
          receive_news: boolean | null
          research_area_cnpq: string | null
          updated_at: string
          user_id: string
          whatsapp: string | null
        }
        Insert: {
          address_city?: string | null
          address_complement?: string | null
          address_country?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zipcode?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          instagram_url?: string | null
          institution_affiliation?: string | null
          keywords?: string[] | null
          lattes_url?: string | null
          linkedin_url?: string | null
          mini_bio?: string | null
          phone?: string | null
          photo_url?: string | null
          professional_position?: string | null
          profile_completed?: boolean | null
          profile_completed_at?: string | null
          receive_editais_notifications?: boolean | null
          receive_news?: boolean | null
          research_area_cnpq?: string | null
          updated_at?: string
          user_id: string
          whatsapp?: string | null
        }
        Update: {
          address_city?: string | null
          address_complement?: string | null
          address_country?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zipcode?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          instagram_url?: string | null
          institution_affiliation?: string | null
          keywords?: string[] | null
          lattes_url?: string | null
          linkedin_url?: string | null
          mini_bio?: string | null
          phone?: string | null
          photo_url?: string | null
          professional_position?: string | null
          profile_completed?: boolean | null
          profile_completed_at?: string | null
          receive_editais_notifications?: boolean | null
          receive_news?: boolean | null
          research_area_cnpq?: string | null
          updated_at?: string
          user_id?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      proposal_answers: {
        Row: {
          answers_json: Json
          id: string
          proposal_id: string
          updated_at: string
        }
        Insert: {
          answers_json?: Json
          id?: string
          proposal_id: string
          updated_at?: string
        }
        Update: {
          answers_json?: Json
          id?: string
          proposal_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposal_answers_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: true
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_decisions: {
        Row: {
          decided_at: string
          decided_by: string
          decision: string
          id: string
          justification: string | null
          proposal_id: string
        }
        Insert: {
          decided_at?: string
          decided_by: string
          decision: string
          id?: string
          justification?: string | null
          proposal_id: string
        }
        Update: {
          decided_at?: string
          decided_by?: string
          decision?: string
          id?: string
          justification?: string | null
          proposal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposal_decisions_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: true
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_files: {
        Row: {
          file_path: string
          file_type: string | null
          id: string
          proposal_id: string
          uploaded_at: string
        }
        Insert: {
          file_path: string
          file_type?: string | null
          id?: string
          proposal_id: string
          uploaded_at?: string
        }
        Update: {
          file_path?: string
          file_type?: string | null
          id?: string
          proposal_id?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposal_files_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposals: {
        Row: {
          created_at: string
          edital_id: string
          id: string
          knowledge_area_id: string | null
          organization_id: string
          proponente_user_id: string
          status: Database["public"]["Enums"]["proposal_status"]
          submitted_at: string | null
        }
        Insert: {
          created_at?: string
          edital_id: string
          id?: string
          knowledge_area_id?: string | null
          organization_id: string
          proponente_user_id: string
          status?: Database["public"]["Enums"]["proposal_status"]
          submitted_at?: string | null
        }
        Update: {
          created_at?: string
          edital_id?: string
          id?: string
          knowledge_area_id?: string | null
          organization_id?: string
          proponente_user_id?: string
          status?: Database["public"]["Enums"]["proposal_status"]
          submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposals_edital_id_fkey"
            columns: ["edital_id"]
            isOneToOne: false
            referencedRelation: "editais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_knowledge_area_id_fkey"
            columns: ["knowledge_area_id"]
            isOneToOne: false
            referencedRelation: "knowledge_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      review_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string
          id: string
          proposal_id: string
          reviewer_user_id: string
          status: string
          submitted_at: string | null
        }
        Insert: {
          assigned_at?: string
          assigned_by: string
          id?: string
          proposal_id: string
          reviewer_user_id: string
          status?: string
          submitted_at?: string | null
        }
        Update: {
          assigned_at?: string
          assigned_by?: string
          id?: string
          proposal_id?: string
          reviewer_user_id?: string
          status?: string
          submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "review_assignments_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      review_scores: {
        Row: {
          comment: string | null
          criteria_id: string
          id: string
          review_id: string
          score: number
        }
        Insert: {
          comment?: string | null
          criteria_id: string
          id?: string
          review_id: string
          score: number
        }
        Update: {
          comment?: string | null
          criteria_id?: string
          id?: string
          review_id?: string
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "review_scores_criteria_id_fkey"
            columns: ["criteria_id"]
            isOneToOne: false
            referencedRelation: "scoring_criteria"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_scores_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          assignment_id: string
          comments_to_committee: string | null
          created_at: string
          id: string
          overall_score: number | null
          proposal_id: string
          recommendation: string | null
          reviewer_user_id: string
          submitted_at: string | null
        }
        Insert: {
          assignment_id: string
          comments_to_committee?: string | null
          created_at?: string
          id?: string
          overall_score?: number | null
          proposal_id: string
          recommendation?: string | null
          reviewer_user_id: string
          submitted_at?: string | null
        }
        Update: {
          assignment_id?: string
          comments_to_committee?: string | null
          created_at?: string
          id?: string
          overall_score?: number | null
          proposal_id?: string
          recommendation?: string | null
          reviewer_user_id?: string
          submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: true
            referencedRelation: "review_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      scoring_criteria: {
        Row: {
          created_at: string
          description: string | null
          edital_id: string
          id: string
          max_score: number
          name: string
          sort_order: number
          weight: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          edital_id: string
          id?: string
          max_score?: number
          name: string
          sort_order?: number
          weight?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          edital_id?: string
          id?: string
          max_score?: number
          name?: string
          sort_order?: number
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "scoring_criteria_edital_id_fkey"
            columns: ["edital_id"]
            isOneToOne: false
            referencedRelation: "editais"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      ensure_default_membership: { Args: never; Returns: undefined }
      get_user_org_id: { Args: { _user_id: string }; Returns: string }
      get_user_org_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_org_role: {
        Args: {
          _org_id: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_org_member: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      app_role:
        | "icca_admin"
        | "org_admin"
        | "edital_manager"
        | "proponente"
        | "reviewer"
      edital_status: "draft" | "published" | "closed"
      proposal_status:
        | "draft"
        | "submitted"
        | "under_review"
        | "accepted"
        | "rejected"
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
      app_role: [
        "icca_admin",
        "org_admin",
        "edital_manager",
        "proponente",
        "reviewer",
      ],
      edital_status: ["draft", "published", "closed"],
      proposal_status: [
        "draft",
        "submitted",
        "under_review",
        "accepted",
        "rejected",
      ],
    },
  },
} as const
