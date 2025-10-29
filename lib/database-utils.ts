import { supabase } from './supabase'
import type { Equipment, Alert, EquipmentRow, AlertRow, EquipmentHistory } from '@/types/equipment'

// Helper functions to convert between database format and app format
export function convertEquipmentRowToEquipment(row: EquipmentRow): Equipment {
  return {
    id: row.id,
    code: row.code,
    model: row.model,
    lot: row.lot,
    status: row.status,
    location: row.location,
    batteryLevel: row.battery_level,
    chargingStartTime: row.charging_start_time,
    lastChargedDate: row.last_charged_date,
    lastUsedDate: row.last_used_date,
    lastDisconnectedAt: row.last_disconnected_at,
    isDeepCharge: row.is_deep_charge,
    needsManualDisconnection: row.needs_manual_disconnection || false,
    notes: row.notes || undefined,
    clinicName: row.clinic_name || undefined,
    clinicCity: row.clinic_city || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function convertAlertRowToAlert(row: AlertRow): Alert {
  return {
    id: row.id,
    equipmentId: row.equipment_id,
    equipmentCode: row.equipment_code,
    type: row.type,
    severity: row.severity,
    message: row.message,
    timestamp: row.timestamp,
    dismissed: row.dismissed,
    dismissedAt: row.dismissed_at || undefined,
    dismissedBy: row.dismissed_by || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// Equipment operations
export async function getAllEquipment(): Promise<Equipment[]> {
  try {
    const { data, error } = await supabase
      .from('equipment')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching equipment:', error)
      throw new Error(`Error fetching equipment: ${error.message}`)
    }

    if (!data || data.length === 0) {
      return []
    }

    return data.map(convertEquipmentRowToEquipment)
  } catch (error) {
    console.error('Error in getAllEquipment:', error)
    throw new Error(`Failed to fetch equipment: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

export async function getAllLots(): Promise<{id: string, code: string, lot: string}[]> {
  const { data, error } = await supabase
    .from('equipment')
    .select('id, code, lot')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching lots:', error)
    throw error
  }

  return data || []
}

export async function getEquipmentById(id: string): Promise<Equipment | null> {
  const { data, error } = await supabase
    .from('equipment')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching equipment:', error)
    return null
  }

  return convertEquipmentRowToEquipment(data)
}

export async function createEquipment(equipment: Omit<Equipment, 'id' | 'createdAt' | 'updatedAt'>): Promise<Equipment> {
  console.log('Creating equipment with data:', equipment)
  
  // First, let's check if the lot already exists
  const { data: existingLot, error: checkError } = await supabase
    .from('equipment')
    .select('id, code, lot')
    .eq('lot', equipment.lot)
    .single()

  if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows found
    console.error('Error checking existing lot:', checkError)
  } else if (existingLot) {
    console.log('Found existing equipment with same lot:', existingLot)
    throw new Error(`El lote "${equipment.lot}" ya existe en el equipo ${existingLot.code}. Por favor, usa un lote diferente.`)
  }

  const { data, error } = await supabase
    .from('equipment')
    .insert({
      code: equipment.code,
      model: equipment.model,
      lot: equipment.lot,
      status: equipment.status,
      location: equipment.location,
      battery_level: equipment.batteryLevel,
      charging_start_time: equipment.chargingStartTime,
      last_charged_date: equipment.lastChargedDate,
      last_used_date: equipment.lastUsedDate,
      last_disconnected_at: equipment.lastDisconnectedAt,
      is_deep_charge: equipment.isDeepCharge,
      notes: equipment.notes || null,
      clinic_name: equipment.clinicName || null,
      clinic_city: equipment.clinicCity || null,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating equipment:', error)
    console.error('Full error details:', JSON.stringify(error, null, 2))
    
    // Handle specific error cases
    if (error.code === '23505') {
      throw new Error(`El lote "${equipment.lot}" ya existe. Por favor, usa un lote diferente.`)
    } else if (error.code === '23503') {
      throw new Error('Error de integridad de datos. Verifica que todos los campos requeridos estén completos.')
    } else {
      throw new Error(`Error al crear el equipo: ${error.message}`)
    }
  }

  return convertEquipmentRowToEquipment(data)
}

export async function updateEquipment(id: string, updates: Partial<Equipment>): Promise<Equipment> {
  const updateData: any = {}
  
  if (updates.code !== undefined) updateData.code = updates.code
  if (updates.model !== undefined) updateData.model = updates.model
  if (updates.lot !== undefined) updateData.lot = updates.lot
  if (updates.status !== undefined) updateData.status = updates.status
  if (updates.location !== undefined) updateData.location = updates.location
  if (updates.batteryLevel !== undefined) updateData.battery_level = updates.batteryLevel
  if (updates.chargingStartTime !== undefined) updateData.charging_start_time = updates.chargingStartTime
  if (updates.lastChargedDate !== undefined) updateData.last_charged_date = updates.lastChargedDate
  if (updates.lastUsedDate !== undefined) updateData.last_used_date = updates.lastUsedDate
  if (updates.lastDisconnectedAt !== undefined) updateData.last_disconnected_at = updates.lastDisconnectedAt
  if (updates.isDeepCharge !== undefined) updateData.is_deep_charge = updates.isDeepCharge
  if (updates.notes !== undefined) updateData.notes = updates.notes || null
  if (updates.clinicName !== undefined) updateData.clinic_name = updates.clinicName || null
  if (updates.clinicCity !== undefined) updateData.clinic_city = updates.clinicCity || null

  // Log update data for debugging
  console.log('Updating equipment:', id, updateData)

  const { data, error } = await supabase
    .from('equipment')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    // Log full error details
    const errorDetails = {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    }
    console.error('Error updating equipment:', errorDetails)
    console.error('Update data attempted:', JSON.stringify(updateData, null, 2))
    throw new Error(`Error updating equipment: ${error.message || JSON.stringify(errorDetails)}`)
  }

  if (!data) {
    throw new Error(`No data returned after updating equipment ${id}`)
  }

  return convertEquipmentRowToEquipment(data)
}

export async function deleteEquipment(id: string): Promise<void> {
  const { error } = await supabase
    .from('equipment')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting equipment:', error)
    throw error
  }
}

// Alert operations
export async function getAllAlerts(): Promise<Alert[]> {
  try {
    const { data, error } = await supabase
      .from('alerts')
      .select('*')
      .order('timestamp', { ascending: false })

    if (error) {
      console.error('Error fetching alerts:', error)
      throw new Error(`Error fetching alerts: ${error.message}`)
    }

    return data.map(convertAlertRowToAlert)
  } catch (error) {
    console.error('Error in getAllAlerts:', error)
    throw new Error(`Failed to fetch alerts: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

export async function getAlertsByEquipmentId(equipmentId: string): Promise<Alert[]> {
  const { data, error } = await supabase
    .from('alerts')
    .select('*')
    .eq('equipment_id', equipmentId)
    .order('timestamp', { ascending: false })

  if (error) {
    console.error('Error fetching equipment alerts:', error)
    throw error
  }

  return data.map(convertAlertRowToAlert)
}

export async function updateAlert(id: string, updates: Partial<Alert>): Promise<Alert> {
  const updateData: any = {}
  
  if (updates.equipmentId !== undefined) updateData.equipment_id = updates.equipmentId
  if (updates.equipmentCode !== undefined) updateData.equipment_code = updates.equipmentCode
  if (updates.type !== undefined) updateData.type = updates.type
  if (updates.severity !== undefined) updateData.severity = updates.severity
  if (updates.message !== undefined) updateData.message = updates.message
  if (updates.timestamp !== undefined) updateData.timestamp = updates.timestamp
  if (updates.dismissed !== undefined) updateData.dismissed = updates.dismissed
  if (updates.dismissedAt !== undefined) updateData.dismissed_at = updates.dismissedAt || null
  if (updates.dismissedBy !== undefined) updateData.dismissed_by = updates.dismissedBy || null

  const { data, error } = await supabase
    .from('alerts')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating alert:', error)
    throw error
  }

  return convertAlertRowToAlert(data)
}

export async function dismissAlert(id: string): Promise<Alert> {
  const { data, error } = await supabase
    .from('alerts')
    .update({
      dismissed: true,
      dismissed_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error dismissing alert:', error)
    throw error
  }

  return convertAlertRowToAlert(data)
}

// History operations
export async function logEquipmentChange(
  equipmentId: string,
  action: string,
  oldValue?: any,
  newValue?: any,
  notes?: string
): Promise<string> {
  const { data, error } = await supabase
    .from('equipment_history')
    .insert({
      equipment_id: equipmentId,
      action,
      old_value: oldValue || null,
      new_value: newValue || null,
      notes: notes || null,
    })
    .select('id')
    .single()

  if (error) {
    console.error('Error logging equipment change:', error)
    throw error
  }

  return data.id
}

export async function getEquipmentHistory(equipmentId: string): Promise<EquipmentHistory[]> {
  const { data, error } = await supabase
    .from('equipment_history')
    .select('*')
    .eq('equipment_id', equipmentId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching equipment history:', error)
    throw error
  }

  return data.map(row => ({
    id: row.id,
    equipmentId: row.equipment_id,
    action: row.action,
    oldValue: row.old_value,
    newValue: row.new_value,
    changedBy: row.changed_by,
    notes: row.notes,
    createdAt: row.created_at,
  }))
}

// Specialized functions
export async function getEquipmentNeedingDeepCharge(): Promise<Equipment[]> {
  const { data, error } = await supabase.rpc('get_equipment_needing_deep_charge')

  if (error) {
    console.error('Error fetching equipment needing deep charge:', error)
    throw error
  }

  // Get full equipment data for each ID
  const equipmentIds = data.map((item: any) => item.equipment_id)
  const { data: equipmentData, error: equipmentError } = await supabase
    .from('equipment')
    .select('*')
    .in('id', equipmentIds)

  if (equipmentError) {
    console.error('Error fetching equipment data:', equipmentError)
    throw equipmentError
  }

  return equipmentData.map(convertEquipmentRowToEquipment)
}

export async function getActiveAlerts(): Promise<Alert[]> {
  const { data, error } = await supabase
    .from('alerts')
    .select('*')
    .eq('dismissed', false)
    .order('timestamp', { ascending: false })

  if (error) {
    console.error('Error fetching active alerts:', error)
    throw error
  }

  return data.map(convertAlertRowToAlert)
}

export async function createAlert(alert: Omit<Alert, 'id' | 'createdAt' | 'updatedAt'>): Promise<Alert> {
  const { data, error } = await supabase
    .from('alerts')
    .insert({
      equipment_id: alert.equipmentId,
      equipment_code: alert.equipmentCode,
      type: alert.type,
      severity: alert.severity,
      message: alert.message,
      timestamp: alert.timestamp,
      dismissed: alert.dismissed,
      dismissed_at: alert.dismissedAt || null,
      dismissed_by: alert.dismissedBy || null,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating alert:', error)
    throw error
  }

  return convertAlertRowToAlert(data)
}

export async function createMultipleAlerts(alerts: Omit<Alert, 'createdAt' | 'updatedAt'>[]): Promise<Alert[]> {
  if (alerts.length === 0) return []

  const results: Alert[] = []
  
  // Insert alerts one by one to handle duplicates gracefully
  for (const alert of alerts) {
    try {
      // Validate alert has required fields
      if (!alert.id || !alert.equipmentId || !alert.equipmentCode || !alert.type || !alert.severity) {
        console.warn('Skipping alert with missing required fields:', alert)
        continue
      }

      // First check if alert already exists to avoid unnecessary operations
      const { data: existing } = await supabase
        .from('alerts')
        .select('id')
        .eq('id', alert.id)
        .single()

      let data = null
      let error = null

      if (existing) {
        // Update existing alert
        const updateResult = await supabase
          .from('alerts')
          .update({
            equipment_id: alert.equipmentId,
            equipment_code: alert.equipmentCode,
            type: alert.type,
            severity: alert.severity,
            message: alert.message,
            timestamp: alert.timestamp,
            dismissed: alert.dismissed || false,
            dismissed_at: alert.dismissedAt || null,
            dismissed_by: alert.dismissedBy || null,
          })
          .eq('id', alert.id)
          .select()
          .single()
        
        data = updateResult.data
        error = updateResult.error
      } else {
        // Insert new alert
        const insertResult = await supabase
          .from('alerts')
          .insert({
            id: alert.id,
            equipment_id: alert.equipmentId,
            equipment_code: alert.equipmentCode,
            type: alert.type,
            severity: alert.severity,
            message: alert.message,
            timestamp: alert.timestamp,
            dismissed: alert.dismissed || false,
            dismissed_at: alert.dismissedAt || null,
            dismissed_by: alert.dismissedBy || null,
          })
          .select()
          .single()
        
        data = insertResult.data
        error = insertResult.error
      }

      if (error) {
        // Log the full error object to see what's happening
        const errorDetails = {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        }
        
        // If it's a duplicate key error or unique violation, skip silently
        if (error.code === '23505' || error.code === 'PGRST116' || 
            error.code === '23503' || // Foreign key violation
            error.code === '42P01' || // Table doesn't exist
            (typeof error.message === 'string' && 
             (error.message.includes('duplicate') || 
              error.message.includes('unique') ||
              error.message.includes('violates') ||
              error.message.includes('constraint')))) {
          // Alert already exists or constraint violation - skip silently
          continue
        } else {
          // Log error but use console.warn to avoid breaking the UI
          console.warn(`Error ${existing ? 'updating' : 'inserting'} alert ${alert.id}:`, errorDetails)
          console.warn('Alert data:', JSON.stringify({
            id: alert.id,
            equipment_id: alert.equipmentId,
            type: alert.type,
            severity: alert.severity,
          }, null, 2))
          // Don't throw - continue processing other alerts
        }
      } else if (data) {
        results.push(convertAlertRowToAlert(data))
      }
    } catch (err) {
      // Skip errors silently - we want the app to continue working
      // Log for debugging but don't throw
      if (err instanceof Error) {
        if (err.message.includes('duplicate') || 
            err.message.includes('unique') ||
            err.message.includes('violates') ||
            err.message.includes('constraint')) {
          // These are expected for duplicates - skip silently
          continue
        }
        // Log unexpected errors but don't break the flow
        console.warn(`Unexpected error upserting alert ${alert.id}:`, err.message)
      } else {
        console.warn(`Unexpected error upserting alert ${alert.id}:`, err)
      }
    }
  }
  
  return results
}

export async function deleteAlert(id: string): Promise<void> {
  const { error } = await supabase
    .from('alerts')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting alert:', error)
    throw error
  }
}

export async function deleteMultipleAlerts(alertIds: string[]): Promise<void> {
  if (alertIds.length === 0) return

  const { error } = await supabase
    .from('alerts')
    .delete()
    .in('id', alertIds)

  if (error) {
    console.error('Error deleting multiple alerts:', error)
    throw error
  }
}

export async function deleteObsoleteAlerts(): Promise<void> {
  // Delete alerts that are older than 1 hour and have been dismissed
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  
  const { error } = await supabase
    .from('alerts')
    .delete()
    .eq('dismissed', true)
    .lt('timestamp', oneHourAgo)

  if (error) {
    console.error('Error deleting obsolete alerts:', error)
    throw error
  }
}
