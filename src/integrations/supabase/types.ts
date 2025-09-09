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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      character_sheets: {
        Row: {
          accessory: string | null
          cartoon_reference_url: string | null
          created_at: string | null
          eye_color: string | null
          hair_color: string | null
          hair_style: string | null
          id: string
          likes: number
          name: string
          photo_url: string | null
          skin_tone: string | null
          typical_outfit: string | null
          user_id: string
        }
        Insert: {
          accessory?: string | null
          cartoon_reference_url?: string | null
          created_at?: string | null
          eye_color?: string | null
          hair_color?: string | null
          hair_style?: string | null
          id?: string
          likes?: number
          name: string
          photo_url?: string | null
          skin_tone?: string | null
          typical_outfit?: string | null
          user_id: string
        }
        Update: {
          accessory?: string | null
          cartoon_reference_url?: string | null
          created_at?: string | null
          eye_color?: string | null
          hair_color?: string | null
          hair_style?: string | null
          id?: string
          likes?: number
          name?: string
          photo_url?: string | null
          skin_tone?: string | null
          typical_outfit?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      stories: {
        Row: {
          art_style: string | null
          character_sheet_id: string | null
          child_age: string | null
          child_name: string | null
          created_at: string | null
          id: string
          language: string | null
          length: number | null
          lesson: string | null
          likes: number
          pdf_url: string | null
          prompt: string
          reading_level: string | null
          share_url: string | null
          status: string | null
          themes: string[] | null
          title: string
          tone: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          art_style?: string | null
          character_sheet_id?: string | null
          child_age?: string | null
          child_name?: string | null
          created_at?: string | null
          id?: string
          language?: string | null
          length?: number | null
          lesson?: string | null
          likes?: number
          pdf_url?: string | null
          prompt: string
          reading_level?: string | null
          share_url?: string | null
          status?: string | null
          themes?: string[] | null
          title: string
          tone?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          art_style?: string | null
          character_sheet_id?: string | null
          child_age?: string | null
          child_name?: string | null
          created_at?: string | null
          id?: string
          language?: string | null
          length?: number | null
          lesson?: string | null
          likes?: number
          pdf_url?: string | null
          prompt?: string
          reading_level?: string | null
          share_url?: string | null
          status?: string | null
          themes?: string[] | null
          title?: string
          tone?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stories_character_sheet_id_fkey"
            columns: ["character_sheet_id"]
            isOneToOne: false
            referencedRelation: "character_sheets"
            referencedColumns: ["id"]
          },
        ]
      }
      story_generations: {
        Row: {
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          generation_type: string
          id: string
          status: string | null
          story_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          generation_type: string
          id?: string
          status?: string | null
          story_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          generation_type?: string
          id?: string
          status?: string | null
          story_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_generations_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      story_pages: {
        Row: {
          created_at: string | null
          id: string
          image_prompt: string | null
          image_url: string | null
          page_number: number
          page_type: string | null
          story_id: string
          text_content: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          image_prompt?: string | null
          image_url?: string | null
          page_number: number
          page_type?: string | null
          story_id: string
          text_content?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          image_prompt?: string | null
          image_url?: string | null
          page_number?: number
          page_type?: string | null
          story_id?: string
          text_content?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "story_pages_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
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
