"use client"

import { useState, useEffect } from "react"
import { EquipmentDashboard } from "@/components/equipment-dashboard"
import { AddEquipmentDialog } from "@/components/add-equipment-dialog"
import { CheckInDialog } from "@/components/check-in-dialog"
import { AlertsPanel } from "@/components/alerts-panel"
import { Button } from "@/components/ui/button"
import { Plus, Bell } from "lucide-react"
import type { Equipment, Alert } from "@/types/equipment"
import { checkAlerts, updateEquipmentStatuses } from "@/lib/equipment-utils"
import { 
  getAllEquipment, 
  getAllAlerts, 
  updateEquipment, 
  createEquipment,
  dismissAlert,
  logEquipmentChange,
  createMultipleAlerts,
  updateAlert,
  deleteMultipleAlerts
} from "@/lib/database-utils"
import { supabase } from "@/lib/supabase"

export default function Home() {
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showCheckInDialog, setShowCheckInDialog] = useState(false)
  const [showAlerts, setShowAlerts] = useState(false)

  // Load equipment and alerts from Supabase on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const [equipmentData, alertsData] = await Promise.all([
          getAllEquipment(),
          getAllAlerts()
        ])
        setEquipment(equipmentData)
        setAlerts(alertsData)
      } catch (error) {
        console.error('Error loading data:', error)
      }
    }

    loadData()
  }, [])

  // Set up real-time subscriptions
  useEffect(() => {
    // Subscribe to equipment changes
    const equipmentSubscription = supabase
      .channel('equipment-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'equipment' },
        async () => {
          try {
            const equipmentData = await getAllEquipment()
            setEquipment(equipmentData)
          } catch (error) {
            console.error('Error syncing equipment:', error)
          }
        }
      )
      .subscribe()

    // Subscribe to alerts changes
    const alertsSubscription = supabase
      .channel('alerts-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'alerts' },
        async () => {
          try {
            const alertsData = await getAllAlerts()
            setAlerts(alertsData)
          } catch (error) {
            console.error('Error syncing alerts:', error)
          }
        }
      )
      .subscribe()

    // Cleanup subscriptions
    return () => {
      equipmentSubscription.unsubscribe()
      alertsSubscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    const updateStatus = async () => {
      try {
        // Get fresh data from database
        const [freshEquipment, currentAlerts] = await Promise.all([
          getAllEquipment(),
          getAllAlerts()
        ])
        
        // Update equipment statuses with fresh data
        const updatedEquipment = updateEquipmentStatuses(freshEquipment)
        setEquipment(updatedEquipment)
        
        // Generate fresh alerts based on current equipment status
        const freshAlerts = checkAlerts(updatedEquipment)
        
        // Get current alerts from database
        const currentAlertsFromDB = await getAllAlerts()
        
        // Create a simple approach: replace all active alerts with fresh ones
        const activeAlertsFromDB = currentAlertsFromDB.filter(alert => !alert.dismissed)
        
        // Delete all active alerts that are no longer relevant
        const alertsToDelete = activeAlertsFromDB.filter(existingAlert => 
          !freshAlerts.some(freshAlert => freshAlert.id === existingAlert.id)
        ).map(alert => alert.id)
        
        if (alertsToDelete.length > 0) {
          await deleteMultipleAlerts(alertsToDelete)
        }
        
        // Create or update alerts
        const alertsToCreate = freshAlerts.filter(freshAlert => 
          !activeAlertsFromDB.some(existingAlert => existingAlert.id === freshAlert.id)
        )
        
        const alertsToUpdate = freshAlerts.filter(freshAlert => {
          const existingAlert = activeAlertsFromDB.find(existing => existing.id === freshAlert.id)
          return existingAlert && existingAlert.message !== freshAlert.message
        })
        
        // Create new alerts
        if (alertsToCreate.length > 0) {
          await createMultipleAlerts(alertsToCreate)
        }
        
        // Update existing alerts
        for (const alertToUpdate of alertsToUpdate) {
          await updateAlert(alertToUpdate.id, {
            message: alertToUpdate.message,
            timestamp: alertToUpdate.timestamp
          })
        }
        
        // Refresh alerts from database
        const updatedAlerts = await getAllAlerts()
        setAlerts(updatedAlerts)
      } catch (error) {
        console.error('Error updating alerts:', error)
        // Fallback to local generation with current state
        const updatedEquipment = updateEquipmentStatuses(equipment)
        setEquipment(updatedEquipment)
        const newAlerts = checkAlerts(updatedEquipment)
        setAlerts(newAlerts)
      }
    }

    // Run initial check after a short delay
    const initialTimeout = setTimeout(updateStatus, 1000)

    // Then check every minute
    const interval = setInterval(updateStatus, 60000)

    return () => {
      clearTimeout(initialTimeout)
      clearInterval(interval)
    }
  }, []) // Empty dependency array - runs once on mount

  const handleAddEquipment = async (newEquipment: Omit<Equipment, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const createdEquipment = await createEquipment(newEquipment)
      setEquipment([...equipment, createdEquipment])
      await logEquipmentChange(createdEquipment.id, 'equipment_created', null, createdEquipment, 'Nuevo equipo agregado')
      setShowAddDialog(false)
    } catch (error) {
      console.error('Error adding equipment:', error)
    }
  }

  const handleCheckIn = async (equipmentId: string) => {
    try {
      const equipmentToUpdate = equipment.find(eq => eq.id === equipmentId)
      if (!equipmentToUpdate) return

      const now = new Date()
      const lastUsed = equipmentToUpdate.lastUsedDate ? new Date(equipmentToUpdate.lastUsedDate) : null
      const daysSinceUse = lastUsed ? (now.getTime() - lastUsed.getTime()) / (1000 * 60 * 60 * 24) : 0
      
      // Determine if deep charge is needed based on days since last use
      const needsDeepCharge = daysSinceUse >= 5
      
      const oldValue = { ...equipmentToUpdate }
      const newValue = {
        ...equipmentToUpdate,
        status: "charging" as const,
        location: "office" as const,
        chargingStartTime: now.toISOString(),
        lastUsedDate: now.toISOString(),
        clinicName: undefined,
        clinicCity: undefined,
        lastDisconnectedAt: null,
        isDeepCharge: needsDeepCharge,
      }

      const updatedEquipment = await updateEquipment(equipmentId, newValue)
      setEquipment(equipment.map(eq => eq.id === equipmentId ? updatedEquipment : eq))
      await logEquipmentChange(equipmentId, 'check_in', oldValue, newValue, `Reingreso desde clínica${needsDeepCharge ? ' - Carga profunda requerida' : ''}`)
      setShowCheckInDialog(false)
    } catch (error) {
      console.error('Error checking in equipment:', error)
    }
  }

  const handleMarkCharged = async (equipmentId: string) => {
    try {
      const equipmentToUpdate = equipment.find(eq => eq.id === equipmentId)
      if (!equipmentToUpdate) return

      const oldValue = { ...equipmentToUpdate }
      const newValue = {
        ...equipmentToUpdate,
        status: "ready" as const,
        batteryLevel: 100,
        chargingStartTime: null,
        lastChargedDate: new Date().toISOString(),
        isDeepCharge: false,
      }

      const updatedEquipment = await updateEquipment(equipmentId, newValue)
      setEquipment(equipment.map(eq => eq.id === equipmentId ? updatedEquipment : eq))
      await logEquipmentChange(equipmentId, 'mark_charged', oldValue, newValue, 'Equipo marcado como cargado')
    } catch (error) {
      console.error('Error marking equipment as charged:', error)
    }
  }

  const handleStartCharging = async (equipmentId: string, isDeepCharge = false) => {
    try {
      const equipmentToUpdate = equipment.find(eq => eq.id === equipmentId)
      if (!equipmentToUpdate) return

      const oldValue = { ...equipmentToUpdate }
      let newValue

      // If equipment is at clinic, connect to patient
      if (equipmentToUpdate.status === "at-clinic") {
        newValue = {
          ...equipmentToUpdate,
          status: "in-use" as const,
          lastUsedDate: new Date().toISOString(),
          lastDisconnectedAt: null,
        }
      } else {
        // Otherwise start charging
        newValue = {
          ...equipmentToUpdate,
          status: "charging" as const,
          chargingStartTime: new Date().toISOString(),
          isDeepCharge,
        }
      }

      const updatedEquipment = await updateEquipment(equipmentId, newValue)
      setEquipment(equipment.map(eq => eq.id === equipmentId ? updatedEquipment : eq))
      await logEquipmentChange(equipmentId, 'start_charging', oldValue, newValue, isDeepCharge ? 'Inicio de carga profunda' : 'Inicio de carga normal')
    } catch (error) {
      console.error('Error starting charging:', error)
    }
  }

  const handleCheckOut = async (equipmentId: string, clinicName: string, clinicCity: string) => {
    try {
      const equipmentToUpdate = equipment.find(eq => eq.id === equipmentId)
      if (!equipmentToUpdate) return

      const oldValue = { ...equipmentToUpdate }
      const newValue = {
        ...equipmentToUpdate,
        status: "at-clinic" as const,
        location: "clinic" as const,
        clinicName,
        clinicCity,
        lastDisconnectedAt: new Date().toISOString(),
      }

      const updatedEquipment = await updateEquipment(equipmentId, newValue)
      setEquipment(equipment.map(eq => eq.id === equipmentId ? updatedEquipment : eq))
      await logEquipmentChange(equipmentId, 'check_out', oldValue, newValue, `Enviado a clínica: ${clinicName} - ${clinicCity}`)
    } catch (error) {
      console.error('Error checking out equipment:', error)
    }
  }

  const handleStopCharging = async (equipmentId: string) => {
    try {
      const equipmentToUpdate = equipment.find(eq => eq.id === equipmentId)
      if (!equipmentToUpdate) return

      const oldValue = { ...equipmentToUpdate }
      let newValue

      // If equipment is in use at clinic, disconnect from patient
      if (equipmentToUpdate.status === "in-use" && equipmentToUpdate.location === "clinic") {
        newValue = {
          ...equipmentToUpdate,
          status: "at-clinic" as const,
          lastDisconnectedAt: new Date().toISOString(),
        }
      } else if (equipmentToUpdate.status === "charging" && equipmentToUpdate.location === "clinic") {
        // If equipment is charging at clinic, stop charging but keep clinic info
        newValue = {
          ...equipmentToUpdate,
          status: "at-clinic" as const,
          chargingStartTime: null,
          isDeepCharge: false,
          // Preserve clinic information
          clinicName: equipmentToUpdate.clinicName,
          clinicCity: equipmentToUpdate.clinicCity,
        }
      } else {
        // Otherwise stop charging at office
        newValue = {
          ...equipmentToUpdate,
          status: "ready" as const,
          chargingStartTime: null,
          isDeepCharge: false,
        }
      }

      const updatedEquipment = await updateEquipment(equipmentId, newValue)
      setEquipment(equipment.map(eq => eq.id === equipmentId ? updatedEquipment : eq))
      await logEquipmentChange(equipmentId, 'stop_charging', oldValue, newValue, 'Carga detenida')
    } catch (error) {
      console.error('Error stopping charging:', error)
    }
  }

  const handleStartDeepCharge = async (equipmentId: string) => {
    try {
      const equipmentToUpdate = equipment.find(eq => eq.id === equipmentId)
      if (!equipmentToUpdate) return

      const oldValue = { ...equipmentToUpdate }
      const newValue = {
        ...equipmentToUpdate,
        status: "charging" as const,
        location: "clinic" as const, // Explicitly keep location as clinic
        chargingStartTime: new Date().toISOString(),
        isDeepCharge: true,
        needsManualDisconnection: false,
        // Preserve clinic information
        clinicName: equipmentToUpdate.clinicName,
        clinicCity: equipmentToUpdate.clinicCity,
      }

      const updatedEquipment = await updateEquipment(equipmentId, newValue)
      setEquipment(equipment.map(eq => eq.id === equipmentId ? updatedEquipment : eq))
      await logEquipmentChange(equipmentId, 'start_deep_charge', oldValue, newValue, `Inicio de carga profunda en ${equipmentToUpdate.clinicName} - ${equipmentToUpdate.clinicCity}`)
    } catch (error) {
      console.error('Error starting deep charge:', error)
    }
  }

  const handleManualDisconnect = async (equipmentId: string) => {
    try {
      const equipmentToUpdate = equipment.find(eq => eq.id === equipmentId)
      if (!equipmentToUpdate) return

      const oldValue = { ...equipmentToUpdate }
      const newValue = {
        ...equipmentToUpdate,
        status: "at-clinic" as const,
        batteryLevel: 100,
        chargingStartTime: null,
        lastChargedDate: new Date().toISOString(),
        lastUsedDate: new Date().toISOString(), // Reset the days counter
        isDeepCharge: false,
        needsManualDisconnection: false,
        // Preserve clinic information
        clinicName: equipmentToUpdate.clinicName,
        clinicCity: equipmentToUpdate.clinicCity,
      }

      const updatedEquipment = await updateEquipment(equipmentId, newValue)
      setEquipment(equipment.map(eq => eq.id === equipmentId ? updatedEquipment : eq))
      await logEquipmentChange(equipmentId, 'manual_disconnect', oldValue, newValue, `Desconexión manual después de carga profunda completada en ${equipmentToUpdate.clinicName} - ${equipmentToUpdate.clinicCity}`)
    } catch (error) {
      console.error('Error with manual disconnect:', error)
    }
  }


  const activeAlerts = alerts.filter((a) => !a.dismissed)

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <header className="mb-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex-1">
              <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-2 text-balance">
                TopiVac Battery Manager
              </h1>
              <p className="text-sm lg:text-base text-gray-600 text-pretty">
                Sistema de gestión de baterías para equipos de terapia de presión negativa
              </p>
            </div>
            <div className="flex flex-wrap gap-2 lg:gap-3">
              <Button
                variant="outline"
                size="default"
                onClick={() => setShowAlerts(true)}
                className="relative flex-1 sm:flex-none"
              >
                <Bell className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Alertas</span>
                {activeAlerts.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {activeAlerts.length}
                  </span>
                )}
              </Button>
              <Button
                variant="outline"
                size="default"
                onClick={() => setShowCheckInDialog(true)}
                className="flex-1 sm:flex-none text-sm"
              >
                <span className="truncate">Reingresar</span>
              </Button>
              <Button
                size="default"
                onClick={() => setShowAddDialog(true)}
                className="bg-indigo-600 hover:bg-indigo-700 flex-1 sm:flex-none"
              >
                <Plus className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Agregar Equipo</span>
                <span className="sm:hidden">Agregar</span>
              </Button>
            </div>
          </div>
        </header>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-8">
          <div className="bg-white rounded-xl p-4 md:p-6 shadow-sm border border-gray-100">
            <div className="text-xs md:text-sm text-gray-600 mb-1">Total Equipos</div>
            <div className="text-2xl md:text-3xl font-bold text-gray-900">{equipment.length}</div>
          </div>
          <div className="bg-white rounded-xl p-4 md:p-6 shadow-sm border border-gray-100">
            <div className="text-xs md:text-sm text-gray-600 mb-1">Cargando</div>
            <div className="text-2xl md:text-3xl font-bold text-amber-600">
              {equipment.filter((e) => e.status === "charging").length}
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 md:p-6 shadow-sm border border-gray-100">
            <div className="text-xs md:text-sm text-gray-600 mb-1">Listos</div>
            <div className="text-2xl md:text-3xl font-bold text-green-600">
              {equipment.filter((e) => e.status === "ready").length}
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 md:p-6 shadow-sm border border-gray-100">
            <div className="text-xs md:text-sm text-gray-600 mb-1">En Clínica</div>
            <div className="text-2xl md:text-3xl font-bold text-blue-600">
              {equipment.filter((e) => e.status === "in-use" || e.status === "at-clinic").length}
            </div>
          </div>
        </div>

        {/* Equipment Dashboard */}
        <EquipmentDashboard
          equipment={equipment}
          alerts={alerts}
          onMarkCharged={handleMarkCharged}
          onStartCharging={handleStartCharging}
          onCheckOut={handleCheckOut}
          onStopCharging={handleStopCharging}
          onStartDeepCharge={handleStartDeepCharge}
          onManualDisconnect={handleManualDisconnect}
        />

        {/* Dialogs */}
        <AddEquipmentDialog open={showAddDialog} onOpenChange={setShowAddDialog} onAdd={handleAddEquipment} />

        <CheckInDialog
          open={showCheckInDialog}
          onOpenChange={setShowCheckInDialog}
          equipment={equipment.filter((e) => e.location === "clinic")}
          onCheckIn={handleCheckIn}
        />

        <AlertsPanel
          open={showAlerts}
          onOpenChange={setShowAlerts}
          alerts={alerts}
          onDismiss={async (alertId) => {
            try {
              const updatedAlert = await dismissAlert(alertId)
              setAlerts(alerts.map((a) => (a.id === alertId ? updatedAlert : a)))
            } catch (error) {
              console.error('Error dismissing alert:', error)
            }
          }}
        />
      </div>
    </div>
  )
}
