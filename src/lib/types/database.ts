/* ══════════════════════════════════════════════
   Database Types for Whisper DND
   ══════════════════════════════════════════════ */

export type UserRole = 'player' | 'admin' | 'dm'

export interface Profile {
  id: string
  display_name: string | null
  display_name_set: boolean
  avatar_url: string | null
  background_url: string | null
  bio: string | null
  role: UserRole
  religion_id: string | null
  spirituality: number
  max_spirituality: number
  travel_points: number
  max_travel_points: number
  potion_digest_progress: number
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
  overview: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface SkillPathway {
  id: string
  type_id: string
  name: string
  description: string | null
  overview: string | null
  bg_url: string | null
  logo_url: string | null
  video_url: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface SkillSequence {
  id: string
  pathway_id: string
  seq_number: number
  name: string
  roleplay_keywords: string | null
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

export interface PathwayGrant {
  id: string
  player_id: string
  pathway_id: string
  granted_by: string | null
  created_at: string
}

export interface SkillUsageLog {
  id: string
  player_id: string
  skill_id: string
  spirit_cost: number
  reference_code: string
  note: string | null
  success_rate: number | null
  roll: number | null
  outcome: string | null
  used_at: string
}

export type SleepRequestStatus = 'pending' | 'approved' | 'rejected'

export interface SleepRequest {
  id: string
  player_id: string
  meal_url: string
  sleep_url: string
  status: SleepRequestStatus
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
}

export type SubmissionStatus = 'pending' | 'approved' | 'rejected'

export interface ActionCode {
  id: string
  name: string
  code: string
  reward_hp: number
  reward_sanity: number
  reward_travel: number
  reward_spirituality: number
  reward_max_sanity: number
  reward_max_travel: number
  reward_max_spirituality: number
  expires_at: string | null
  max_repeats: number | null
  archived: boolean
  created_by: string
  created_at: string
}

export interface QuestCode {
  id: string
  name: string
  code: string
  map_id: string | null
  npc_token_id: string | null
  expires_at: string | null
  max_repeats: number | null
  archived: boolean
  created_by: string
  created_at: string
}

/* ═══════════ Punishment System ═══════════ */

export interface Punishment {
  id: string
  name: string
  description: string | null
  penalty_sanity: number
  penalty_hp: number
  penalty_travel: number
  penalty_spirituality: number
  penalty_max_sanity: number
  penalty_max_travel: number
  penalty_max_spirituality: number
  deadline: string | null
  is_active: boolean
  archived: boolean
  created_by: string
  created_at: string
  updated_at: string
}

export interface PunishmentRequiredTask {
  id: string
  punishment_id: string
  action_code_id: string | null
  quest_code_id: string | null
  created_at: string
}

export interface PunishmentPlayer {
  id: string
  punishment_id: string
  player_id: string
  is_completed: boolean
  penalty_applied: boolean
  mercy_requested: boolean
  mercy_requested_at: string | null
  completed_at: string | null
  created_at: string
}

export interface PunishmentLog {
  id: string
  punishment_id: string
  player_id: string
  action: string
  details: Record<string, unknown>
  created_by: string | null
  created_at: string
}

export interface ActionSubmission {
  id: string
  player_id: string
  action_code_id: string
  evidence_urls: string[]
  status: SubmissionStatus
  rejection_reason: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
}

export interface QuestSubmission {
  id: string
  player_id: string
  quest_code_id: string
  evidence_urls: string[]
  status: SubmissionStatus
  rejection_reason: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
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
  interaction_radius: number
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

/* ═══════════ Religion System ═══════════ */

export interface Religion {
  id: string
  name_th: string
  name_en: string
  deity_th: string | null
  deity_en: string | null
  overview: string | null
  teachings: string | null
  bg_url: string | null
  logo_url: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface MapChurch {
  id: string
  map_id: string
  religion_id: string
  position_x: number
  position_y: number
  radius: number
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface MapChurchWithReligion extends MapChurch {
  religion_name_th: string
  religion_logo_url: string | null
}

export interface MapRestPoint {
  id: string
  map_id: string
  name: string
  image_url: string | null
  radius: number
  position_x: number
  position_y: number
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface PrayerLog {
  id: string
  player_id: string
  church_id: string
  evidence_urls: string[]
  sanity_gained: number
  created_at: string
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
          background_url?: string | null
          bio?: string | null
          role?: UserRole
          spirituality?: number
          max_spirituality?: number
          travel_points?: number
          max_travel_points?: number
          potion_digest_progress?: number
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
          background_url?: string | null
          bio?: string | null
          role?: UserRole
          spirituality?: number
          max_spirituality?: number
          travel_points?: number
          max_travel_points?: number
          potion_digest_progress?: number
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
          video_url?: string | null
          sort_order?: number
        }
        Update: {
          name?: string
          description?: string | null
          bg_url?: string | null
          logo_url?: string | null
          video_url?: string | null
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
      pathway_grants: {
        Row: PathwayGrant
        Insert: {
          id?: string
          player_id: string
          pathway_id: string
          granted_by?: string | null
        }
        Update: {
          pathway_id?: string
          granted_by?: string | null
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
          interaction_radius?: number
          created_by?: string | null
        }
        Update: {
          map_id?: string
          position_x?: number
          position_y?: number
          interaction_radius?: number
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
