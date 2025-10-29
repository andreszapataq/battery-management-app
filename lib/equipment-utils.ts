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
        // If it's a deep charge at clinic, mark as ready for manual disconnection
        if (eq.isDeepCharge && eq.location === "clinic") {
          // Mark as completed - waiting for manual disconnection
          // NO auto-disconnect - must be done manually
          return {
            ...eq,
            batteryLevel: 100,
            needsManualDisconnection: true,
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
            id: `${eq.id}-deep-charge-complete`,
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
            id: `${eq.id}-charge-complete`,
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

    // For clinic equipment (at-clinic), also base on last charge (manual disconnect sets lastChargedDate)
    // IMPORTANT: Do NOT show alert if equipment just completed deep charge (within last 24 hours)
    if (eq.status === "at-clinic") {
      const daysSinceLastCharge = getDaysSinceLastCharge(eq)

      const recentlyCompletedDeepCharge = eq.lastChargedDate && eq.batteryLevel === 100 && 
        (now.getTime() - new Date(eq.lastChargedDate).getTime()) < (24 * 60 * 60 * 1000)

      if (daysSinceLastCharge >= 5 && !recentlyCompletedDeepCharge) {
        alerts.push({
          id: `${eq.id}-clinic-idle`,
          equipmentId: eq.id,
          equipmentCode: eq.code,
          type: "clinic-idle",
          severity: "warning",
          message: `Equipo ${eq.code} (${eq.model}) - Lote: ${eq.lot} lleva **${Math.floor(daysSinceLastCharge)} días** desde la última carga en **${eq.clinicName || "clínica"}**. Requiere carga profunda manual`,
          timestamp: now.toISOString(),
          dismissed: false,
        })
      }
    }
    
    // For office equipment (ready status), alert based on days since last charge
    if (eq.status === "ready") {
      const daysSinceLastCharge = getDaysSinceLastCharge(eq)
      if (daysSinceLastCharge >= 5) {
        alerts.push({
          id: `${eq.id}-office-idle`,
          equipmentId: eq.id,
          equipmentCode: eq.code,
          type: "deep-charge-needed",
          severity: "warning",
          message: `Equipo ${eq.code} (${eq.model}) - Lote: ${eq.lot} lleva **${Math.floor(daysSinceLastCharge)} días** desde la última carga en oficina. Requiere carga profunda manual de 12 horas para despegar la batería`,
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
          id: `${eq.id}-deep-charging`,
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
        severity: "warning",
        message: `Equipo ${eq.code} completó carga profunda a las ${completionTime.toLocaleTimeString("es-ES", { hour: '2-digit', minute: '2-digit' })}. Desconectar manualmente para liberar el cargador y reiniciar el contador de días`,
        timestamp: now.toISOString(),
        dismissed: false,
      })
    }

    // Check if deep charge completed and battery calibration is done
    // Only show calibration success alerts for equipment that actually went through a deep charge process
    // IMPORTANT: Only for office equipment (ready status), not for clinic equipment
    if (eq.status === "ready" && eq.lastChargedDate && eq.lastUsedDate) {
      const lastCharged = new Date(eq.lastChargedDate)
      const lastUsed = new Date(eq.lastUsedDate)
      const hoursSinceCharged = (now.getTime() - lastCharged.getTime()) / (1000 * 60 * 60)
      
      // Only show calibration success if:
      // 1. It was charged very recently (within 5 minutes) - this ensures it only shows once
      // 2. Battery is at 100%
      // 3. The equipment has been used before (not a brand new equipment)
      // 4. The last used date is different from last charged date (indicating it went through a real process)
      const isNewEquipment = Math.abs(lastCharged.getTime() - lastUsed.getTime()) < 60000 // Less than 1 minute difference
      
      if (hoursSinceCharged < 0.083 && eq.batteryLevel === 100 && !isNewEquipment) { // 0.083 hours = 5 minutes
        alerts.push({
          id: `${eq.id}-calibration-complete-${Math.floor(lastCharged.getTime() / 1000)}`, // Use fixed ID based on charge time
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
          id: `${eq.id}-overdue-charge`,
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

    // REMOVED DUPLICATE: This alert is already generated above in the main check
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
  
  // For equipment at clinic, prioritize lastDisconnectedAt (after manual disconnect from deep charge)
  // Otherwise use lastUsedDate (for normal operations)
  if (equipment.status === "at-clinic") {
    if (equipment.lastDisconnectedAt) {
      const lastDisconnected = new Date(equipment.lastDisconnectedAt)
      return Math.floor((now.getTime() - lastDisconnected.getTime()) / (1000 * 60 * 60 * 24))
    } else if (equipment.lastUsedDate) {
      const lastUsed = new Date(equipment.lastUsedDate)
      return Math.floor((now.getTime() - lastUsed.getTime()) / (1000 * 60 * 60 * 24))
    }
  }
  
  // For equipment at office, use lastUsedDate
  if (equipment.lastUsedDate) {
    const lastUsed = new Date(equipment.lastUsedDate)
    return Math.floor((now.getTime() - lastUsed.getTime()) / (1000 * 60 * 60 * 24))
  }
  
  return 0
}

export function getDaysUntilDeepCharge(equipment: Equipment): number {
  const daysSinceLastCharge = getDaysSinceLastCharge(equipment)
  return Math.max(0, 5 - daysSinceLastCharge)
}

// NEW: days since the last full charge (deep or normal)
export function getDaysSinceLastCharge(equipment: Equipment): number {
  const now = new Date()
  if (equipment.lastChargedDate) {
    const lastCharged = new Date(equipment.lastChargedDate)
    return Math.floor((now.getTime() - lastCharged.getTime()) / (1000 * 60 * 60 * 24))
  }
  // Fallback: if never charged recorded, use lastUsed/lastDisconnected as proxy
  if (equipment.status === "at-clinic" && equipment.lastDisconnectedAt) {
    const lastDisconnected = new Date(equipment.lastDisconnectedAt)
    return Math.floor((now.getTime() - lastDisconnected.getTime()) / (1000 * 60 * 60 * 24))
  }
  if (equipment.lastUsedDate) {
    const lastUsed = new Date(equipment.lastUsedDate)
    return Math.floor((now.getTime() - lastUsed.getTime()) / (1000 * 60 * 60 * 24))
  }
  return 0
}
