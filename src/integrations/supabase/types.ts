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
      campaigns: {
        Row: {
          channel: string
          created_at: string | null
          failed_count: number | null
          filter: Json | null
          id: string
          message: string
          name: string
          recipient_count: number | null
          restaurant_id: string | null
          sent_at: string | null
          sent_count: number | null
          status: string | null
        }
        Insert: {
          channel?: string
          created_at?: string | null
          failed_count?: number | null
          filter?: Json | null
          id?: string
          message: string
          name: string
          recipient_count?: number | null
          restaurant_id?: string | null
          sent_at?: string | null
          sent_count?: number | null
          status?: string | null
        }
        Update: {
          channel?: string
          created_at?: string | null
          failed_count?: number | null
          filter?: Json | null
          id?: string
          message?: string
          name?: string
          recipient_count?: number | null
          restaurant_id?: string | null
          sent_at?: string | null
          sent_count?: number | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
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
          restaurant_id: string | null
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
          restaurant_id?: string | null
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
          restaurant_id?: string | null
          tags?: string[] | null
          total_spent?: number | null
          visit_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items: {
        Row: {
          allergens: string | null
          available: boolean | null
          category: string | null
          description: string | null
          featured: boolean | null
          id: string
          name: string
          photo_url: string | null
          price: number | null
          restaurant_id: string | null
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          allergens?: string | null
          available?: boolean | null
          category?: string | null
          description?: string | null
          featured?: boolean | null
          id?: string
          name: string
          photo_url?: string | null
          price?: number | null
          restaurant_id?: string | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          allergens?: string | null
          available?: boolean | null
          category?: string | null
          description?: string | null
          featured?: boolean | null
          id?: string
          name?: string
          photo_url?: string | null
          price?: number | null
          restaurant_id?: string | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      preorders: {
        Row: {
          created_at: string | null
          customer_name: string | null
          id: string
          items: Json | null
          reservation_id: string | null
          restaurant_id: string | null
          status: string | null
          total: number | null
        }
        Insert: {
          created_at?: string | null
          customer_name?: string | null
          id?: string
          items?: Json | null
          reservation_id?: string | null
          restaurant_id?: string | null
          status?: string | null
          total?: number | null
        }
        Update: {
          created_at?: string | null
          customer_name?: string | null
          id?: string
          items?: Json | null
          reservation_id?: string | null
          restaurant_id?: string | null
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
          {
            foreignKeyName: "preorders_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
          occasion_type: string | null
          party_size: number
          preferences: string[] | null
          preorder_link_sent: boolean | null
          reminder_sent: boolean | null
          restaurant_id: string | null
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
          occasion_type?: string | null
          party_size: number
          preferences?: string[] | null
          preorder_link_sent?: boolean | null
          reminder_sent?: boolean | null
          restaurant_id?: string | null
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
          occasion_type?: string | null
          party_size?: number
          preferences?: string[] | null
          preorder_link_sent?: boolean | null
          reminder_sent?: boolean | null
          restaurant_id?: string | null
          status?: string | null
          time?: string
          zone_id?: string | null
          zone_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reservations_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
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
          good_to_know: string | null
          google_maps_url: string | null
          id: string
          instagram_handle: string | null
          kid_friendly: boolean | null
          logo_url: string | null
          max_covers: number | null
          min_age: number | null
          name: string | null
          opening_hours: Json | null
          parking_available: boolean | null
          pets_allowed: boolean | null
          phone: string | null
          preorder_hours_before: number | null
          reminder_24h: boolean | null
          restaurant_id: string | null
          tiktok_handle: string | null
          tone: string | null
          updated_at: string | null
          waitlist_enabled: boolean | null
          wheelchair_accessible: boolean | null
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
          good_to_know?: string | null
          google_maps_url?: string | null
          id?: string
          instagram_handle?: string | null
          kid_friendly?: boolean | null
          logo_url?: string | null
          max_covers?: number | null
          min_age?: number | null
          name?: string | null
          opening_hours?: Json | null
          parking_available?: boolean | null
          pets_allowed?: boolean | null
          phone?: string | null
          preorder_hours_before?: number | null
          reminder_24h?: boolean | null
          restaurant_id?: string | null
          tiktok_handle?: string | null
          tone?: string | null
          updated_at?: string | null
          waitlist_enabled?: boolean | null
          wheelchair_accessible?: boolean | null
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
          good_to_know?: string | null
          google_maps_url?: string | null
          id?: string
          instagram_handle?: string | null
          kid_friendly?: boolean | null
          logo_url?: string | null
          max_covers?: number | null
          min_age?: number | null
          name?: string | null
          opening_hours?: Json | null
          parking_available?: boolean | null
          pets_allowed?: boolean | null
          phone?: string | null
          preorder_hours_before?: number | null
          reminder_24h?: boolean | null
          restaurant_id?: string | null
          tiktok_handle?: string | null
          tone?: string | null
          updated_at?: string | null
          waitlist_enabled?: boolean | null
          wheelchair_accessible?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_settings_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurants: {
        Row: {
          created_at: string
          id: string
          name: string
          onboarding_complete: boolean
          owner_id: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string
          onboarding_complete?: boolean
          owner_id: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          onboarding_complete?: boolean
          owner_id?: string
          slug?: string
          updated_at?: string
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
          restaurant_id: string | null
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
          restaurant_id?: string | null
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
          restaurant_id?: string | null
          status?: string | null
          text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      room_zones: {
        Row: {
          available: boolean | null
          capacity: number | null
          description: string | null
          features: string | null
          id: string
          name: string
          restaurant_id: string | null
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
          restaurant_id?: string | null
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
          restaurant_id?: string | null
          sort_order?: number | null
          table_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "room_zones_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      social_posts: {
        Row: {
          caption: string | null
          created_at: string | null
          hashtags: string | null
          id: string
          image_url: string | null
          platform: string | null
          restaurant_id: string | null
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
          restaurant_id?: string | null
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
          restaurant_id?: string | null
          scheduled_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "social_posts_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          restaurant_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          restaurant_id?: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          restaurant_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      waiter_calls: {
        Row: {
          created_at: string | null
          customer_name: string | null
          id: string
          message: string | null
          reservation_id: string | null
          restaurant_id: string | null
          status: string | null
          table_number: string
        }
        Insert: {
          created_at?: string | null
          customer_name?: string | null
          id?: string
          message?: string | null
          reservation_id?: string | null
          restaurant_id?: string | null
          status?: string | null
          table_number: string
        }
        Update: {
          created_at?: string | null
          customer_name?: string | null
          id?: string
          message?: string | null
          reservation_id?: string | null
          restaurant_id?: string | null
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
          {
            foreignKeyName: "waiter_calls_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
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
          restaurant_id: string | null
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
          restaurant_id?: string | null
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
          restaurant_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_user_restaurant_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      owns_restaurant: {
        Args: { _restaurant_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "owner" | "staff" | "admin"
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
      app_role: ["owner", "staff", "admin"],
    },
  },
} as const
