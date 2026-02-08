/* ══════════════════════════════════════════════
   Database Types for Whisper DND
   ══════════════════════════════════════════════ */

export type UserRole = 'player' | 'admin' | 'dm'

export interface Profile {
  id: string
  display_name: string | null
  avatar_url: string | null
  role: UserRole
  spirituality: number
  max_spirituality: number
  travel_points: number
  max_travel_points: number
  hp: number
  sanity: number
  max_sanity: number
  sanity_last_decay: string
  created_at: string
  updated_at: string
}

export interface SkillType {
  id: string
  name: string
  description: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface SkillPathway {
  id: string
  type_id: string
  name: string
  description: string | null
  bg_url: string | null
  logo_url: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface SkillSequence {
  id: string
  pathway_id: string
  seq_number: number
  name: string
  created_at: string
  updated_at: string
}

export interface Skill {
  id: string
  pathway_id: string
  sequence_id: string
  name: string
  description: string | null
  spirit_cost: number
  icon_url: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface PlayerPathway {
  id: string
  player_id: string
  pathway_id: string | null
  sequence_id: string | null
  created_at: string
  updated_at: string
}

export interface SkillUsageLog {
  id: string
  player_id: string
  skill_id: string
  spirit_cost: number
  used_at: string
}

export interface GameMap {
  id: string
  name: string
  description: string | null
  image_url: string
  sort_order: number
  embed_enabled: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export type TokenType = 'player' | 'npc'

export interface MapToken {
  id: string
  map_id: string
  user_id: string | null
  npc_name: string | null
  npc_image_url: string | null
  token_type: TokenType
  position_x: number
  position_y: number
  created_by: string | null
  created_at: string
  updated_at: string
}

/* MapToken joined with profile data for rendering */
export interface MapTokenWithProfile extends MapToken {
  display_name: string | null
  avatar_url: string | null
  role: UserRole | null
}

export interface MapLockedZone {
  id: string
  map_id: string
  zone_x: number
  zone_y: number
  zone_width: number
  zone_height: number
  message: string
  allowed_user_ids: string[]
  created_by: string | null
  created_at: string
  updated_at: string
}

/* Supabase Database type helper */
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: {
          id: string
          display_name?: string | null
          avatar_url?: string | null
          role?: UserRole
          spirituality?: number
          max_spirituality?: number
          travel_points?: number
          max_travel_points?: number
          hp?: number
          sanity?: number
          max_sanity?: number
          sanity_last_decay?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          display_name?: string | null
          avatar_url?: string | null
          role?: UserRole
          spirituality?: number
          max_spirituality?: number
          travel_points?: number
          max_travel_points?: number
          hp?: number
          sanity?: number
          max_sanity?: number
          sanity_last_decay?: string
          updated_at?: string
        }
      }
      skill_types: {
        Row: SkillType
        Insert: {
          id?: string
          name: string
          description?: string | null
          sort_order?: number
        }
        Update: {
          name?: string
          description?: string | null
          sort_order?: number
        }
      }
      skill_pathways: {
        Row: SkillPathway
        Insert: {
          id?: string
          type_id: string
          name: string
          description?: string | null
          bg_url?: string | null
          logo_url?: string | null
          sort_order?: number
        }
        Update: {
          name?: string
          description?: string | null
          bg_url?: string | null
          logo_url?: string | null
          sort_order?: number
        }
      }
      skill_sequences: {
        Row: SkillSequence
        Insert: {
          id?: string
          pathway_id: string
          seq_number: number
          name: string
        }
        Update: {
          seq_number?: number
          name?: string
        }
      }
      skills: {
        Row: Skill
        Insert: {
          id?: string
          pathway_id: string
          sequence_id: string
          name: string
          description?: string | null
          spirit_cost?: number
          icon_url?: string | null
          sort_order?: number
        }
        Update: {
          name?: string
          description?: string | null
          spirit_cost?: number
          icon_url?: string | null
          sort_order?: number
          sequence_id?: string
        }
      }
      player_pathways: {
        Row: PlayerPathway
        Insert: {
          id?: string
          player_id: string
          pathway_id?: string | null
          sequence_id?: string | null
        }
        Update: {
          pathway_id?: string | null
          sequence_id?: string | null
        }
      }
      maps: {
        Row: GameMap
        Insert: {
          id?: string
          name: string
          description?: string | null
          image_url: string
          sort_order?: number
          embed_enabled?: boolean
          created_by?: string | null
        }
        Update: {
          name?: string
          description?: string | null
          image_url?: string
          sort_order?: number
          embed_enabled?: boolean
        }
      }
      map_tokens: {
        Row: MapToken
        Insert: {
          id?: string
          map_id: string
          user_id?: string | null
          npc_name?: string | null
          npc_image_url?: string | null
          token_type?: TokenType
          position_x?: number
          position_y?: number
          created_by?: string | null
        }
        Update: {
          map_id?: string
          position_x?: number
          position_y?: number
        }
      }
      map_locked_zones: {
        Row: MapLockedZone
        Insert: {
          id?: string
          map_id: string
          zone_x: number
          zone_y: number
          zone_width: number
          zone_height: number
          message?: string
          allowed_user_ids?: string[]
          created_by?: string | null
        }
        Update: {
          zone_x?: number
          zone_y?: number
          zone_width?: number
          zone_height?: number
          message?: string
          allowed_user_ids?: string[]
        }
      }
    }
    Enums: {
      user_role: UserRole
    }
  }
}
