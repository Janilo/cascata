export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      business_units: {
        Row: {
          code: string;
          created_at: string;
          label: string;
          sort_order: number;
        };
        Insert: {
          code: string;
          created_at?: string;
          label: string;
          sort_order?: number;
        };
        Update: {
          code?: string;
          created_at?: string;
          label?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      customers: {
        Row: {
          account_id: string | null;
          account_name: string | null;
          attrs: Json;
          bu: string;
          cnpj: string | null;
          created_at: string;
          created_by: string | null;
          customer_name: string;
          id: string;
        };
        Insert: {
          account_id?: string | null;
          account_name?: string | null;
          attrs?: Json;
          bu: string;
          cnpj?: string | null;
          created_at?: string;
          created_by?: string | null;
          customer_name: string;
          id?: string;
        };
        Update: {
          account_id?: string | null;
          account_name?: string | null;
          attrs?: Json;
          bu?: string;
          cnpj?: string | null;
          created_at?: string;
          created_by?: string | null;
          customer_name?: string;
          id?: string;
        };
        Relationships: [];
      };
      line_inputs: {
        Row: {
          ai_extraction: Json | null;
          bu: string;
          customer_id: string;
          department: string;
          file_path: string | null;
          id: string;
          line_code: string;
          priority: string;
          rateio_key: string | null;
          reference_date: string;
          updated_at: string;
          updated_by: string | null;
          value: number | null;
        };
        Insert: {
          ai_extraction?: Json | null;
          bu: string;
          customer_id: string;
          department: string;
          file_path?: string | null;
          id?: string;
          line_code: string;
          priority?: string;
          rateio_key?: string | null;
          reference_date?: string;
          updated_at?: string;
          updated_by?: string | null;
          value?: number | null;
        };
        Update: {
          ai_extraction?: Json | null;
          bu?: string;
          customer_id?: string;
          department?: string;
          file_path?: string | null;
          id?: string;
          line_code?: string;
          priority?: string;
          rateio_key?: string | null;
          reference_date?: string;
          updated_at?: string;
          updated_by?: string | null;
          value?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "line_inputs_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "line_inputs_line_code_fkey";
            columns: ["line_code"];
            isOneToOne: false;
            referencedRelation: "waterfall_lines";
            referencedColumns: ["code"];
          },
        ];
      };
      line_inputs_audit: {
        Row: {
          action: string;
          bu: string | null;
          changed_at: string;
          changed_by: string | null;
          customer_id: string | null;
          department: string | null;
          id: string;
          line_code: string | null;
          line_input_id: string | null;
          new_row: Json | null;
          new_value: number | null;
          old_row: Json | null;
          old_value: number | null;
        };
        Insert: {
          action: string;
          bu?: string | null;
          changed_at?: string;
          changed_by?: string | null;
          customer_id?: string | null;
          department?: string | null;
          id?: string;
          line_code?: string | null;
          line_input_id?: string | null;
          new_row?: Json | null;
          new_value?: number | null;
          old_row?: Json | null;
          old_value?: number | null;
        };
        Update: {
          action?: string;
          bu?: string | null;
          changed_at?: string;
          changed_by?: string | null;
          customer_id?: string | null;
          department?: string | null;
          id?: string;
          line_code?: string | null;
          line_input_id?: string | null;
          new_row?: Json | null;
          new_value?: number | null;
          old_row?: Json | null;
          old_value?: number | null;
        };
        Relationships: [];
      };
      org_node_salaries: {
        Row: {
          org_node_id: string;
          salary: number;
          updated_at: string;
        };
        Insert: {
          org_node_id: string;
          salary?: number;
          updated_at?: string;
        };
        Update: {
          org_node_id?: string;
          salary?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      org_nodes: {
        Row: {
          account: string | null;
          bu: string | null;
          channel: string | null;
          created_at: string;
          customer: string | null;
          department: string | null;
          id: string;
          leader: string | null;
          parent_id: string | null;
        };
        Insert: {
          account?: string | null;
          bu?: string | null;
          channel?: string | null;
          created_at?: string;
          customer?: string | null;
          department?: string | null;
          id?: string;
          leader?: string | null;
          parent_id?: string | null;
        };
        Update: {
          account?: string | null;
          bu?: string | null;
          channel?: string | null;
          created_at?: string;
          customer?: string | null;
          department?: string | null;
          id?: string;
          leader?: string | null;
          parent_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "org_nodes_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "org_nodes";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          department: string | null;
          full_name: string | null;
          id: string;
          is_approved: boolean;
          is_guest: boolean;
        };
        Insert: {
          created_at?: string;
          department?: string | null;
          full_name?: string | null;
          id: string;
          is_approved?: boolean;
          is_guest?: boolean;
        };
        Update: {
          created_at?: string;
          department?: string | null;
          full_name?: string | null;
          id?: string;
          is_approved?: boolean;
          is_guest?: boolean;
        };
        Relationships: [];
      };
      shared_links: {
        Row: {
          bu: string;
          created_at: string;
          created_by: string;
          expires_at: string;
          id: string;
          label: string | null;
          reference_date: string | null;
          token: string;
        };
        Insert: {
          bu: string;
          created_at?: string;
          created_by: string;
          expires_at: string;
          id?: string;
          label?: string | null;
          reference_date?: string | null;
          token: string;
        };
        Update: {
          bu?: string;
          created_at?: string;
          created_by?: string;
          expires_at?: string;
          id?: string;
          label?: string | null;
          reference_date?: string | null;
          token?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      waterfall_lines: {
        Row: {
          bucket: string;
          category: string | null;
          code: string;
          department: string | null;
          kind: string;
          label: string | null;
          main_no: number | null;
          p1_desc: string | null;
          p2_desc: string | null;
          p3_desc: string | null;
          sort_order: number;
          sub_no: number | null;
        };
        Insert: {
          bucket: string;
          category?: string | null;
          code: string;
          department?: string | null;
          kind: string;
          label?: string | null;
          main_no?: number | null;
          p1_desc?: string | null;
          p2_desc?: string | null;
          p3_desc?: string | null;
          sort_order: number;
          sub_no?: number | null;
        };
        Update: {
          bucket?: string;
          category?: string | null;
          code?: string;
          department?: string | null;
          kind?: string;
          label?: string | null;
          main_no?: number | null;
          p1_desc?: string | null;
          p2_desc?: string | null;
          p3_desc?: string | null;
          sort_order?: number;
          sub_no?: number | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      current_department: { Args: never; Returns: string };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      is_approved: { Args: { _user_id: string }; Returns: boolean };
      is_guest: { Args: { _user_id: string }; Returns: boolean };
      line_owner_department: { Args: { _line_code: string }; Returns: string };
    };
    Enums: {
      app_role: "admin" | "member";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "member"],
    },
  },
} as const;
