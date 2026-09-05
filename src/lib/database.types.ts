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
          stone_rate: number;
          /** Absent until migration 0010 has run, so read it defensively. */
          max_characters?: number;
        };
        Insert: {
          id?: boolean;
          gold_cap_per_character?: number;
          gold_reset_weekday?: number;
          reset_hour?: number;
          server_timezone?: string;
          stone_rate?: number;
          max_characters?: number;
        };
        Update: {
          id?: boolean;
          gold_cap_per_character?: number;
          gold_reset_weekday?: number;
          reset_hour?: number;
          server_timezone?: string;
          stone_rate?: number;
          max_characters?: number;
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
          is_active: boolean;
        };
        Insert: {
          id?: string;
          game_account_id: string;
          name: string;
          class?: string | null;
          sort_order?: number;
          is_active?: boolean;
        };
        Update: {
          id?: string;
          game_account_id?: string;
          name?: string;
          class?: string | null;
          sort_order?: number;
          is_active?: boolean;
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
          gold_solo_stone: number;
          gold_story_stone: number;
          gold_elite_stone: number;
          gold_legend_stone: number;
          manual: boolean;
          gold_solo: number;
          gold_story: number;
          gold_elite: number;
          gold_legend: number;
          sort_order: number;
          is_active: boolean;
          default_tier: 'none' | 'solo' | 'story' | 'elite' | 'legend';
          default_min_runs: number;
          group_name: string | null;
          short_name: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          account_attempts?: number;
          character_attempts?: number;
          reset_weekday?: number;
          gold_solo_stone?: number;
          gold_story_stone?: number;
          gold_elite_stone?: number;
          gold_legend_stone?: number;
          manual?: boolean;
          gold_solo?: number;
          gold_story?: number;
          gold_elite?: number;
          gold_legend?: number;
          sort_order?: number;
          is_active?: boolean;
          default_tier?: 'none' | 'solo' | 'story' | 'elite' | 'legend';
          default_min_runs?: number;
          group_name?: string | null;
          short_name?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          account_attempts?: number;
          character_attempts?: number;
          reset_weekday?: number;
          gold_solo_stone?: number;
          gold_story_stone?: number;
          gold_elite_stone?: number;
          gold_legend_stone?: number;
          manual?: boolean;
          gold_solo?: number;
          gold_story?: number;
          gold_elite?: number;
          gold_legend?: number;
          sort_order?: number;
          is_active?: boolean;
          default_tier?: 'none' | 'solo' | 'story' | 'elite' | 'legend';
          default_min_runs?: number;
          group_name?: string | null;
          short_name?: string | null;
        };
        Relationships: [];
      };
      character_dungeon: {
        Row: {
          character_id: string;
          dungeon_id: string;
          tier: 'none' | 'solo' | 'story' | 'elite' | 'legend';
          min_runs: number;
          max_runs: number | null;
        };
        Insert: {
          character_id: string;
          dungeon_id: string;
          tier?: 'none' | 'solo' | 'story' | 'elite' | 'legend';
          min_runs?: number;
          max_runs?: number | null;
        };
        Update: {
          character_id?: string;
          dungeon_id?: string;
          tier?: 'none' | 'solo' | 'story' | 'elite' | 'legend';
          min_runs?: number;
          max_runs?: number | null;
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
