export type EquipmentStatus = "charging" | "ready" | "in-use" | "at-clinic" | "maintenance"
export type Location = "office" | "clinic"
export type AlertType = "charge-complete" | "deep-charge-needed" | "overdue-charge" | "maintenance-due" | "clinic-idle" | "battery-calibration"
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
  notes?: string
  clinicName?: string
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
}
