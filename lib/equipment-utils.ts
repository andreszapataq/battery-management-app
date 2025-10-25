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
        // If it's a deep charge at clinic, implement grace period
        if (eq.isDeepCharge && eq.location === "clinic") {
          // Grace period: 2 hours after completion (14 hours total)
          if (hoursCharging >= 14) {
            // Auto-disconnect after grace period
            return {
              ...eq,
              status: "at-clinic" as const,
              batteryLevel: 100,
              chargingStartTime: null,
              lastChargedDate: now.toISOString(),
              lastUsedDate: now.toISOString(), // Reset the days counter
              isDeepCharge: false,
              needsManualDisconnection: false,
            }
          } else {
            // Still in grace period - mark as completed but keep charging
            return {
              ...eq,
              batteryLevel: 100,
              needsManualDisconnection: true,
            }
          }
        } else {
          // Normal charging at office - immediate completion
          return {
            ...eq,
            status: "ready" as const,
            batteryLevel: 100,
            chargingStartTime: null,
            lastChargedDate: now.toISOString(),
            lastUsedDate: now.toISOString(), // Reset the days counter for normal charging too
            isDeepCharge: false,
          }
        }
      }

      return { ...eq, batteryLevel }
    }

    // Equipment at clinic maintains 100% battery until connected to patient
    // Only drain battery when actually in use (status = "in-use")
    if (eq.status === "at-clinic") {
      // Keep battery at 100% when idle at clinic
      return { ...eq, batteryLevel: 100 }
    }

    // Equipment ready at office maintains 100% battery until used
    // Same behavior as clinic equipment - show days remaining instead of battery drain
    if (eq.status === "ready") {
      // Keep battery at 100% when idle at office
      return { ...eq, batteryLevel: 100 }
    }

    // Simulate battery drain for equipment in use (connected to patient)
    if (eq.status === "in-use" && eq.lastUsedDate && !eq.chargingStartTime) {
      const lastUsed = new Date(eq.lastUsedDate)
      const hoursInUse = (now.getTime() - lastUsed.getTime()) / (1000 * 60 * 60)
      
      // Battery drains 3% per hour when in use (72% per day)
      const batteryDrain = Math.floor(hoursInUse * 3)
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
    // Generate alerts for equipment that needs deep charge based on days idle
    if (eq.status === "ready" || eq.status === "at-clinic") {
      let daysSinceLastActivity = 0
      
      // For equipment at clinic, use lastDisconnectedAt
      if (eq.status === "at-clinic" && eq.lastDisconnectedAt) {
        const lastDisconnected = new Date(eq.lastDisconnectedAt)
        daysSinceLastActivity = (now.getTime() - lastDisconnected.getTime()) / (1000 * 60 * 60 * 24)
      }
      // For equipment at office, use lastUsedDate
      else if (eq.lastUsedDate) {
        const lastUsed = new Date(eq.lastUsedDate)
        daysSinceLastActivity = (now.getTime() - lastUsed.getTime()) / (1000 * 60 * 60 * 24)
      }

      if (daysSinceLastActivity >= 5) {
        alerts.push({
          id: `${eq.id}-deep-charge-${Date.now()}`,
          equipmentId: eq.id,
          equipmentCode: eq.code,
          type: "deep-charge-needed",
          severity: "warning",
          message: `Equipo ${eq.code} lleva ${Math.floor(daysSinceLastActivity)} días sin uso. Requiere carga profunda manual de 12 horas para despegar la batería`,
          timestamp: now.toISOString(),
          dismissed: false,
        })
      }
    }

    // Check if equipment is currently in deep charge mode
    // Only show calibration alerts for equipment that has been used before (not brand new)
    if (eq.status === "charging" && eq.isDeepCharge && eq.lastUsedDate) {
      const startTime = new Date(eq.chargingStartTime!)
      const lastUsed = new Date(eq.lastUsedDate)
      const hoursCharging = (now.getTime() - startTime.getTime()) / (1000 * 60 * 60)
      
      // Only show calibration alert if the equipment has been used before
      // (not a brand new equipment that was just created)
      const isNewEquipment = Math.abs(startTime.getTime() - lastUsed.getTime()) < 60000 // Less than 1 minute difference
      
      if (hoursCharging < 12 && !isNewEquipment) {
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

    // Check if equipment needs manual disconnection after deep charge completion
    if (eq.status === "charging" && eq.needsManualDisconnection) {
      const startTime = new Date(eq.chargingStartTime!)
      const hoursCharging = (now.getTime() - startTime.getTime()) / (1000 * 60 * 60)
      const completionTime = new Date(startTime.getTime() + 12 * 60 * 60 * 1000)
      
      alerts.push({
        id: `${eq.id}-manual-disconnect`,
        equipmentId: eq.id,
        equipmentCode: eq.code,
        type: "manual-disconnect",
        severity: hoursCharging >= 13 ? "critical" : "warning", // Critical after 13 hours
        message: `Equipo ${eq.code} completó carga profunda a las ${completionTime.toLocaleTimeString("es-ES", { hour: '2-digit', minute: '2-digit' })}. ${hoursCharging >= 13 ? 'URGENTE: ' : ''}Desconectar manualmente para liberar el cargador${hoursCharging >= 13 ? ' (auto-desconexión en 1 hora)' : ''}`,
        timestamp: now.toISOString(),
        dismissed: false,
      })
    }

    // Check if deep charge completed and battery calibration is done
    // Only show calibration success alerts for equipment that actually went through a deep charge process
    if (eq.status === "ready" && eq.lastChargedDate && eq.lastUsedDate) {
      const lastCharged = new Date(eq.lastChargedDate)
      const lastUsed = new Date(eq.lastUsedDate)
      const hoursSinceCharged = (now.getTime() - lastCharged.getTime()) / (1000 * 60 * 60)
      
      // Only show calibration success if:
      // 1. It was charged recently (within 1 hour)
      // 2. Battery is at 100%
      // 3. The equipment has been used before (not a brand new equipment)
      // 4. The last used date is different from last charged date (indicating it went through a real process)
      const isNewEquipment = Math.abs(lastCharged.getTime() - lastUsed.getTime()) < 60000 // Less than 1 minute difference
      
      if (hoursSinceCharged < 1 && eq.batteryLevel === 100 && !isNewEquipment) {
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

      // Generate alerts based on days idle, not battery level
      // Equipment at clinic maintains 100% battery until connected to patient
      if (daysIdle >= 5) {
        // Priority 1: Deep charge needed (most important)
        alerts.push({
          id: `${eq.id}-clinic-idle`,
          equipmentId: eq.id,
          equipmentCode: eq.code,
          type: "clinic-idle",
          severity: "warning",
          message: `Equipo ${eq.code} (${eq.model}) - Lote: ${eq.lot} lleva **${Math.floor(daysIdle)} días** desconectado en **${eq.clinicName || "clínica"}**. Requiere carga profunda manual`,
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
  const now = new Date()
  
  // For equipment at clinic, use lastDisconnectedAt
  if (equipment.status === "at-clinic" && equipment.lastDisconnectedAt) {
    const lastDisconnected = new Date(equipment.lastDisconnectedAt)
    return Math.floor((now.getTime() - lastDisconnected.getTime()) / (1000 * 60 * 60 * 24))
  }
  
  // For equipment at office, use lastUsedDate
  if (equipment.lastUsedDate) {
    const lastUsed = new Date(equipment.lastUsedDate)
    return Math.floor((now.getTime() - lastUsed.getTime()) / (1000 * 60 * 60 * 24))
  }
  
  return 0
}

export function getDaysUntilDeepCharge(equipment: Equipment): number {
  const daysSinceLastUse = getDaysSinceLastUse(equipment)
  return Math.max(0, 5 - daysSinceLastUse)
}
