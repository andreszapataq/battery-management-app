import type { Equipment, Alert } from "@/types/equipment"

export function updateEquipmentStatuses(equipment: Equipment[]): Equipment[] {
  const now = new Date()
  return equipment.map((eq) => {
    if (eq.status === "charging" && eq.chargingStartTime) {
      const startTime = new Date(eq.chargingStartTime)
      const hoursCharging = (now.getTime() - startTime.getTime()) / (1000 * 60 * 60)

      const targetHours = eq.isDeepCharge ? 12 : 8
      const batteryLevel = Math.min(100, Math.floor((hoursCharging / targetHours) * 100))

      // Auto-complete charging when target time is reached
      if (hoursCharging >= targetHours && batteryLevel >= 100) {
        // If it's a deep charge at clinic, return to at-clinic status
        if (eq.isDeepCharge && eq.location === "clinic") {
          return {
            ...eq,
            status: "at-clinic" as const,
            batteryLevel: 100,
            chargingStartTime: null,
            lastChargedDate: now.toISOString(),
            lastUsedDate: now.toISOString(), // Reset the days counter
            isDeepCharge: false,
          }
        } else {
          // Normal charging at office
          return {
            ...eq,
            status: "ready" as const,
            batteryLevel: 100,
            chargingStartTime: null,
            lastChargedDate: now.toISOString(),
            isDeepCharge: false,
          }
        }
      }

      return { ...eq, batteryLevel }
    }

    // Simulate battery drain for idle equipment
    if (eq.status === "at-clinic" && eq.lastDisconnectedAt && !eq.chargingStartTime) {
      const lastDisconnected = new Date(eq.lastDisconnectedAt)
      const hoursIdle = (now.getTime() - lastDisconnected.getTime()) / (1000 * 60 * 60)
      
      // Battery drains 2% per hour when idle (48% per day)
      const batteryDrain = Math.floor(hoursIdle * 2)
      const newBatteryLevel = Math.max(0, eq.batteryLevel - batteryDrain)
      
      return { ...eq, batteryLevel: newBatteryLevel }
    }

    // Simulate battery drain for ready equipment at office
    if (eq.status === "ready" && eq.lastUsedDate && !eq.chargingStartTime) {
      const lastUsed = new Date(eq.lastUsedDate)
      const hoursIdle = (now.getTime() - lastUsed.getTime()) / (1000 * 60 * 60)
      
      // Battery drains 1% per hour when idle at office (24% per day)
      const batteryDrain = Math.floor(hoursIdle * 1)
      const newBatteryLevel = Math.max(0, eq.batteryLevel - batteryDrain)
      
      return { ...eq, batteryLevel: newBatteryLevel }
    }

    return eq
  })
}

