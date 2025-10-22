export type EquipmentStatus = "charging" | "ready" | "in-use" | "at-clinic" | "maintenance"
export type Location = "office" | "clinic"
export type AlertType = "charge-complete" | "deep-charge-needed" | "overdue-charge" | "maintenance-due" | "clinic-idle" | "battery-calibration" | "deep-charge-complete" | "manual-disconnect"
export type AlertSeverity = "info" | "warning" | "critical"

export interface Equipment {
  id: string
  code: string
  model: string
  lot: string
  status: EquipmentStatus
  location: Location
  batteryLevel: number
  chargingStartTime: string | null
  lastChargedDate: string | null
  lastUsedDate: string | null
  lastDisconnectedAt: string | null
  isDeepCharge: boolean
  needsManualDisconnection?: boolean
  notes?: string
  clinicName?: string
  clinicCity?: string
  createdAt?: string
  updatedAt?: string
}

export interface Alert {
  id: string
  equipmentId: string
  equipmentCode: string
  type: AlertType
  severity: AlertSeverity
  message: string
  timestamp: string
  dismissed: boolean
  dismissedAt?: string | null
  dismissedBy?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface EquipmentHistory {
  id: string
  equipmentId: string
  action: string
  oldValue?: any | null
  newValue?: any | null
  changedBy?: string | null
  notes?: string | null
  createdAt: string
}

// Database row types (snake_case from Supabase)
export interface EquipmentRow {
  id: string
  code: string
  model: string
  lot: string
  status: EquipmentStatus
  location: Location
  battery_level: number
  charging_start_time: string | null
  last_charged_date: string | null
  last_used_date: string | null
  last_disconnected_at: string | null
  is_deep_charge: boolean
  needs_manual_disconnection: boolean | null
  notes: string | null
  clinic_name: string | null
  clinic_city: string | null
  created_at: string
  updated_at: string
}

export interface AlertRow {
  id: string
  equipment_id: string
  equipment_code: string
  type: AlertType
  severity: AlertSeverity
  message: string
  timestamp: string
  dismissed: boolean
  dismissed_at: string | null
  dismissed_by: string | null
  created_at: string
  updated_at: string
}
