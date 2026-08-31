/**
 * Hand-written to match `supabase/migrations/0001_init.sql`. Keep them in step.
 *
 * `Relationships`, `Views` and `Functions` are not optional decoration: postgrest-js
 * only accepts a schema that structurally satisfies its `GenericSchema`, and a schema
 * that does not resolves every selected row to `never` instead of failing. Deleting
 * any of them silently untypes every query in the app.
 */
export interface Database {
  public: {
    Tables: {
      app_settings: {
        Row: {
          id: boolean;
          gold_cap_per_character: number;
          gold_reset_weekday: number;
          reset_hour: number;
          server_timezone: string;
        };
        Insert: {
          id?: boolean;
          gold_cap_per_character?: number;
          gold_reset_weekday?: number;
          reset_hour?: number;
          server_timezone?: string;
        };
        Update: {
          id?: boolean;
          gold_cap_per_character?: number;
          gold_reset_weekday?: number;
          reset_hour?: number;
          server_timezone?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          discord_username: string | null;
          is_admin: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          discord_username?: string | null;
          is_admin?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          discord_username?: string | null;
          is_admin?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      game_accounts: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          name?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      characters: {
        Row: {
          id: string;
          game_account_id: string;
          name: string;
          class: string | null;
          sort_order: number;
        };
        Insert: {
          id?: string;
          game_account_id: string;
          name: string;
          class?: string | null;
          sort_order?: number;
        };
        Update: {
          id?: string;
          game_account_id?: string;
          name?: string;
          class?: string | null;
          sort_order?: number;
        };
        Relationships: [];
      };
      dungeons: {
        Row: {
          id: string;
          name: string;
          account_attempts: number;
          character_attempts: number;
          reset_weekday: number;
          quest_coverage: boolean;
          gold_solo: number;
          gold_story: number;
          gold_elite: number;
          gold_legend: number;
          sort_order: number;
          is_active: boolean;
        };
        Insert: {
          id?: string;
          name: string;
          account_attempts?: number;
          character_attempts?: number;
          reset_weekday?: number;
          quest_coverage?: boolean;
          gold_solo?: number;
          gold_story?: number;
          gold_elite?: number;
          gold_legend?: number;
          sort_order?: number;
          is_active?: boolean;
        };
        Update: {
          id?: string;
          name?: string;
          account_attempts?: number;
          character_attempts?: number;
          reset_weekday?: number;
          quest_coverage?: boolean;
          gold_solo?: number;
          gold_story?: number;
          gold_elite?: number;
          gold_legend?: number;
          sort_order?: number;
          is_active?: boolean;
        };
        Relationships: [];
      };
      character_dungeon: {
        Row: {
          character_id: string;
          dungeon_id: string;
          tier: 'none' | 'solo' | 'story' | 'elite' | 'legend';
          min_runs: number;
        };
        Insert: {
          character_id: string;
          dungeon_id: string;
          tier?: 'none' | 'solo' | 'story' | 'elite' | 'legend';
          min_runs?: number;
        };
        Update: {
          character_id?: string;
          dungeon_id?: string;
          tier?: 'none' | 'solo' | 'story' | 'elite' | 'legend';
          min_runs?: number;
        };
        Relationships: [];
      };
      runs: {
        Row: {
          id: string;
          character_id: string;
          dungeon_id: string;
          ran_at: string;
          gold_earned: number;
        };
        Insert: {
          id?: string;
          character_id: string;
          dungeon_id: string;
          ran_at?: string;
          gold_earned: number;
        };
        Update: {
          id?: string;
          character_id?: string;
          dungeon_id?: string;
          ran_at?: string;
          gold_earned?: number;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
    };
    Enums: {
      tier: 'none' | 'solo' | 'story' | 'elite' | 'legend';
    };
    CompositeTypes: Record<string, never>;
  };
}