export function checkAlerts(equipment: Equipment[]): Alert[] {
  const alerts: Alert[] = []
  const now = new Date()

  equipment.forEach((eq) => {
    // Check if charging is complete
    if (eq.status === "charging" && eq.chargingStartTime) {
      const startTime = new Date(eq.chargingStartTime)
      const hoursCharging = (now.getTime() - startTime.getTime()) / (1000 * 60 * 60)
      const targetHours = eq.isDeepCharge ? 12 : 8

      if (hoursCharging >= targetHours) {
        if (eq.isDeepCharge) {
          alerts.push({
            id: `${eq.id}-deep-charge-complete-${Date.now()}`,
            equipmentId: eq.id,
            equipmentCode: eq.code,
            type: "deep-charge-complete",
            severity: "info",
            message: `Equipo ${eq.code} ha completado la carga profunda de 12 horas. Contador de días reiniciado.`,
            timestamp: now.toISOString(),
            dismissed: false,
          })
        } else {
          alerts.push({
            id: `${eq.id}-charge-complete-${Date.now()}`,
            equipmentId: eq.id,
            equipmentCode: eq.code,
            type: "charge-complete",
            severity: "info",
            message: `Equipo ${eq.code} ha completado la carga normal (8h)`,
            timestamp: now.toISOString(),
            dismissed: false,
          })
        }
      }
    }

    // Check if deep charge is needed (5 days without use)
    if (eq.status === "ready" && eq.lastUsedDate) {
      const lastUsed = new Date(eq.lastUsedDate)
      const daysSinceUse = (now.getTime() - lastUsed.getTime()) / (1000 * 60 * 60 * 24)

      if (daysSinceUse >= 5) {
        alerts.push({
          id: `${eq.id}-deep-charge-${Date.now()}`,
          equipmentId: eq.id,
          equipmentCode: eq.code,
          type: "deep-charge-needed",
          severity: "warning",
          message: `Equipo ${eq.code} lleva ${Math.floor(daysSinceUse)} días sin uso. Requiere carga profunda manual de 12 horas para despegar la batería`,
          timestamp: now.toISOString(),
          dismissed: false,
        })
      }
    }

    // Check if equipment is currently in deep charge mode
    if (eq.status === "charging" && eq.isDeepCharge) {
      const startTime = new Date(eq.chargingStartTime!)
      const hoursCharging = (now.getTime() - startTime.getTime()) / (1000 * 60 * 60)
      
      if (hoursCharging < 12) {
        alerts.push({
          id: `${eq.id}-deep-charging-${Date.now()}`,
          equipmentId: eq.id,
          equipmentCode: eq.code,
          type: "battery-calibration",
          severity: "info",
          message: `Equipo ${eq.code} en proceso de despegue de batería (${Math.floor(hoursCharging)}h/12h). Calibración en curso para optimizar rendimiento`,
          timestamp: now.toISOString(),
          dismissed: false,
        })
      }
    }

    // Check if deep charge completed and battery calibration is done
    if (eq.status === "ready" && eq.lastChargedDate) {
      const lastCharged = new Date(eq.lastChargedDate)
      const hoursSinceCharged = (now.getTime() - lastCharged.getTime()) / (1000 * 60 * 60)
      
      // If it was a deep charge and completed recently, show calibration success
      if (hoursSinceCharged < 1 && eq.batteryLevel === 100) {
        alerts.push({
          id: `${eq.id}-calibration-complete-${Date.now()}`,
          equipmentId: eq.id,
          equipmentCode: eq.code,
          type: "battery-calibration",
          severity: "info",
          message: `Equipo ${eq.code} completó calibración de batería exitosamente. Batería despegada y optimizada`,
          timestamp: now.toISOString(),
          dismissed: false,
        })
      }
    }

    // Check if equipment has been charging too long
    if (eq.status === "charging" && eq.chargingStartTime) {
      const startTime = new Date(eq.chargingStartTime)
      const now = new Date()
      const hoursCharging = (now.getTime() - startTime.getTime()) / (1000 * 60 * 60)
      const targetHours = eq.isDeepCharge ? 12 : 8

      if (hoursCharging > targetHours + 2) {
        alerts.push({
          id: `${eq.id}-overdue-${Date.now()}`,
          equipmentId: eq.id,
          equipmentCode: eq.code,
          type: "overdue-charge",
          severity: "critical",
          message: `Equipo ${eq.code} lleva ${Math.floor(hoursCharging)} horas cargando. Debe ser desconectado`,
          timestamp: now.toISOString(),
          dismissed: false,
        })
      }
    }

    if (eq.status === "at-clinic" && eq.lastDisconnectedAt) {
      const lastDisconnected = new Date(eq.lastDisconnectedAt)
      const daysIdle = (now.getTime() - lastDisconnected.getTime()) / (1000 * 60 * 60 * 24)

      // Only generate one alert per equipment, prioritize by importance
      if (daysIdle >= 5) {
        // Priority 1: Deep charge needed (most important)
        alerts.push({
          id: `${eq.id}-clinic-idle-${Date.now()}`,
          equipmentId: eq.id,
          equipmentCode: eq.code,
          type: "clinic-idle",
          severity: "warning",
          message: `Equipo ${eq.code} (${eq.model}) - Lote: ${eq.lot} lleva ${Math.floor(daysIdle)} días desconectado en ${eq.clinicName || "clínica"}. Batería: ${eq.batteryLevel}%. Requiere carga profunda manual`,
          timestamp: now.toISOString(),
          dismissed: false,
        })
      } else if (eq.batteryLevel <= 20 && eq.batteryLevel > 0) {
        // Priority 2: Low battery (only if not already needing deep charge)
        alerts.push({
          id: `${eq.id}-low-battery-clinic-${Date.now()}`,
          equipmentId: eq.id,
          equipmentCode: eq.code,
          type: "overdue-charge",
          severity: "warning",
          message: `Equipo ${eq.code} (${eq.model}) - Lote: ${eq.lot} en ${eq.clinicName || "clínica"} tiene batería baja (${eq.batteryLevel}%). Requiere carga urgente`,
          timestamp: now.toISOString(),
          dismissed: false,
        })
      }
    }
  })

  return alerts
}

export function getChargingProgress(equipment: Equipment): number {
  if (!equipment.chargingStartTime) return 0

  const startTime = new Date(equipment.chargingStartTime)
  const now = new Date()
  const hoursCharging = (now.getTime() - startTime.getTime()) / (1000 * 60 * 60)
  const targetHours = equipment.isDeepCharge ? 12 : 8

  return Math.min(100, (hoursCharging / targetHours) * 100)
}

export function getTimeRemaining(equipment: Equipment): string {
  if (!equipment.chargingStartTime) return "N/A"

  const startTime = new Date(equipment.chargingStartTime)
  const now = new Date()
  const hoursCharging = (now.getTime() - startTime.getTime()) / (1000 * 60 * 60)
  const targetHours = equipment.isDeepCharge ? 12 : 8
  const hoursRemaining = Math.max(0, targetHours - hoursCharging)

  if (hoursRemaining === 0) return "Completado"

  const hours = Math.floor(hoursRemaining)
  const minutes = Math.floor((hoursRemaining - hours) * 60)

  return `${hours}h ${minutes}m`
}

export function getDaysSinceLastUse(equipment: Equipment): number {
  if (!equipment.lastUsedDate) return 0

  const lastUsed = new Date(equipment.lastUsedDate)
  const now = new Date()
  return Math.floor((now.getTime() - lastUsed.getTime()) / (1000 * 60 * 60 * 24))
}
