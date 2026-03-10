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
      attempts: {
        Row: {
          answered_at: string
          id: number
          is_correct: boolean
          question_id: string
          selected_index: number
          user_id: string
        }
        Insert: {
          answered_at?: string
          id?: number
          is_correct?: boolean
          question_id: string
          selected_index?: number
          user_id: string
        }
        Update: {
          answered_at?: string
          id?: number
          is_correct?: boolean
          question_id?: string
          selected_index?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attempts_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          author_role: string
          author_username: string
          created_at: string
          id: string
          question_id: string
          status: string
          text: string
        }
        Insert: {
          author_role?: string
          author_username?: string
          created_at?: string
          id: string
          question_id: string
          status?: string
          text?: string
        }
        Update: {
          author_role?: string
          author_username?: string
          created_at?: string
          id?: string
          question_id?: string
          status?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_meta: {
        Row: {
          last_attempt_date: string | null
          last_filters: Json
          streak: number
          user_id: string
        }
        Insert: {
          last_attempt_date?: string | null
          last_filters?: Json
          streak?: number
          user_id: string
        }
        Update: {
          last_attempt_date?: string | null
          last_filters?: Json
          streak?: number
          user_id?: string
        }
        Relationships: []
      }
      lessons: {
        Row: {
          grade: string
          id: string
          subject: string
          title: string
          topic: string
          url: string
        }
        Insert: {
          grade?: string
          id: string
          subject?: string
          title?: string
          topic?: string
          url?: string
        }
        Update: {
          grade?: string
          id?: string
          subject?: string
          title?: string
          topic?: string
          url?: string
        }
        Relationships: []
      }
      notebook_items: {
        Row: {
          difficulty: string | null
          grade: string | null
          id: number
          question_id: string
          rule_insight: string
          status: string
          subject: string | null
          topic_id: string | null
          updated_at: string
          user_id: string
          what_i_erred: string
        }
        Insert: {
          difficulty?: string | null
          grade?: string | null
          id?: number
          question_id: string
          rule_insight?: string
          status?: string
          subject?: string | null
          topic_id?: string | null
          updated_at?: string
          user_id: string
          what_i_erred?: string
        }
        Update: {
          difficulty?: string | null
          grade?: string | null
          id?: number
          question_id?: string
          rule_insight?: string
          status?: string
          subject?: string | null
          topic_id?: string | null
          updated_at?: string
          user_id?: string
          what_i_erred?: string
        }
        Relationships: [
          {
            foreignKeyName: "notebook_items_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          grade_level: string | null
          id: string
          last_login_at: string | null
          password: string
          role: string
          status: string
          username: string
        }
        Insert: {
          created_at?: string
          grade_level?: string | null
          id: string
          last_login_at?: string | null
          password: string
          role?: string
          status?: string
          username: string
        }
        Update: {
          created_at?: string
          grade_level?: string | null
          id?: string
          last_login_at?: string | null
          password?: string
          role?: string
          status?: string
          username?: string
        }
        Relationships: []
      }
      questions: {
        Row: {
          correct_index: number
          created_at: string
          difficulty: string
          explanation: string
          grade: string
          id: string
          options: Json
          statement: string
          status: string
          subject: string
          topic_id: string | null
          updated_at: string
        }
        Insert: {
          correct_index?: number
          created_at?: string
          difficulty?: string
          explanation?: string
          grade?: string
          id: string
          options?: Json
          statement?: string
          status?: string
          subject?: string
          topic_id?: string | null
          updated_at?: string
        }
        Update: {
          correct_index?: number
          created_at?: string
          difficulty?: string
          explanation?: string
          grade?: string
          id?: string
          options?: Json
          statement?: string
          status?: string
          subject?: string
          topic_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      replies: {
        Row: {
          author_role: string
          author_username: string
          comment_id: string
          created_at: string
          id: string
          text: string
        }
        Insert: {
          author_role?: string
          author_username?: string
          comment_id: string
          created_at?: string
          id: string
          text?: string
        }
        Update: {
          author_role?: string
          author_username?: string
          comment_id?: string
          created_at?: string
          id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "replies_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          admin_note: string
          created_at: string
          created_by: Json
          id: string
          message: string
          question_id: string
          question_meta: Json
          resolved_at: string | null
          resolved_by: Json | null
          status: string
          type: string
        }
        Insert: {
          admin_note?: string
          created_at?: string
          created_by?: Json
          id: string
          message?: string
          question_id: string
          question_meta?: Json
          resolved_at?: string | null
          resolved_by?: Json | null
          status?: string
          type?: string
        }
        Update: {
          admin_note?: string
          created_at?: string
          created_by?: Json
          id?: string
          message?: string
          question_id?: string
          question_meta?: Json
          resolved_at?: string | null
          resolved_by?: Json | null
          status?: string
          type?: string
        }
        Relationships: []
      }
      topics: {
        Row: {
          grade: string
          id: string
          label: string
          name: string
          status: string
          subject: string
        }
        Insert: {
          grade?: string
          id: string
          label: string
          name: string
          status?: string
          subject?: string
        }
        Update: {
          grade?: string
          id?: string
          label?: string
          name?: string
          status?: string
          subject?: string
        }
        Relationships: []
      }
      training_plans: {
        Row: {
          created_at: string
          distribution: Json
          id: string
          qty: number
          question_ids: Json
          topic: string
          user_id: string
        }
        Insert: {
          created_at?: string
          distribution?: Json
          id: string
          qty?: number
          question_ids?: Json
          topic?: string
          user_id: string
        }
        Update: {
          created_at?: string
          distribution?: Json
          id?: string
          qty?: number
          question_ids?: Json
          topic?: string
          user_id?: string
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
