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
      clients: {
        Row: {
          allergens: string | null
          birthday: string | null
          created_at: string | null
          id: string
          last_visit: string | null
          name: string
          notes: string | null
          phone: string | null
          tags: string[] | null
          total_spent: number | null
          visit_count: number | null
        }
        Insert: {
          allergens?: string | null
          birthday?: string | null
          created_at?: string | null
          id?: string
          last_visit?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          tags?: string[] | null
          total_spent?: number | null
          visit_count?: number | null
        }
        Update: {
          allergens?: string | null
          birthday?: string | null
          created_at?: string | null
          id?: string
          last_visit?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          tags?: string[] | null
          total_spent?: number | null
          visit_count?: number | null
        }
        Relationships: []
      }
      menu_items: {
        Row: {
          allergens: string | null
          available: boolean | null
          category: string | null
          description: string | null
          id: string
          name: string
          photo_url: string | null
          price: number | null
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          allergens?: string | null
          available?: boolean | null
          category?: string | null
          description?: string | null
          id?: string
          name: string
          photo_url?: string | null
          price?: number | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          allergens?: string | null
          available?: boolean | null
          category?: string | null
          description?: string | null
          id?: string
          name?: string
          photo_url?: string | null
          price?: number | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      preorders: {
        Row: {
          created_at: string | null
          customer_name: string | null
          id: string
          items: Json | null
          reservation_id: string | null
          status: string | null
          total: number | null
        }
        Insert: {
          created_at?: string | null
          customer_name?: string | null
          id?: string
          items?: Json | null
          reservation_id?: string | null
          status?: string | null
          total?: number | null
        }
        Update: {
          created_at?: string | null
          customer_name?: string | null
          id?: string
          items?: Json | null
          reservation_id?: string | null
          status?: string | null
          total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "preorders_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations: {
        Row: {
          allergies: string | null
          arrived: boolean | null
          created_at: string | null
          customer_name: string
          customer_phone: string | null
          date: string
          id: string
          notes: string | null
          occasion: string | null
          party_size: number
          preorder_link_sent: boolean | null
          reminder_sent: boolean | null
          status: string | null
          time: string
          zone_id: string | null
          zone_name: string | null
        }
        Insert: {
          allergies?: string | null
          arrived?: boolean | null
          created_at?: string | null
          customer_name: string
          customer_phone?: string | null
          date: string
          id?: string
          notes?: string | null
          occasion?: string | null
          party_size: number
          preorder_link_sent?: boolean | null
          reminder_sent?: boolean | null
          status?: string | null
          time: string
          zone_id?: string | null
          zone_name?: string | null
        }
        Update: {
          allergies?: string | null
          arrived?: boolean | null
          created_at?: string | null
          customer_name?: string
          customer_phone?: string | null
          date?: string
          id?: string
          notes?: string | null
          occasion?: string | null
          party_size?: number
          preorder_link_sent?: boolean | null
          reminder_sent?: boolean | null
          status?: string | null
          time?: string
          zone_id?: string | null
          zone_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reservations_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "room_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_settings: {
        Row: {
          address: string | null
          ask_allergies: boolean | null
          ask_occasion: boolean | null
          avg_table_duration: number | null
          bio: string | null
          cover_photo_url: string | null
          facebook_handle: string | null
          followup_enabled: boolean | null
          id: string
          instagram_handle: string | null
          logo_url: string | null
          max_covers: number | null
          name: string | null
          opening_hours: Json | null
          phone: string | null
          preorder_hours_before: number | null
          reminder_24h: boolean | null
          tiktok_handle: string | null
          tone: string | null
          updated_at: string | null
          waitlist_enabled: boolean | null
        }
        Insert: {
          address?: string | null
          ask_allergies?: boolean | null
          ask_occasion?: boolean | null
          avg_table_duration?: number | null
          bio?: string | null
          cover_photo_url?: string | null
          facebook_handle?: string | null
          followup_enabled?: boolean | null
          id?: string
          instagram_handle?: string | null
          logo_url?: string | null
          max_covers?: number | null
          name?: string | null
          opening_hours?: Json | null
          phone?: string | null
          preorder_hours_before?: number | null
          reminder_24h?: boolean | null
          tiktok_handle?: string | null
          tone?: string | null
          updated_at?: string | null
          waitlist_enabled?: boolean | null
        }
        Update: {
          address?: string | null
          ask_allergies?: boolean | null
          ask_occasion?: boolean | null
          avg_table_duration?: number | null
          bio?: string | null
          cover_photo_url?: string | null
          facebook_handle?: string | null
          followup_enabled?: boolean | null
          id?: string
          instagram_handle?: string | null
          logo_url?: string | null
          max_covers?: number | null
          name?: string | null
          opening_hours?: Json | null
          phone?: string | null
          preorder_hours_before?: number | null
          reminder_24h?: boolean | null
          tiktok_handle?: string | null
          tone?: string | null
          updated_at?: string | null
          waitlist_enabled?: boolean | null
        }
        Relationships: []
      }
      reviews: {
        Row: {
          ai_responses: Json | null
          author: string | null
          date: string | null
          id: string
          owner_response: string | null
          platform: string | null
          rating: number | null
          status: string | null
          text: string | null
        }
        Insert: {
          ai_responses?: Json | null
          author?: string | null
          date?: string | null
          id?: string
          owner_response?: string | null
          platform?: string | null
          rating?: number | null
          status?: string | null
          text?: string | null
        }
        Update: {
          ai_responses?: Json | null
          author?: string | null
          date?: string | null
          id?: string
          owner_response?: string | null
          platform?: string | null
          rating?: number | null
          status?: string | null
          text?: string | null
        }
        Relationships: []
      }
      room_zones: {
        Row: {
          available: boolean | null
          capacity: number | null
          description: string | null
          features: string | null
          id: string
          name: string
          sort_order: number | null
          table_count: number | null
        }
        Insert: {
          available?: boolean | null
          capacity?: number | null
          description?: string | null
          features?: string | null
          id?: string
          name: string
          sort_order?: number | null
          table_count?: number | null
        }
        Update: {
          available?: boolean | null
          capacity?: number | null
          description?: string | null
          features?: string | null
          id?: string
          name?: string
          sort_order?: number | null
          table_count?: number | null
        }
        Relationships: []
      }
      social_posts: {
        Row: {
          caption: string | null
          created_at: string | null
          hashtags: string | null
          id: string
          image_url: string | null
          platform: string | null
          scheduled_at: string | null
          status: string | null
        }
        Insert: {
          caption?: string | null
          created_at?: string | null
          hashtags?: string | null
          id?: string
          image_url?: string | null
          platform?: string | null
          scheduled_at?: string | null
          status?: string | null
        }
        Update: {
          caption?: string | null
          created_at?: string | null
          hashtags?: string | null
          id?: string
          image_url?: string | null
          platform?: string | null
          scheduled_at?: string | null
          status?: string | null
        }
        Relationships: []
      }
      waiter_calls: {
        Row: {
          created_at: string | null
          customer_name: string | null
          id: string
          message: string | null
          reservation_id: string | null
          status: string | null
          table_number: string
        }
        Insert: {
          created_at?: string | null
          customer_name?: string | null
          id?: string
          message?: string | null
          reservation_id?: string | null
          status?: string | null
          table_number: string
        }
        Update: {
          created_at?: string | null
          customer_name?: string | null
          id?: string
          message?: string | null
          reservation_id?: string | null
          status?: string | null
          table_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "waiter_calls_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist: {
        Row: {
          created_at: string | null
          customer_name: string
          customer_phone: string | null
          date: string
          id: string
          party_size: number
          preferred_time: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          customer_name: string
          customer_phone?: string | null
          date: string
          id?: string
          party_size: number
          preferred_time?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          customer_name?: string
          customer_phone?: string | null
          date?: string
          id?: string
          party_size?: number
          preferred_time?: string | null
          status?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
