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
      action_items: {
        Row: {
          content: string
          created_at: string
          document_id: string | null
          done: boolean
          due_on: string | null
          id: string
          notes: string | null
          person_id: string
          visit_id: string | null
        }
        Insert: {
          content: string
          created_at?: string
          document_id?: string | null
          done?: boolean
          due_on?: string | null
          id?: string
          notes?: string | null
          person_id: string
          visit_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          document_id?: string | null
          done?: boolean
          due_on?: string | null
          id?: string
          notes?: string | null
          person_id?: string
          visit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "action_items_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_items_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_items_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_memories: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          id: string
          person_id: string | null
          source_thread_id: string | null
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          person_id?: string | null
          source_thread_id?: string | null
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          person_id?: string | null
          source_thread_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_memories_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_memories_source_thread_id_fkey"
            columns: ["source_thread_id"]
            isOneToOne: false
            referencedRelation: "chat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_summaries: {
        Row: {
          content: string
          generated_at: string
          id: string
          input_snapshot: Json | null
          person_id: string
        }
        Insert: {
          content: string
          generated_at?: string
          id?: string
          input_snapshot?: Json | null
          person_id: string
        }
        Update: {
          content?: string
          generated_at?: string
          id?: string
          input_snapshot?: Json | null
          person_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_summaries_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      cases: {
        Row: {
          created_at: string
          ended_on: string | null
          id: string
          notes: string | null
          person_id: string
          started_on: string | null
          status: string
          title: string
        }
        Insert: {
          created_at?: string
          ended_on?: string | null
          id?: string
          notes?: string | null
          person_id: string
          started_on?: string | null
          status?: string
          title: string
        }
        Update: {
          created_at?: string
          ended_on?: string | null
          id?: string
          notes?: string | null
          person_id?: string
          started_on?: string | null
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "cases_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          created_at: string
          id: string
          parts: Json
          role: string
          seq: number
          thread_id: string
        }
        Insert: {
          created_at?: string
          id: string
          parts: Json
          role: string
          seq?: never
          thread_id: string
        }
        Update: {
          created_at?: string
          id?: string
          parts?: Json
          role?: string
          seq?: never
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "chat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_threads: {
        Row: {
          created_at: string
          created_by: string
          id: string
          summarized_count: number
          summary: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          id: string
          summarized_count?: number
          summary?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          summarized_count?: number
          summary?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      document_files: {
        Row: {
          created_at: string
          document_id: string
          file_name: string
          id: string
          mime_type: string | null
          page_no: number
          sha256: string
          size_bytes: number | null
          storage_path: string
        }
        Insert: {
          created_at?: string
          document_id: string
          file_name: string
          id?: string
          mime_type?: string | null
          page_no?: number
          sha256: string
          size_bytes?: number | null
          storage_path: string
        }
        Update: {
          created_at?: string
          document_id?: string
          file_name?: string
          id?: string
          mime_type?: string | null
          page_no?: number
          sha256?: string
          size_bytes?: number | null
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_files_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          doc_type: string
          extracted_at: string | null
          extraction_error: string | null
          extraction_status: string
          id: string
          raw_ai_json: Json | null
          reviewed_json: Json | null
          summary: string | null
          title: string | null
          uploaded_by: string | null
          visit_id: string
        }
        Insert: {
          created_at?: string
          doc_type?: string
          extracted_at?: string | null
          extraction_error?: string | null
          extraction_status?: string
          id?: string
          raw_ai_json?: Json | null
          reviewed_json?: Json | null
          summary?: string | null
          title?: string | null
          uploaded_by?: string | null
          visit_id: string
        }
        Update: {
          created_at?: string
          doc_type?: string
          extracted_at?: string | null
          extraction_error?: string | null
          extraction_status?: string
          id?: string
          raw_ai_json?: Json | null
          reviewed_json?: Json | null
          summary?: string | null
          title?: string | null
          uploaded_by?: string | null
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      inbox_files: {
        Row: {
          created_at: string
          file_name: string
          id: string
          inbox_item_id: string
          mime_type: string | null
          page_no: number
          sha256: string
          size_bytes: number | null
          storage_path: string
        }
        Insert: {
          created_at?: string
          file_name: string
          id?: string
          inbox_item_id: string
          mime_type?: string | null
          page_no?: number
          sha256: string
          size_bytes?: number | null
          storage_path: string
        }
        Update: {
          created_at?: string
          file_name?: string
          id?: string
          inbox_item_id?: string
          mime_type?: string | null
          page_no?: number
          sha256?: string
          size_bytes?: number | null
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "inbox_files_inbox_item_id_fkey"
            columns: ["inbox_item_id"]
            isOneToOne: false
            referencedRelation: "inbox_items"
            referencedColumns: ["id"]
          },
        ]
      }
      inbox_items: {
        Row: {
          created_at: string
          error: string | null
          extraction: Json | null
          id: string
          status: string
          suggested_case_id: string | null
          suggested_is_new_case: boolean
          suggested_new_case_title: string | null
          suggested_person_id: string | null
          suggested_visit_id: string | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          error?: string | null
          extraction?: Json | null
          id?: string
          status?: string
          suggested_case_id?: string | null
          suggested_is_new_case?: boolean
          suggested_new_case_title?: string | null
          suggested_person_id?: string | null
          suggested_visit_id?: string | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          error?: string | null
          extraction?: Json | null
          id?: string
          status?: string
          suggested_case_id?: string | null
          suggested_is_new_case?: boolean
          suggested_new_case_title?: string | null
          suggested_person_id?: string | null
          suggested_visit_id?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inbox_items_suggested_case_id_fkey"
            columns: ["suggested_case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbox_items_suggested_person_id_fkey"
            columns: ["suggested_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbox_items_suggested_visit_id_fkey"
            columns: ["suggested_visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      medications: {
        Row: {
          created_at: string
          document_id: string | null
          dose: string | null
          duration_days: number | null
          id: string
          name: string
          notes: string | null
          schedule: string | null
          visit_id: string
        }
        Insert: {
          created_at?: string
          document_id?: string | null
          dose?: string | null
          duration_days?: number | null
          id?: string
          name: string
          notes?: string | null
          schedule?: string | null
          visit_id: string
        }
        Update: {
          created_at?: string
          document_id?: string | null
          dose?: string | null
          duration_days?: number | null
          id?: string
          name?: string
          notes?: string | null
          schedule?: string | null
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "medications_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medications_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          display_name: string
          user_id: string
        }
        Insert: {
          display_name: string
          user_id: string
        }
        Update: {
          display_name?: string
          user_id?: string
        }
        Relationships: []
      }
      observations: {
        Row: {
          created_at: string
          document_id: string | null
          flag: string | null
          id: string
          raw_name: string
          raw_unit: string | null
          raw_value: string | null
          ref_high: number | null
          ref_low: number | null
          ref_range_text: string | null
          test_code: string | null
          unit: string | null
          value: number | null
          value_text: string | null
          visit_id: string
        }
        Insert: {
          created_at?: string
          document_id?: string | null
          flag?: string | null
          id?: string
          raw_name: string
          raw_unit?: string | null
          raw_value?: string | null
          ref_high?: number | null
          ref_low?: number | null
          ref_range_text?: string | null
          test_code?: string | null
          unit?: string | null
          value?: number | null
          value_text?: string | null
          visit_id: string
        }
        Update: {
          created_at?: string
          document_id?: string | null
          flag?: string | null
          id?: string
          raw_name?: string
          raw_unit?: string | null
          raw_value?: string | null
          ref_high?: number | null
          ref_low?: number | null
          ref_range_text?: string | null
          test_code?: string | null
          unit?: string | null
          value?: number | null
          value_text?: string | null
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "observations_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "observations_test_code_fkey"
            columns: ["test_code"]
            isOneToOne: false
            referencedRelation: "test_catalog"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "observations_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      people: {
        Row: {
          allergies: string | null
          birth_date: string | null
          blood_type: string | null
          chronic_conditions: string | null
          created_at: string
          full_name: string
          id: string
          notes: string | null
          sex: string | null
        }
        Insert: {
          allergies?: string | null
          birth_date?: string | null
          blood_type?: string | null
          chronic_conditions?: string | null
          created_at?: string
          full_name: string
          id?: string
          notes?: string | null
          sex?: string | null
        }
        Update: {
          allergies?: string | null
          birth_date?: string | null
          blood_type?: string | null
          chronic_conditions?: string | null
          created_at?: string
          full_name?: string
          id?: string
          notes?: string | null
          sex?: string | null
        }
        Relationships: []
      }
      test_catalog: {
        Row: {
          aliases: string[]
          category: string | null
          code: string
          name_vi: string
          search_terms: string[]
          standard_unit: string | null
        }
        Insert: {
          aliases?: string[]
          category?: string | null
          code: string
          name_vi: string
          search_terms?: string[]
          standard_unit?: string | null
        }
        Update: {
          aliases?: string[]
          category?: string | null
          code?: string
          name_vi?: string
          search_terms?: string[]
          standard_unit?: string | null
        }
        Relationships: []
      }
      unit_conversions: {
        Row: {
          factor: number
          from_unit: string
          test_code: string
        }
        Insert: {
          factor: number
          from_unit: string
          test_code: string
        }
        Update: {
          factor?: number
          from_unit?: string
          test_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "unit_conversions_test_code_fkey"
            columns: ["test_code"]
            isOneToOne: false
            referencedRelation: "test_catalog"
            referencedColumns: ["code"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string
          email_verified: boolean | null
          emailVerified: string | null
          id: string
          image: string | null
          last_sign_in_at: string | null
          name: string
          provider: string | null
          provider_id: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email: string
          email_verified?: boolean | null
          emailVerified?: string | null
          id?: string
          image?: string | null
          last_sign_in_at?: string | null
          name: string
          provider?: string | null
          provider_id?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          email_verified?: boolean | null
          emailVerified?: string | null
          id?: string
          image?: string | null
          last_sign_in_at?: string | null
          name?: string
          provider?: string | null
          provider_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      vaccinations: {
        Row: {
          created_at: string
          disease: string | null
          document_id: string | null
          dose_label: string | null
          facility: string | null
          given_on: string | null
          id: string
          lot_number: string | null
          next_due_on: string | null
          notes: string | null
          person_id: string
          typically_single_dose: boolean | null
          vaccine_name: string
          visit_id: string | null
        }
        Insert: {
          created_at?: string
          disease?: string | null
          document_id?: string | null
          dose_label?: string | null
          facility?: string | null
          given_on?: string | null
          id?: string
          lot_number?: string | null
          next_due_on?: string | null
          notes?: string | null
          person_id: string
          typically_single_dose?: boolean | null
          vaccine_name: string
          visit_id?: string | null
        }
        Update: {
          created_at?: string
          disease?: string | null
          document_id?: string | null
          dose_label?: string | null
          facility?: string | null
          given_on?: string | null
          id?: string
          lot_number?: string | null
          next_due_on?: string | null
          notes?: string | null
          person_id?: string
          typically_single_dose?: boolean | null
          vaccine_name?: string
          visit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vaccinations_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vaccinations_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vaccinations_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      visits: {
        Row: {
          case_id: string | null
          created_at: string
          department: string | null
          doctor: string | null
          facility: string | null
          id: string
          notes: string | null
          person_id: string
          reason: string | null
          visit_date: string | null
        }
        Insert: {
          case_id?: string | null
          created_at?: string
          department?: string | null
          doctor?: string | null
          facility?: string | null
          id?: string
          notes?: string | null
          person_id: string
          reason?: string | null
          visit_date?: string | null
        }
        Update: {
          case_id?: string | null
          created_at?: string
          department?: string | null
          doctor?: string | null
          facility?: string | null
          id?: string
          notes?: string | null
          person_id?: string
          reason?: string | null
          visit_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visits_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      search_records: {
        Args: { q: string }
        Returns: {
          detail: string | null
          happened_on: string | null
          id: string
          kind: string
          person_id: string
          person_name: string
          tag: string | null
          title: string | null
          visit_id: string | null
          approximate: boolean
        }[]
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
