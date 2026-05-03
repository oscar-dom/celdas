export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      auctions: {
        Row: {
          cell_id: number;
          created_at: string;
          current_highest_bid: number | null;
          current_highest_bidder_id: string | null;
          ends_at: string;
          final_price: number | null;
          id: string;
          opened_by: Database["public"]["Enums"]["auction_opener"];
          opened_by_user_id: string | null;
          original_ends_at: string;
          starting_price: number;
          starts_at: string;
          status: Database["public"]["Enums"]["auction_status"];
          winner_id: string | null;
        };
        Insert: {
          cell_id: number;
          created_at?: string;
          current_highest_bid?: number | null;
          current_highest_bidder_id?: string | null;
          ends_at: string;
          final_price?: number | null;
          id?: string;
          opened_by: Database["public"]["Enums"]["auction_opener"];
          opened_by_user_id?: string | null;
          original_ends_at: string;
          starting_price: number;
          starts_at?: string;
          status?: Database["public"]["Enums"]["auction_status"];
          winner_id?: string | null;
        };
        Update: {
          cell_id?: number;
          created_at?: string;
          current_highest_bid?: number | null;
          current_highest_bidder_id?: string | null;
          ends_at?: string;
          final_price?: number | null;
          id?: string;
          opened_by?: Database["public"]["Enums"]["auction_opener"];
          opened_by_user_id?: string | null;
          original_ends_at?: string;
          starting_price?: number;
          starts_at?: string;
          status?: Database["public"]["Enums"]["auction_status"];
          winner_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "auctions_cell_id_fkey";
            columns: ["cell_id"];
            isOneToOne: false;
            referencedRelation: "cells";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "auctions_current_highest_bidder_id_fkey";
            columns: ["current_highest_bidder_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "auctions_opened_by_user_id_fkey";
            columns: ["opened_by_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "auctions_winner_id_fkey";
            columns: ["winner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      bids: {
        Row: {
          amount: number;
          auction_id: string;
          bidder_id: string;
          id: string;
          is_winning: boolean;
          placed_at: string;
          stripe_payment_intent_id: string | null;
        };
        Insert: {
          amount: number;
          auction_id: string;
          bidder_id: string;
          id?: string;
          is_winning?: boolean;
          placed_at?: string;
          stripe_payment_intent_id?: string | null;
        };
        Update: {
          amount?: number;
          auction_id?: string;
          bidder_id?: string;
          id?: string;
          is_winning?: boolean;
          placed_at?: string;
          stripe_payment_intent_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "bids_auction_id_fkey";
            columns: ["auction_id"];
            isOneToOne: false;
            referencedRelation: "auctions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bids_bidder_id_fkey";
            columns: ["bidder_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      cell_ownership_history: {
        Row: {
          acquired_at: string;
          acquisition_price: number;
          acquisition_type: Database["public"]["Enums"]["acquisition_type"];
          cell_id: number;
          created_at: string;
          displayed_image_url: string | null;
          displayed_message: string | null;
          id: string;
          owner_id: string;
          sale_price: number | null;
          sold_at: string | null;
        };
        Insert: {
          acquired_at: string;
          acquisition_price: number;
          acquisition_type: Database["public"]["Enums"]["acquisition_type"];
          cell_id: number;
          created_at?: string;
          displayed_image_url?: string | null;
          displayed_message?: string | null;
          id?: string;
          owner_id: string;
          sale_price?: number | null;
          sold_at?: string | null;
        };
        Update: {
          acquired_at?: string;
          acquisition_price?: number;
          acquisition_type?: Database["public"]["Enums"]["acquisition_type"];
          cell_id?: number;
          created_at?: string;
          displayed_image_url?: string | null;
          displayed_message?: string | null;
          id?: string;
          owner_id?: string;
          sale_price?: number | null;
          sold_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "cell_ownership_history_cell_id_fkey";
            columns: ["cell_id"];
            isOneToOne: false;
            referencedRelation: "cells";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cell_ownership_history_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      cells: {
        Row: {
          acquired_at: string | null;
          current_acquisition_price: number | null;
          current_image_url: string | null;
          current_owner_id: string | null;
          expires_at: string | null;
          id: number;
          owner_message: string | null;
          status: Database["public"]["Enums"]["cell_status"];
          updated_at: string;
        };
        Insert: {
          acquired_at?: string | null;
          current_acquisition_price?: number | null;
          current_image_url?: string | null;
          current_owner_id?: string | null;
          expires_at?: string | null;
          id: number;
          owner_message?: string | null;
          status?: Database["public"]["Enums"]["cell_status"];
          updated_at?: string;
        };
        Update: {
          acquired_at?: string | null;
          current_acquisition_price?: number | null;
          current_image_url?: string | null;
          current_owner_id?: string | null;
          expires_at?: string | null;
          id?: number;
          owner_message?: string | null;
          status?: Database["public"]["Enums"]["cell_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cells_current_owner_id_fkey";
            columns: ["current_owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      fixed_price_listings: {
        Row: {
          buyer_id: string | null;
          cancelled_at: string | null;
          cell_id: number;
          id: string;
          listed_at: string;
          owner_id: string;
          price: number;
          sold_at: string | null;
          status: Database["public"]["Enums"]["listing_status"];
        };
        Insert: {
          buyer_id?: string | null;
          cancelled_at?: string | null;
          cell_id: number;
          id?: string;
          listed_at?: string;
          owner_id: string;
          price: number;
          sold_at?: string | null;
          status?: Database["public"]["Enums"]["listing_status"];
        };
        Update: {
          buyer_id?: string | null;
          cancelled_at?: string | null;
          cell_id?: number;
          id?: string;
          listed_at?: string;
          owner_id?: string;
          price?: number;
          sold_at?: string | null;
          status?: Database["public"]["Enums"]["listing_status"];
        };
        Relationships: [
          {
            foreignKeyName: "fixed_price_listings_buyer_id_fkey";
            columns: ["buyer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fixed_price_listings_cell_id_fkey";
            columns: ["cell_id"];
            isOneToOne: false;
            referencedRelation: "cells";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fixed_price_listings_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      moderation_queue: {
        Row: {
          cell_id: number;
          id: string;
          image_url: string;
          message: string | null;
          review_notes: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          status: Database["public"]["Enums"]["moderation_status"];
          submitted_at: string;
          submitted_by: string;
        };
        Insert: {
          cell_id: number;
          id?: string;
          image_url: string;
          message?: string | null;
          review_notes?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: Database["public"]["Enums"]["moderation_status"];
          submitted_at?: string;
          submitted_by: string;
        };
        Update: {
          cell_id?: number;
          id?: string;
          image_url?: string;
          message?: string | null;
          review_notes?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: Database["public"]["Enums"]["moderation_status"];
          submitted_at?: string;
          submitted_by?: string;
        };
        Relationships: [
          {
            foreignKeyName: "moderation_queue_cell_id_fkey";
            columns: ["cell_id"];
            isOneToOne: false;
            referencedRelation: "cells";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "moderation_queue_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "moderation_queue_submitted_by_fkey";
            columns: ["submitted_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          bio: string | null;
          created_at: string;
          display_name: string | null;
          id: string;
          is_admin: boolean;
          paypal_account_id: string | null;
          stripe_account_id: string | null;
          stripe_customer_id: string | null;
          updated_at: string;
          username: string;
        };
        Insert: {
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string;
          display_name?: string | null;
          id: string;
          is_admin?: boolean;
          paypal_account_id?: string | null;
          stripe_account_id?: string | null;
          stripe_customer_id?: string | null;
          updated_at?: string;
          username: string;
        };
        Update: {
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string;
          display_name?: string | null;
          id?: string;
          is_admin?: boolean;
          paypal_account_id?: string | null;
          stripe_account_id?: string | null;
          stripe_customer_id?: string | null;
          updated_at?: string;
          username?: string;
        };
        Relationships: [];
      };
      transactions: {
        Row: {
          amount: number;
          completed_at: string | null;
          created_at: string;
          currency: string;
          id: string;
          metadata: Json | null;
          provider: Database["public"]["Enums"]["payment_provider"];
          provider_transaction_id: string;
          related_auction_id: string | null;
          related_cell_id: number | null;
          status: Database["public"]["Enums"]["transaction_status"];
          system_fee: number;
          type: Database["public"]["Enums"]["transaction_type"];
          user_id: string;
        };
        Insert: {
          amount: number;
          completed_at?: string | null;
          created_at?: string;
          currency?: string;
          id?: string;
          metadata?: Json | null;
          provider: Database["public"]["Enums"]["payment_provider"];
          provider_transaction_id: string;
          related_auction_id?: string | null;
          related_cell_id?: number | null;
          status?: Database["public"]["Enums"]["transaction_status"];
          system_fee?: number;
          type: Database["public"]["Enums"]["transaction_type"];
          user_id: string;
        };
        Update: {
          amount?: number;
          completed_at?: string | null;
          created_at?: string;
          currency?: string;
          id?: string;
          metadata?: Json | null;
          provider?: Database["public"]["Enums"]["payment_provider"];
          provider_transaction_id?: string;
          related_auction_id?: string | null;
          related_cell_id?: number | null;
          status?: Database["public"]["Enums"]["transaction_status"];
          system_fee?: number;
          type?: Database["public"]["Enums"]["transaction_type"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "transactions_related_auction_id_fkey";
            columns: ["related_auction_id"];
            isOneToOne: false;
            referencedRelation: "auctions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transactions_related_cell_id_fkey";
            columns: ["related_cell_id"];
            isOneToOne: false;
            referencedRelation: "cells";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transactions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      is_admin: { Args: never; Returns: boolean };
    };
    Enums: {
      acquisition_type: "auction" | "fixed_price" | "initial";
      auction_opener: "admin" | "owner";
      auction_status: "active" | "completed" | "cancelled";
      cell_status: "locked" | "in_auction" | "owned" | "for_sale";
      listing_status: "active" | "sold" | "cancelled";
      moderation_status: "pending" | "approved" | "rejected";
      payment_provider: "stripe" | "paypal";
      transaction_status: "pending" | "completed" | "failed" | "refunded";
      transaction_type: "bid_payment" | "refund" | "system_fee" | "payout";
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      acquisition_type: ["auction", "fixed_price", "initial"],
      auction_opener: ["admin", "owner"],
      auction_status: ["active", "completed", "cancelled"],
      cell_status: ["locked", "in_auction", "owned", "for_sale"],
      listing_status: ["active", "sold", "cancelled"],
      moderation_status: ["pending", "approved", "rejected"],
      payment_provider: ["stripe", "paypal"],
      transaction_status: ["pending", "completed", "failed", "refunded"],
      transaction_type: ["bid_payment", "refund", "system_fee", "payout"],
    },
  },
} as const;
