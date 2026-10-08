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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      clients: {
        Row: {
          apellido: string | null
          celular: string
          created_at: string
          dias: number | null
          estado: string
          id: string
          nombre: string
          nota_plataforma: string | null
          nota_precio: string | null
          plan: string | null
          seguimiento: string | null
          total: number
          ultimo_mensaje: string | null
          updated_at: string
          user_id: string
          vencimiento: string
        }
        Insert: {
          apellido?: string | null
          celular: string
          created_at?: string
          dias?: number | null
          estado?: string
          id?: string
          nombre: string
          nota_plataforma?: string | null
          nota_precio?: string | null
          plan?: string | null
          seguimiento?: string | null
          total?: number
          ultimo_mensaje?: string | null
          updated_at?: string
          user_id: string
          vencimiento: string
        }
        Update: {
          apellido?: string | null
          celular?: string
          created_at?: string
          dias?: number | null
          estado?: string
          id?: string
          nombre?: string
          nota_plataforma?: string | null
          nota_precio?: string | null
          plan?: string | null
          seguimiento?: string | null
          total?: number
          ultimo_mensaje?: string | null
          updated_at?: string
          user_id?: string
          vencimiento?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          client_id: string | null
          cliente_nombre: string
          created_at: string
          fecha_pago: string
          id: string
          medio: string
          monto: number
          plan: string | null
          user_id: string
          vencimiento_anterior: string | null
          vencimiento_nuevo: string | null
        }
        Insert: {
          client_id?: string | null
          cliente_nombre: string
          created_at?: string
          fecha_pago?: string
          id?: string
          medio?: string
          monto?: number
          plan?: string | null
          user_id: string
          vencimiento_anterior?: string | null
          vencimiento_nuevo?: string | null
        }
        Update: {
          client_id?: string | null
          cliente_nombre?: string
          created_at?: string
          fecha_pago?: string
          id?: string
          medio?: string
          monto?: number
          plan?: string | null
          user_id?: string
          vencimiento_anterior?: string | null
          vencimiento_nuevo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_events: {
        Row: {
          client_id: string
          created_at: string
          detalle: string
          id: string
          tipo: string
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          detalle?: string
          id?: string
          tipo: string
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          detalle?: string
          id?: string
          tipo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      app_members: {
        Row: {
          clave: string | null
          created_at: string
          rol: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          clave?: string | null
          created_at?: string
          rol: string
          user_id: string
          workspace_id: string
        }
        Update: {
          clave?: string | null
          created_at?: string
          rol?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: []
      }
      user_configs: {
        Row: {
          id: string
          settings: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          settings?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          settings?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_workspace: { Args: never; Returns: string }
      list_members: {
        Args: never
        Returns: { clave: string | null; email: string; rol: string; user_id: string }[]
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
    Enums: {},
  },
} as const
