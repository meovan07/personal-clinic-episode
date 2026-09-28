
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "action_items": {
                  Row: {
                    "content": string,"created_at": string,"document_id": string | null,"done": boolean,"due_on": string | null,"id": string,"person_id": string,"visit_id": string | null
                  }
                  Insert: {
                    "content": string,"created_at"?: string,"document_id"?: string | null,"done"?: boolean,"due_on"?: string | null,"id"?: string,"person_id": string,"visit_id"?: string | null
                  }
                  Update: {
                    "content"?: string,"created_at"?: string,"document_id"?: string | null,"done"?: boolean,"due_on"?: string | null,"id"?: string,"person_id"?: string,"visit_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "action_items_document_id_fkey"
      columns: ["document_id"]
isOneToOne: false
      referencedRelation: "documents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "action_items_person_id_fkey"
      columns: ["person_id"]
isOneToOne: false
      referencedRelation: "people"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "action_items_visit_id_fkey"
      columns: ["visit_id"]
isOneToOne: false
      referencedRelation: "visits"
      referencedColumns: ["id"]
    }
                  ]
                },"ai_summaries": {
                  Row: {
                    "content": string,"generated_at": string,"id": string,"input_snapshot": Json | null,"person_id": string
                  }
                  Insert: {
                    "content": string,"generated_at"?: string,"id"?: string,"input_snapshot"?: Json | null,"person_id": string
                  }
                  Update: {
                    "content"?: string,"generated_at"?: string,"id"?: string,"input_snapshot"?: Json | null,"person_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_summaries_person_id_fkey"
      columns: ["person_id"]
isOneToOne: false
      referencedRelation: "people"
      referencedColumns: ["id"]
    }
                  ]
                },"cases": {
                  Row: {
                    "created_at": string,"ended_on": string | null,"id": string,"notes": string | null,"person_id": string,"started_on": string | null,"status": string,"title": string
                  }
                  Insert: {
                    "created_at"?: string,"ended_on"?: string | null,"id"?: string,"notes"?: string | null,"person_id": string,"started_on"?: string | null,"status"?: string,"title": string
                  }
                  Update: {
                    "created_at"?: string,"ended_on"?: string | null,"id"?: string,"notes"?: string | null,"person_id"?: string,"started_on"?: string | null,"status"?: string,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "cases_person_id_fkey"
      columns: ["person_id"]
isOneToOne: false
      referencedRelation: "people"
      referencedColumns: ["id"]
    }
                  ]
                },"document_files": {
                  Row: {
                    "created_at": string,"document_id": string,"file_name": string,"id": string,"mime_type": string | null,"page_no": number,"sha256": string,"size_bytes": number | null,"storage_path": string
                  }
                  Insert: {
                    "created_at"?: string,"document_id": string,"file_name": string,"id"?: string,"mime_type"?: string | null,"page_no"?: number,"sha256": string,"size_bytes"?: number | null,"storage_path": string
                  }
                  Update: {
                    "created_at"?: string,"document_id"?: string,"file_name"?: string,"id"?: string,"mime_type"?: string | null,"page_no"?: number,"sha256"?: string,"size_bytes"?: number | null,"storage_path"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "document_files_document_id_fkey"
      columns: ["document_id"]
isOneToOne: false
      referencedRelation: "documents"
      referencedColumns: ["id"]
    }
                  ]
                },"documents": {
                  Row: {
                    "created_at": string,"doc_type": string,"extracted_at": string | null,"extraction_error": string | null,"extraction_status": string,"id": string,"raw_ai_json": Json | null,"reviewed_json": Json | null,"summary": string | null,"title": string | null,"uploaded_by": string | null,"visit_id": string
                  }
                  Insert: {
                    "created_at"?: string,"doc_type"?: string,"extracted_at"?: string | null,"extraction_error"?: string | null,"extraction_status"?: string,"id"?: string,"raw_ai_json"?: Json | null,"reviewed_json"?: Json | null,"summary"?: string | null,"title"?: string | null,"uploaded_by"?: string | null,"visit_id": string
                  }
                  Update: {
                    "created_at"?: string,"doc_type"?: string,"extracted_at"?: string | null,"extraction_error"?: string | null,"extraction_status"?: string,"id"?: string,"raw_ai_json"?: Json | null,"reviewed_json"?: Json | null,"summary"?: string | null,"title"?: string | null,"uploaded_by"?: string | null,"visit_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "documents_visit_id_fkey"
      columns: ["visit_id"]
isOneToOne: false
      referencedRelation: "visits"
      referencedColumns: ["id"]
    }
                  ]
                },"medications": {
                  Row: {
                    "created_at": string,"document_id": string | null,"dose": string | null,"duration_days": number | null,"id": string,"name": string,"notes": string | null,"schedule": string | null,"visit_id": string
                  }
                  Insert: {
                    "created_at"?: string,"document_id"?: string | null,"dose"?: string | null,"duration_days"?: number | null,"id"?: string,"name": string,"notes"?: string | null,"schedule"?: string | null,"visit_id": string
                  }
                  Update: {
                    "created_at"?: string,"document_id"?: string | null,"dose"?: string | null,"duration_days"?: number | null,"id"?: string,"name"?: string,"notes"?: string | null,"schedule"?: string | null,"visit_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "medications_document_id_fkey"
      columns: ["document_id"]
isOneToOne: false
      referencedRelation: "documents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "medications_visit_id_fkey"
      columns: ["visit_id"]
isOneToOne: false
      referencedRelation: "visits"
      referencedColumns: ["id"]
    }
                  ]
                },"members": {
                  Row: {
                    "display_name": string,"user_id": string
                  }
                  Insert: {
                    "display_name": string,"user_id": string
                  }
                  Update: {
                    "display_name"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"observations": {
                  Row: {
                    "created_at": string,"document_id": string | null,"flag": string | null,"id": string,"raw_name": string,"raw_unit": string | null,"raw_value": string | null,"ref_high": number | null,"ref_low": number | null,"ref_range_text": string | null,"test_code": string | null,"unit": string | null,"value": number | null,"value_text": string | null,"visit_id": string
                  }
                  Insert: {
                    "created_at"?: string,"document_id"?: string | null,"flag"?: string | null,"id"?: string,"raw_name": string,"raw_unit"?: string | null,"raw_value"?: string | null,"ref_high"?: number | null,"ref_low"?: number | null,"ref_range_text"?: string | null,"test_code"?: string | null,"unit"?: string | null,"value"?: number | null,"value_text"?: string | null,"visit_id": string
                  }
                  Update: {
                    "created_at"?: string,"document_id"?: string | null,"flag"?: string | null,"id"?: string,"raw_name"?: string,"raw_unit"?: string | null,"raw_value"?: string | null,"ref_high"?: number | null,"ref_low"?: number | null,"ref_range_text"?: string | null,"test_code"?: string | null,"unit"?: string | null,"value"?: number | null,"value_text"?: string | null,"visit_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "observations_document_id_fkey"
      columns: ["document_id"]
isOneToOne: false
      referencedRelation: "documents"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "observations_test_code_fkey"
      columns: ["test_code"]
isOneToOne: false
      referencedRelation: "test_catalog"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "observations_visit_id_fkey"
      columns: ["visit_id"]
isOneToOne: false
      referencedRelation: "visits"
      referencedColumns: ["id"]
    }
                  ]
                },"people": {
                  Row: {
                    "allergies": string | null,"birth_date": string | null,"blood_type": string | null,"chronic_conditions": string | null,"created_at": string,"full_name": string,"id": string,"notes": string | null,"sex": string | null
                  }
                  Insert: {
                    "allergies"?: string | null,"birth_date"?: string | null,"blood_type"?: string | null,"chronic_conditions"?: string | null,"created_at"?: string,"full_name": string,"id"?: string,"notes"?: string | null,"sex"?: string | null
                  }
                  Update: {
                    "allergies"?: string | null,"birth_date"?: string | null,"blood_type"?: string | null,"chronic_conditions"?: string | null,"created_at"?: string,"full_name"?: string,"id"?: string,"notes"?: string | null,"sex"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"test_catalog": {
                  Row: {
                    "aliases": (string)[],"category": string | null,"code": string,"name_vi": string,"standard_unit": string | null
                  }
                  Insert: {
                    "aliases"?: (string)[],"category"?: string | null,"code": string,"name_vi": string,"standard_unit"?: string | null
                  }
                  Update: {
                    "aliases"?: (string)[],"category"?: string | null,"code"?: string,"name_vi"?: string,"standard_unit"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"unit_conversions": {
                  Row: {
                    "factor": number,"from_unit": string,"test_code": string
                  }
                  Insert: {
                    "factor": number,"from_unit": string,"test_code": string
                  }
                  Update: {
                    "factor"?: number,"from_unit"?: string,"test_code"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "unit_conversions_test_code_fkey"
      columns: ["test_code"]
isOneToOne: false
      referencedRelation: "test_catalog"
      referencedColumns: ["code"]
    }
                  ]
                },"visits": {
                  Row: {
                    "case_id": string | null,"created_at": string,"department": string | null,"doctor": string | null,"facility": string | null,"id": string,"notes": string | null,"person_id": string,"reason": string | null,"visit_date": string
                  }
                  Insert: {
                    "case_id"?: string | null,"created_at"?: string,"department"?: string | null,"doctor"?: string | null,"facility"?: string | null,"id"?: string,"notes"?: string | null,"person_id": string,"reason"?: string | null,"visit_date": string
                  }
                  Update: {
                    "case_id"?: string | null,"created_at"?: string,"department"?: string | null,"doctor"?: string | null,"facility"?: string | null,"id"?: string,"notes"?: string | null,"person_id"?: string,"reason"?: string | null,"visit_date"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "visits_case_id_fkey"
      columns: ["case_id"]
isOneToOne: false
      referencedRelation: "cases"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "visits_person_id_fkey"
      columns: ["person_id"]
isOneToOne: false
      referencedRelation: "people"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "is_member":
{ Args: Record<PropertyKey, never>; Returns: boolean
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

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const

