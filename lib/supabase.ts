import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tojmcjquouwhveyutkao.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRvam1janF1b3V3aHZleXV0a2FvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4NTMwOTYsImV4cCI6MjA3NjQyOTA5Nn0.ZCGnRHJrNEgkjtZYxT18BueFdC00mCekDoC3pLfn8dg'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
})

// Database types
export interface Database {
  public: {
    Tables: {
      equipment: {
        Row: {
          id: string
          code: string
          model: string
          lot: string
          status: 'charging' | 'ready' | 'in-use' | 'at-clinic' | 'maintenance'
          location: 'office' | 'clinic'
          battery_level: number
          charging_start_time: string | null
          last_charged_date: string | null
          last_used_date: string | null
          last_disconnected_at: string | null
          is_deep_charge: boolean
          notes: string | null
          clinic_name: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          code: string
          model: string
          lot: string
          status: 'charging' | 'ready' | 'in-use' | 'at-clinic' | 'maintenance'
          location: 'office' | 'clinic'
          battery_level?: number
          charging_start_time?: string | null
          last_charged_date?: string | null
          last_used_date?: string | null
          last_disconnected_at?: string | null
          is_deep_charge?: boolean
          notes?: string | null
          clinic_name?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          code?: string
          model?: string
          lot?: string
          status?: 'charging' | 'ready' | 'in-use' | 'at-clinic' | 'maintenance'
          location?: 'office' | 'clinic'
          battery_level?: number
          charging_start_time?: string | null
          last_charged_date?: string | null
          last_used_date?: string | null
          last_disconnected_at?: string | null
          is_deep_charge?: boolean
          notes?: string | null
          clinic_name?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      alerts: {
        Row: {
          id: string
          equipment_id: string
          equipment_code: string
          type: 'charge-complete' | 'deep-charge-needed' | 'overdue-charge' | 'maintenance-due' | 'clinic-idle' | 'battery-calibration'
          severity: 'info' | 'warning' | 'critical'
          message: string
          timestamp: string
          dismissed: boolean
          dismissed_at: string | null
          dismissed_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          equipment_id: string
          equipment_code: string
          type: 'charge-complete' | 'deep-charge-needed' | 'overdue-charge' | 'maintenance-due' | 'clinic-idle' | 'battery-calibration'
          severity: 'info' | 'warning' | 'critical'
          message: string
          timestamp?: string
          dismissed?: boolean
          dismissed_at?: string | null
          dismissed_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          equipment_id?: string
          equipment_code?: string
          type?: 'charge-complete' | 'deep-charge-needed' | 'overdue-charge' | 'maintenance-due' | 'clinic-idle' | 'battery-calibration'
          severity?: 'info' | 'warning' | 'critical'
          message?: string
          timestamp?: string
          dismissed?: boolean
          dismissed_at?: string | null
          dismissed_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      equipment_history: {
        Row: {
          id: string
          equipment_id: string
          action: string
          old_value: any | null
          new_value: any | null
          changed_by: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          equipment_id: string
          action: string
          old_value?: any | null
          new_value?: any | null
          changed_by?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          equipment_id?: string
          action?: string
          old_value?: any | null
          new_value?: any | null
          changed_by?: string | null
          notes?: string | null
          created_at?: string
        }
      }
    }
    Views: {
      equipment_with_alert_counts: {
        Row: {
          id: string
          code: string
          model: string
          lot: string
          status: 'charging' | 'ready' | 'in-use' | 'at-clinic' | 'maintenance'
          location: 'office' | 'clinic'
          battery_level: number
          charging_start_time: string | null
          last_charged_date: string | null
          last_used_date: string | null
          last_disconnected_at: string | null
          is_deep_charge: boolean
          notes: string | null
          clinic_name: string | null
          created_at: string
          updated_at: string
          active_alerts_count: number
          critical_alerts_count: number
        }
      }
    }
    Functions: {
      get_equipment_needing_deep_charge: {
        Args: Record<PropertyKey, never>
        Returns: {
          equipment_id: string
          equipment_code: string
          days_since_use: number
          last_used_date: string
        }[]
      }
      get_equipment_alerts: {
        Args: {
          p_equipment_id: string
        }
        Returns: {
          alert_id: string
          alert_type: string
          severity: string
          message: string
          alert_timestamp: string
          dismissed: boolean
        }[]
      }
      log_equipment_change: {
        Args: {
          p_equipment_id: string
          p_action: string
          p_old_value?: any | null
          p_new_value?: any | null
          p_notes?: string | null
        }
        Returns: string
      }
    }
  }
}
