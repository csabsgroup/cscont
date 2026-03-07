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
      action_plans: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          due_date: string | null
          id: string
          observations: string | null
          office_id: string
          status: Database["public"]["Enums"]["action_plan_status"]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          due_date?: string | null
          id?: string
          observations?: string | null
          office_id: string
          status?: Database["public"]["Enums"]["action_plan_status"]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          id?: string
          observations?: string | null
          office_id?: string
          status?: Database["public"]["Enums"]["action_plan_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_plans_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      activities: {
        Row: {
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          observations: string | null
          office_id: string | null
          priority: Database["public"]["Enums"]["activity_priority"]
          shared_with_client: boolean
          title: string
          type: Database["public"]["Enums"]["activity_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          observations?: string | null
          office_id?: string | null
          priority?: Database["public"]["Enums"]["activity_priority"]
          shared_with_client?: boolean
          title: string
          type?: Database["public"]["Enums"]["activity_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          observations?: string | null
          office_id?: string | null
          priority?: Database["public"]["Enums"]["activity_priority"]
          shared_with_client?: boolean
          title?: string
          type?: Database["public"]["Enums"]["activity_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_checklists: {
        Row: {
          activity_id: string
          completed: boolean
          created_at: string
          id: string
          position: number
          title: string
        }
        Insert: {
          activity_id: string
          completed?: boolean
          created_at?: string
          id?: string
          position?: number
          title: string
        }
        Update: {
          activity_id?: string
          completed?: boolean
          created_at?: string
          id?: string
          position?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_checklists_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_mentions: {
        Row: {
          activity_id: string
          created_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          activity_id: string
          created_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          activity_id?: string
          created_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_mentions_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      automation_executions: {
        Row: {
          context_key: string
          executed_at: string
          id: string
          office_id: string
          result: Json | null
          rule_id: string
        }
        Insert: {
          context_key: string
          executed_at?: string
          id?: string
          office_id: string
          result?: Json | null
          rule_id: string
        }
        Update: {
          context_key?: string
          executed_at?: string
          id?: string
          office_id?: string
          result?: Json | null
          rule_id?: string
        }
        Relationships: []
      }
      automation_logs: {
        Row: {
          actions_executed: Json | null
          conditions_met: boolean
          created_at: string
          error: string | null
          execution_time_ms: number | null
          id: string
          office_id: string
          rule_id: string
          rule_name: string | null
          trigger_type: string
        }
        Insert: {
          actions_executed?: Json | null
          conditions_met?: boolean
          created_at?: string
          error?: string | null
          execution_time_ms?: number | null
          id?: string
          office_id: string
          rule_id: string
          rule_name?: string | null
          trigger_type: string
        }
        Update: {
          actions_executed?: Json | null
          conditions_met?: boolean
          created_at?: string
          error?: string | null
          execution_time_ms?: number | null
          id?: string
          office_id?: string
          rule_id?: string
          rule_name?: string | null
          trigger_type?: string
        }
        Relationships: []
      }
      automation_rules: {
        Row: {
          config: Json
          created_at: string
          id: string
          is_active: boolean
          product_id: string
          rule_type: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          config?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          product_id: string
          rule_type: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          product_id?: string
          rule_type?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      automation_rules_v2: {
        Row: {
          actions: Json
          condition_logic: string
          conditions: Json
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          product_id: string | null
          schedule_config: Json | null
          target_type: string | null
          trigger_params: Json
          trigger_type: string
          updated_at: string
        }
        Insert: {
          actions?: Json
          condition_logic?: string
          conditions?: Json
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          product_id?: string | null
          schedule_config?: Json | null
          target_type?: string | null
          trigger_params?: Json
          trigger_type: string
          updated_at?: string
        }
        Update: {
          actions?: Json
          condition_logic?: string
          conditions?: Json
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          product_id?: string | null
          schedule_config?: Json | null
          target_type?: string | null
          trigger_params?: Json
          trigger_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      bonus_catalog: {
        Row: {
          created_at: string
          default_validity_days: number | null
          eligible_product_ids: string[] | null
          id: string
          name: string
          requires_approval: boolean
          unit: string
          updated_at: string
          visible_in_portal: boolean
        }
        Insert: {
          created_at?: string
          default_validity_days?: number | null
          eligible_product_ids?: string[] | null
          id?: string
          name: string
          requires_approval?: boolean
          unit?: string
          updated_at?: string
          visible_in_portal?: boolean
        }
        Update: {
          created_at?: string
          default_validity_days?: number | null
          eligible_product_ids?: string[] | null
          id?: string
          name?: string
          requires_approval?: boolean
          unit?: string
          updated_at?: string
          visible_in_portal?: boolean
        }
        Relationships: []
      }
      bonus_grants: {
        Row: {
          available: number
          catalog_item_id: string
          expires_at: string | null
          granted_at: string
          id: string
          office_id: string
          quantity: number
          used: number
        }
        Insert: {
          available?: number
          catalog_item_id: string
          expires_at?: string | null
          granted_at?: string
          id?: string
          office_id: string
          quantity?: number
          used?: number
        }
        Update: {
          available?: number
          catalog_item_id?: string
          expires_at?: string | null
          granted_at?: string
          id?: string
          office_id?: string
          quantity?: number
          used?: number
        }
        Relationships: [
          {
            foreignKeyName: "bonus_grants_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "bonus_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bonus_grants_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      bonus_requests: {
        Row: {
          catalog_item_id: string
          created_at: string
          id: string
          notes: string | null
          office_id: string
          quantity: number
          reviewed_by: string | null
          status: Database["public"]["Enums"]["bonus_request_status"]
          updated_at: string
        }
        Insert: {
          catalog_item_id: string
          created_at?: string
          id?: string
          notes?: string | null
          office_id: string
          quantity?: number
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["bonus_request_status"]
          updated_at?: string
        }
        Update: {
          catalog_item_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          office_id?: string
          quantity?: number
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["bonus_request_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bonus_requests_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "bonus_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bonus_requests_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      churn_reasons: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      client_office_links: {
        Row: {
          created_at: string
          id: string
          office_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          office_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          office_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_office_links_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          birthday: string | null
          contact_type: string | null
          cpf: string | null
          created_at: string
          email: string | null
          id: string
          instagram: string | null
          is_main_contact: boolean
          name: string
          notes: string | null
          office_id: string
          phone: string | null
          photo_url: string | null
          role_title: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          birthday?: string | null
          contact_type?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          id?: string
          instagram?: string | null
          is_main_contact?: boolean
          name: string
          notes?: string | null
          office_id: string
          phone?: string | null
          photo_url?: string | null
          role_title?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          birthday?: string | null
          contact_type?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          id?: string
          instagram?: string | null
          is_main_contact?: boolean
          name?: string
          notes?: string | null
          office_id?: string
          phone?: string | null
          photo_url?: string | null
          role_title?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          asaas_link: string | null
          created_at: string
          end_date: string | null
          id: string
          installments_overdue: number | null
          installments_total: number | null
          monthly_value: number | null
          negotiation_notes: string | null
          office_id: string
          product_id: string
          renewal_date: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["contract_status"]
          updated_at: string
          value: number | null
        }
        Insert: {
          asaas_link?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          installments_overdue?: number | null
          installments_total?: number | null
          monthly_value?: number | null
          negotiation_notes?: string | null
          office_id: string
          product_id: string
          renewal_date?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          updated_at?: string
          value?: number | null
        }
        Update: {
          asaas_link?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          installments_overdue?: number | null
          installments_total?: number | null
          monthly_value?: number | null
          negotiation_notes?: string | null
          office_id?: string
          product_id?: string
          renewal_date?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          updated_at?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_field_values: {
        Row: {
          custom_field_id: string
          id: string
          office_id: string
          updated_at: string | null
          updated_by: string | null
          value_boolean: boolean | null
          value_date: string | null
          value_json: Json | null
          value_number: number | null
          value_text: string | null
        }
        Insert: {
          custom_field_id: string
          id?: string
          office_id: string
          updated_at?: string | null
          updated_by?: string | null
          value_boolean?: boolean | null
          value_date?: string | null
          value_json?: Json | null
          value_number?: number | null
          value_text?: string | null
        }
        Update: {
          custom_field_id?: string
          id?: string
          office_id?: string
          updated_at?: string | null
          updated_by?: string | null
          value_boolean?: boolean | null
          value_date?: string | null
          value_json?: Json | null
          value_number?: number | null
          value_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "custom_field_values_custom_field_id_fkey"
            columns: ["custom_field_id"]
            isOneToOne: false
            referencedRelation: "custom_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_field_values_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_fields: {
        Row: {
          created_at: string | null
          created_by: string | null
          data_source: string | null
          data_source_config: Json | null
          default_value: string | null
          description: string | null
          field_type: string
          id: string
          is_editable: boolean | null
          is_required: boolean | null
          is_visible: boolean | null
          name: string
          options: Json | null
          position: string | null
          product_id: string | null
          scope: string
          slug: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          data_source?: string | null
          data_source_config?: Json | null
          default_value?: string | null
          description?: string | null
          field_type: string
          id?: string
          is_editable?: boolean | null
          is_required?: boolean | null
          is_visible?: boolean | null
          name: string
          options?: Json | null
          position?: string | null
          product_id?: string | null
          scope?: string
          slug: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          data_source?: string | null
          data_source_config?: Json | null
          default_value?: string | null
          description?: string | null
          field_type?: string
          id?: string
          is_editable?: boolean | null
          is_required?: boolean | null
          is_visible?: boolean | null
          name?: string
          options?: Json | null
          position?: string | null
          product_id?: string | null
          scope?: string
          slug?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "custom_fields_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_indicators: {
        Row: {
          config: Json
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          is_predefined: boolean | null
          name: string
          pinned_to_dashboard: boolean | null
          product_filter: string | null
          sort_order: number | null
          updated_at: string | null
          visualization_type: string | null
        }
        Insert: {
          config?: Json
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_predefined?: boolean | null
          name: string
          pinned_to_dashboard?: boolean | null
          product_filter?: string | null
          sort_order?: number | null
          updated_at?: string | null
          visualization_type?: string | null
        }
        Update: {
          config?: Json
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_predefined?: boolean | null
          name?: string
          pinned_to_dashboard?: boolean | null
          product_filter?: string | null
          sort_order?: number | null
          updated_at?: string | null
          visualization_type?: string | null
        }
        Relationships: []
      }
      event_participants: {
        Row: {
          confirmed: boolean
          contact_id: string | null
          created_at: string
          event_id: string
          id: string
          office_id: string | null
          status: string
        }
        Insert: {
          confirmed?: boolean
          contact_id?: string | null
          created_at?: string
          event_id: string
          id?: string
          office_id?: string | null
          status?: string
        }
        Update: {
          confirmed?: boolean
          contact_id?: string | null
          created_at?: string
          event_id?: string
          id?: string
          office_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_participants_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_participants_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_participants_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          eligible_product_ids: string[] | null
          end_date: string | null
          event_date: string
          id: string
          location: string | null
          max_participants: number | null
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          eligible_product_ids?: string[] | null
          end_date?: string | null
          event_date: string
          id?: string
          location?: string | null
          max_participants?: number | null
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          eligible_product_ids?: string[] | null
          end_date?: string | null
          event_date?: string
          id?: string
          location?: string | null
          max_participants?: number | null
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      form_action_executions: {
        Row: {
          action_key: string
          executed_at: string
          id: string
          result: Json
          submission_id: string
        }
        Insert: {
          action_key: string
          executed_at?: string
          id?: string
          result?: Json
          submission_id: string
        }
        Update: {
          action_key?: string
          executed_at?: string
          id?: string
          result?: Json
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_action_executions_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "form_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      form_submissions: {
        Row: {
          data: Json
          id: string
          meeting_id: string | null
          office_id: string
          submitted_at: string
          template_id: string
          user_id: string | null
        }
        Insert: {
          data?: Json
          id?: string
          meeting_id?: string | null
          office_id: string
          submitted_at?: string
          template_id: string
          user_id?: string | null
        }
        Update: {
          data?: Json
          id?: string
          meeting_id?: string | null
          office_id?: string
          submitted_at?: string
          template_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "form_submissions_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "form_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      form_templates: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          fields: Json
          form_hash: string | null
          form_type: string
          id: string
          is_active: boolean | null
          name: string
          post_actions: Json
          product_id: string | null
          sections: Json | null
          type: Database["public"]["Enums"]["form_template_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          fields?: Json
          form_hash?: string | null
          form_type?: string
          id?: string
          is_active?: boolean | null
          name: string
          post_actions?: Json
          product_id?: string | null
          sections?: Json | null
          type?: Database["public"]["Enums"]["form_template_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          fields?: Json
          form_hash?: string | null
          form_type?: string
          id?: string
          is_active?: boolean | null
          name?: string
          post_actions?: Json
          product_id?: string | null
          sections?: Json | null
          type?: Database["public"]["Enums"]["form_template_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_templates_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      health_indicators: {
        Row: {
          created_at: string
          data_key: string | null
          data_source: string | null
          id: string
          name: string
          pillar_id: string
          updated_at: string
          weight: number
        }
        Insert: {
          created_at?: string
          data_key?: string | null
          data_source?: string | null
          id?: string
          name: string
          pillar_id: string
          updated_at?: string
          weight?: number
        }
        Update: {
          created_at?: string
          data_key?: string | null
          data_source?: string | null
          id?: string
          name?: string
          pillar_id?: string
          updated_at?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "health_indicators_pillar_id_fkey"
            columns: ["pillar_id"]
            isOneToOne: false
            referencedRelation: "health_pillars"
            referencedColumns: ["id"]
          },
        ]
      }
      health_overrides: {
        Row: {
          action: Database["public"]["Enums"]["health_override_action"]
          condition_type: string
          created_at: string
          id: string
          product_id: string
          reduction_points: number | null
          threshold: number
          updated_at: string
        }
        Insert: {
          action?: Database["public"]["Enums"]["health_override_action"]
          condition_type: string
          created_at?: string
          id?: string
          product_id: string
          reduction_points?: number | null
          threshold?: number
          updated_at?: string
        }
        Update: {
          action?: Database["public"]["Enums"]["health_override_action"]
          condition_type?: string
          created_at?: string
          id?: string
          product_id?: string
          reduction_points?: number | null
          threshold?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_overrides_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      health_pillars: {
        Row: {
          created_at: string
          id: string
          name: string
          position: number
          product_id: string
          updated_at: string
          weight: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          position?: number
          product_id: string
          updated_at?: string
          weight?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          position?: number
          product_id?: string
          updated_at?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "health_pillars_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      health_playbook_executions: {
        Row: {
          band: Database["public"]["Enums"]["health_band"]
          created_activity_ids: Json
          executed_at: string
          id: string
          office_id: string
          period_key: string
          product_id: string
        }
        Insert: {
          band: Database["public"]["Enums"]["health_band"]
          created_activity_ids?: Json
          executed_at?: string
          id?: string
          office_id: string
          period_key: string
          product_id: string
        }
        Update: {
          band?: Database["public"]["Enums"]["health_band"]
          created_activity_ids?: Json
          executed_at?: string
          id?: string
          office_id?: string
          period_key?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_playbook_executions_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_playbook_executions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      health_playbooks: {
        Row: {
          activity_template: Json
          band: Database["public"]["Enums"]["health_band"]
          created_at: string
          id: string
          product_id: string
          updated_at: string
        }
        Insert: {
          activity_template?: Json
          band: Database["public"]["Enums"]["health_band"]
          created_at?: string
          id?: string
          product_id: string
          updated_at?: string
        }
        Update: {
          activity_template?: Json
          band?: Database["public"]["Enums"]["health_band"]
          created_at?: string
          id?: string
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_playbooks_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      health_scores: {
        Row: {
          band: Database["public"]["Enums"]["health_band"]
          breakdown: Json | null
          calculated_at: string
          id: string
          office_id: string
          score: number
        }
        Insert: {
          band?: Database["public"]["Enums"]["health_band"]
          breakdown?: Json | null
          calculated_at?: string
          id?: string
          office_id: string
          score?: number
        }
        Update: {
          band?: Database["public"]["Enums"]["health_band"]
          breakdown?: Json | null
          calculated_at?: string
          id?: string
          office_id?: string
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "health_scores_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: true
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      import_batches: {
        Row: {
          created_at: string
          entity_type: string
          id: string
          record_count: number
          record_ids: string[]
          table_name: string
          undone_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          entity_type: string
          id?: string
          record_count?: number
          record_ids?: string[]
          table_name: string
          undone_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          entity_type?: string
          id?: string
          record_count?: number
          record_ids?: string[]
          table_name?: string
          undone_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      integration_settings: {
        Row: {
          config: Json | null
          created_at: string | null
          id: string
          is_connected: boolean | null
          provider: string
          updated_at: string | null
          workspace_name: string | null
        }
        Insert: {
          config?: Json | null
          created_at?: string | null
          id?: string
          is_connected?: boolean | null
          provider: string
          updated_at?: string | null
          workspace_name?: string | null
        }
        Update: {
          config?: Json | null
          created_at?: string | null
          id?: string
          is_connected?: boolean | null
          provider?: string
          updated_at?: string | null
          workspace_name?: string | null
        }
        Relationships: []
      }
      integration_tokens: {
        Row: {
          access_token: string | null
          created_at: string | null
          id: string
          provider: string
          provider_email: string | null
          refresh_token: string | null
          token_expiry: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token?: string | null
          created_at?: string | null
          id?: string
          provider: string
          provider_email?: string | null
          refresh_token?: string | null
          token_expiry?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string | null
          created_at?: string | null
          id?: string
          provider?: string
          provider_email?: string | null
          refresh_token?: string | null
          token_expiry?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      journey_stages: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          position: number
          product_id: string
          sla_days: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          position?: number
          product_id: string
          sla_days?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          position?: number
          product_id?: string
          sla_days?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_stages_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      manager_csm_links: {
        Row: {
          created_at: string
          csm_id: string
          id: string
          manager_id: string
        }
        Insert: {
          created_at?: string
          csm_id: string
          id?: string
          manager_id: string
        }
        Update: {
          created_at?: string
          csm_id?: string
          id?: string
          manager_id?: string
        }
        Relationships: []
      }
      meeting_transcripts: {
        Row: {
          action_items: Json | null
          attendees: Json | null
          created_at: string | null
          date: string | null
          fireflies_meeting_id: string | null
          id: string
          matched: boolean | null
          meeting_id: string | null
          summary: string | null
          title: string | null
          transcript: string | null
        }
        Insert: {
          action_items?: Json | null
          attendees?: Json | null
          created_at?: string | null
          date?: string | null
          fireflies_meeting_id?: string | null
          id?: string
          matched?: boolean | null
          meeting_id?: string | null
          summary?: string | null
          title?: string | null
          transcript?: string | null
        }
        Update: {
          action_items?: Json | null
          attendees?: Json | null
          created_at?: string | null
          date?: string | null
          fireflies_meeting_id?: string | null
          id?: string
          matched?: boolean | null
          meeting_id?: string | null
          summary?: string | null
          title?: string | null
          transcript?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_transcripts_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          created_at: string
          duration_minutes: number | null
          google_event_id: string | null
          id: string
          notes: string | null
          office_id: string
          scheduled_at: string
          share_with_client: boolean
          status: Database["public"]["Enums"]["meeting_status"]
          title: string
          transcript: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_minutes?: number | null
          google_event_id?: string | null
          id?: string
          notes?: string | null
          office_id: string
          scheduled_at: string
          share_with_client?: boolean
          status?: Database["public"]["Enums"]["meeting_status"]
          title: string
          transcript?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          duration_minutes?: number | null
          google_event_id?: string | null
          id?: string
          notes?: string | null
          office_id?: string
          scheduled_at?: string
          share_with_client?: boolean
          status?: Database["public"]["Enums"]["meeting_status"]
          title?: string
          transcript?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetings_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          link: string | null
          message: string | null
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          link?: string | null
          message?: string | null
          read?: boolean
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          link?: string | null
          message?: string | null
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      office_files: {
        Row: {
          created_at: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          name: string
          note_id: string | null
          office_id: string
          share_with_client: boolean
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          name: string
          note_id?: string | null
          office_id: string
          share_with_client?: boolean
          uploaded_by: string
        }
        Update: {
          created_at?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          name?: string
          note_id?: string | null
          office_id?: string
          share_with_client?: boolean
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "office_files_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "office_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "office_files_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      office_journey: {
        Row: {
          completed_at: string | null
          created_at: string
          entered_at: string
          id: string
          journey_stage_id: string
          notes: string | null
          office_id: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          entered_at?: string
          id?: string
          journey_stage_id: string
          notes?: string | null
          office_id: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          entered_at?: string
          id?: string
          journey_stage_id?: string
          notes?: string | null
          office_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "office_journey_journey_stage_id_fkey"
            columns: ["journey_stage_id"]
            isOneToOne: false
            referencedRelation: "journey_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "office_journey_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: true
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      office_metrics_history: {
        Row: {
          created_at: string | null
          cs_feeling: string | null
          csat_score: number | null
          custom_data: Json | null
          faturamento_anual: number | null
          faturamento_mensal: number | null
          form_submission_id: string | null
          health_score: number | null
          id: string
          nps_score: number | null
          office_id: string
          period_month: number
          period_year: number
          qtd_clientes: number | null
          qtd_colaboradores: number | null
        }
        Insert: {
          created_at?: string | null
          cs_feeling?: string | null
          csat_score?: number | null
          custom_data?: Json | null
          faturamento_anual?: number | null
          faturamento_mensal?: number | null
          form_submission_id?: string | null
          health_score?: number | null
          id?: string
          nps_score?: number | null
          office_id: string
          period_month: number
          period_year: number
          qtd_clientes?: number | null
          qtd_colaboradores?: number | null
        }
        Update: {
          created_at?: string | null
          cs_feeling?: string | null
          csat_score?: number | null
          custom_data?: Json | null
          faturamento_anual?: number | null
          faturamento_mensal?: number | null
          form_submission_id?: string | null
          health_score?: number | null
          id?: string
          nps_score?: number | null
          office_id?: string
          period_month?: number
          period_year?: number
          qtd_clientes?: number | null
          qtd_colaboradores?: number | null
        }
        Relationships: []
      }
      office_notes: {
        Row: {
          content: string
          created_at: string
          created_by: string
          id: string
          note_type: string
          office_id: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by: string
          id?: string
          note_type?: string
          office_id: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          note_type?: string
          office_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "office_notes_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      office_stage_history: {
        Row: {
          change_type: string
          changed_by: string
          created_at: string
          from_stage_id: string | null
          id: string
          office_id: string
          reason: string | null
          to_stage_id: string
        }
        Insert: {
          change_type?: string
          changed_by: string
          created_at?: string
          from_stage_id?: string | null
          id?: string
          office_id: string
          reason?: string | null
          to_stage_id: string
        }
        Update: {
          change_type?: string
          changed_by?: string
          created_at?: string
          from_stage_id?: string | null
          id?: string
          office_id?: string
          reason?: string | null
          to_stage_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "office_stage_history_from_stage_id_fkey"
            columns: ["from_stage_id"]
            isOneToOne: false
            referencedRelation: "journey_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "office_stage_history_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "office_stage_history_to_stage_id_fkey"
            columns: ["to_stage_id"]
            isOneToOne: false
            referencedRelation: "journey_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      offices: {
        Row: {
          activation_date: string | null
          active_product_id: string | null
          address: string | null
          asaas_customer_id: string | null
          asaas_total_overdue: number | null
          cep: string | null
          churn_date: string | null
          churn_observation: string | null
          churn_reason_id: string | null
          city: string | null
          cnpj: string | null
          cpf: string | null
          created_at: string
          cs_feeling: string | null
          csm_id: string | null
          cycle_end_date: string | null
          cycle_start_date: string | null
          email: string | null
          faturamento_anual: number | null
          faturamento_mensal: number | null
          first_signature_date: string | null
          id: string
          instagram: string | null
          last_csat: number | null
          last_meeting_date: string | null
          last_meeting_type: string | null
          last_nps: number | null
          logo_url: string | null
          mrr: number | null
          name: string
          notes: string | null
          office_code: string | null
          onboarding_date: string | null
          phone: string | null
          photo_url: string | null
          piperun_deal_id: string | null
          qtd_clientes: number | null
          qtd_colaboradores: number | null
          segment: string | null
          state: string | null
          status: Database["public"]["Enums"]["office_status"]
          tags: string[] | null
          updated_at: string
          visible_in_directory: boolean
          whatsapp: string | null
        }
        Insert: {
          activation_date?: string | null
          active_product_id?: string | null
          address?: string | null
          asaas_customer_id?: string | null
          asaas_total_overdue?: number | null
          cep?: string | null
          churn_date?: string | null
          churn_observation?: string | null
          churn_reason_id?: string | null
          city?: string | null
          cnpj?: string | null
          cpf?: string | null
          created_at?: string
          cs_feeling?: string | null
          csm_id?: string | null
          cycle_end_date?: string | null
          cycle_start_date?: string | null
          email?: string | null
          faturamento_anual?: number | null
          faturamento_mensal?: number | null
          first_signature_date?: string | null
          id?: string
          instagram?: string | null
          last_csat?: number | null
          last_meeting_date?: string | null
          last_meeting_type?: string | null
          last_nps?: number | null
          logo_url?: string | null
          mrr?: number | null
          name: string
          notes?: string | null
          office_code?: string | null
          onboarding_date?: string | null
          phone?: string | null
          photo_url?: string | null
          piperun_deal_id?: string | null
          qtd_clientes?: number | null
          qtd_colaboradores?: number | null
          segment?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["office_status"]
          tags?: string[] | null
          updated_at?: string
          visible_in_directory?: boolean
          whatsapp?: string | null
        }
        Update: {
          activation_date?: string | null
          active_product_id?: string | null
          address?: string | null
          asaas_customer_id?: string | null
          asaas_total_overdue?: number | null
          cep?: string | null
          churn_date?: string | null
          churn_observation?: string | null
          churn_reason_id?: string | null
          city?: string | null
          cnpj?: string | null
          cpf?: string | null
          created_at?: string
          cs_feeling?: string | null
          csm_id?: string | null
          cycle_end_date?: string | null
          cycle_start_date?: string | null
          email?: string | null
          faturamento_anual?: number | null
          faturamento_mensal?: number | null
          first_signature_date?: string | null
          id?: string
          instagram?: string | null
          last_csat?: number | null
          last_meeting_date?: string | null
          last_meeting_type?: string | null
          last_nps?: number | null
          logo_url?: string | null
          mrr?: number | null
          name?: string
          notes?: string | null
          office_code?: string | null
          onboarding_date?: string | null
          phone?: string | null
          photo_url?: string | null
          piperun_deal_id?: string | null
          qtd_clientes?: number | null
          qtd_colaboradores?: number | null
          segment?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["office_status"]
          tags?: string[] | null
          updated_at?: string
          visible_in_directory?: boolean
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "offices_active_product_id_fkey"
            columns: ["active_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_settings: {
        Row: {
          id: string
          setting_key: string
          setting_value: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          setting_key: string
          setting_value?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          setting_key?: string
          setting_value?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      product_360_config: {
        Row: {
          config_type: string
          id: string
          items: Json
          product_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          config_type: string
          id?: string
          items?: Json
          product_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          config_type?: string
          id?: string
          items?: Json
          product_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      products: {
        Row: {
          code_prefix: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          code_prefix?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          code_prefix?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          product_id: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          product_id?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          product_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_files: {
        Row: {
          created_at: string
          id: string
          name: string
          office_id: string
          shared_with_client: boolean
          uploaded_by: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          office_id: string
          shared_with_client?: boolean
          uploaded_by: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          office_id?: string
          shared_with_client?: boolean
          uploaded_by?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_files_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
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
      user_table_views: {
        Row: {
          columns: Json
          created_at: string
          filters: Json
          id: string
          is_default: boolean
          name: string
          page: string
          user_id: string
        }
        Insert: {
          columns?: Json
          created_at?: string
          filters?: Json
          id?: string
          is_default?: boolean
          name: string
          page?: string
          user_id: string
        }
        Update: {
          columns?: Json
          created_at?: string
          filters?: Json
          id?: string
          is_default?: boolean
          name?: string
          page?: string
          user_id?: string
        }
        Relationships: []
      }
      webhook_logs: {
        Row: {
          created_at: string
          error: string | null
          id: string
          payload: Json
          processed: boolean
          provider: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: string
          payload?: Json
          processed?: boolean
          provider: string
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          payload?: Json
          processed?: boolean
          provider?: string
        }
        Relationships: []
      }
      whatsapp_messages: {
        Row: {
          contact_id: string | null
          content: string | null
          created_at: string | null
          direction: string
          id: string
          message_type: string
          office_id: string | null
          phone_from: string | null
          phone_to: string | null
          status: string | null
          template_name: string | null
          wamid: string | null
        }
        Insert: {
          contact_id?: string | null
          content?: string | null
          created_at?: string | null
          direction?: string
          id?: string
          message_type?: string
          office_id?: string | null
          phone_from?: string | null
          phone_to?: string | null
          status?: string | null
          template_name?: string | null
          wamid?: string | null
        }
        Update: {
          contact_id?: string | null
          content?: string | null
          created_at?: string | null
          direction?: string
          id?: string
          message_type?: string
          office_id?: string | null
          phone_from?: string | null
          phone_to?: string | null
          status?: string | null
          template_name?: string | null
          wamid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_templates: {
        Row: {
          auto_trigger: string | null
          auto_trigger_enabled: boolean | null
          created_at: string | null
          description: string | null
          id: string
          template_name: string
          variables: Json | null
        }
        Insert: {
          auto_trigger?: string | null
          auto_trigger_enabled?: boolean | null
          created_at?: string | null
          description?: string | null
          id?: string
          template_name: string
          variables?: Json | null
        }
        Update: {
          auto_trigger?: string | null
          auto_trigger_enabled?: boolean | null
          created_at?: string | null
          description?: string | null
          id?: string
          template_name?: string
          variables?: Json | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_client_office_ids: { Args: { _user_id: string }; Returns: string[] }
      get_csm_office_ids: { Args: { _user_id: string }; Returns: string[] }
      get_manager_office_ids: { Args: { _user_id: string }; Returns: string[] }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_visible_office_ids: { Args: { _user_id: string }; Returns: string[] }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      action_plan_status: "pending" | "in_progress" | "done" | "cancelled"
      activity_priority: "low" | "medium" | "high" | "urgent"
      activity_type:
        | "task"
        | "follow_up"
        | "onboarding"
        | "renewal"
        | "other"
        | "ligacao"
        | "check_in"
        | "email"
        | "whatsapp"
        | "planejamento"
        | "meeting"
      app_role: "admin" | "manager" | "csm" | "viewer" | "client"
      bonus_request_status: "pending" | "approved" | "denied"
      contract_status: "ativo" | "encerrado" | "cancelado" | "pendente"
      form_template_type:
        | "kickoff"
        | "onboarding"
        | "nutricao"
        | "renovacao"
        | "expansao"
        | "sos"
        | "extra"
        | "apresentacao"
      health_band: "red" | "yellow" | "green"
      health_override_action: "force_red" | "reduce_score"
      meeting_status: "scheduled" | "completed" | "cancelled"
      office_status:
        | "ativo"
        | "churn"
        | "nao_renovado"
        | "nao_iniciado"
        | "upsell"
        | "bonus_elite"
        | "pausado"
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
      action_plan_status: ["pending", "in_progress", "done", "cancelled"],
      activity_priority: ["low", "medium", "high", "urgent"],
      activity_type: [
        "task",
        "follow_up",
        "onboarding",
        "renewal",
        "other",
        "ligacao",
        "check_in",
        "email",
        "whatsapp",
        "planejamento",
        "meeting",
      ],
      app_role: ["admin", "manager", "csm", "viewer", "client"],
      bonus_request_status: ["pending", "approved", "denied"],
      contract_status: ["ativo", "encerrado", "cancelado", "pendente"],
      form_template_type: [
        "kickoff",
        "onboarding",
        "nutricao",
        "renovacao",
        "expansao",
        "sos",
        "extra",
        "apresentacao",
      ],
      health_band: ["red", "yellow", "green"],
      health_override_action: ["force_red", "reduce_score"],
      meeting_status: ["scheduled", "completed", "cancelled"],
      office_status: [
        "ativo",
        "churn",
        "nao_renovado",
        "nao_iniciado",
        "upsell",
        "bonus_elite",
        "pausado",
      ],
    },
  },
} as const
