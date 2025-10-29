"use client"

import { useState, useEffect, useRef } from "react"
import { EquipmentDashboard } from "@/components/equipment-dashboard"
import { AddEquipmentDialog } from "@/components/add-equipment-dialog"
import { CheckInDialog } from "@/components/check-in-dialog"
import { AlertsPanel } from "@/components/alerts-panel"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Bell, Search, X } from "lucide-react"
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
  deleteMultipleAlerts,
  getAllLots
} from "@/lib/database-utils"
import { supabase } from "@/lib/supabase"

export default function Home() {
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  // Evitar parpadeos: suprimir actualizaciones en tiempo real mientras sincronizamos alertas con la BD
  const isSyncingAlertsRef = useRef(false)
  // Mantener referencia a las alertas actuales para evitar que RT las borre si la BD está vacía
  const alertsRef = useRef<Alert[]>([])

  const safeSetAlerts = (next: Alert[]) => {
    setAlerts(next)
    alertsRef.current = next
  }
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showCheckInDialog, setShowCheckInDialog] = useState(false)
  const [showAlerts, setShowAlerts] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

  // Function to retry connection
  const retryConnection = async () => {
    setConnectionError(null)
    await loadData()
  }

  // Load equipment and alerts from Supabase on mount
  const loadData = async () => {
    try {
      const [equipmentData, alertsData] = await Promise.all([
        getAllEquipment(),
        getAllAlerts()
      ])
      setEquipment(equipmentData)
      setAlerts(alertsData)
      setConnectionError(null)
    } catch (error) {
      console.error('Error loading data:', error)
      setConnectionError('Error de conexión con la base de datos')
      // Keep existing data instead of clearing it
    }
  }

  useEffect(() => {
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
            // Si estamos sincronizando alertas (borrando/creando en bloque), no refrescar desde RT
            if (isSyncingAlertsRef.current) return
            const alertsData = await getAllAlerts()
            // Si la BD devuelve 0 pero la app ya tiene alertas calculadas, mantener las locales
            if (alertsData.length === 0 && alertsRef.current.length > 0) return
            safeSetAlerts(alertsData)
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
        // Get fresh data from database with individual error handling
        let freshEquipment: Equipment[] = []
        let currentAlerts: Alert[] = []
        
        try {
          freshEquipment = await getAllEquipment()
        } catch (error) {
          console.error('Error fetching equipment in updateStatus:', error)
          // Use current equipment state as fallback
          freshEquipment = equipment
        }
        
        try {
          currentAlerts = await getAllAlerts()
        } catch (error) {
          console.error('Error fetching alerts in updateStatus:', error)
          // Use current alerts state as fallback
          currentAlerts = alerts
        }
        
        // Update equipment statuses with fresh data
        const updatedEquipment = updateEquipmentStatuses(freshEquipment)
        setEquipment(updatedEquipment)
        
        // Generate fresh alerts based on current equipment status
        const freshAlerts = checkAlerts(updatedEquipment)
        // Optimistically reflect alerts in UI while syncing with DB
        safeSetAlerts(freshAlerts)
        
        // Only proceed with alert updates if we have a successful connection
        if (freshEquipment.length > 0) {
          try {
            // Get current alerts from database
            const currentAlertsFromDB = await getAllAlerts()
            
            // Create a simple approach: replace all active alerts with fresh ones
            const activeAlertsFromDB = currentAlertsFromDB.filter(alert => !alert.dismissed)
            
            // Delete all active alerts that are no longer relevant
            const alertsToDelete = activeAlertsFromDB.filter(existingAlert => 
              !freshAlerts.some(freshAlert => freshAlert.id === existingAlert.id)
            ).map(alert => alert.id)
            
            if (alertsToDelete.length > 0) {
              isSyncingAlertsRef.current = true
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
            
            // Refresh alerts from database. If DB returns none (e.g., RLS/dup issues), fallback to locally generated
            const updatedAlerts = await getAllAlerts()
            safeSetAlerts(updatedAlerts.length > 0 ? updatedAlerts : freshAlerts)
            isSyncingAlertsRef.current = false
          } catch (alertError) {
            console.error('Error updating alerts:', alertError)
            // Fallback to local generation with current state
            safeSetAlerts(freshAlerts)
            isSyncingAlertsRef.current = false
          }
        } else {
          // If no equipment data, just use local alerts
          safeSetAlerts(freshAlerts)
        }
      } catch (error) {
        console.error('Error updating status:', error)
        // Fallback to local generation with current state
        const updatedEquipment = updateEquipmentStatuses(equipment)
        setEquipment(updatedEquipment)
        const newAlerts = checkAlerts(updatedEquipment)
        safeSetAlerts(newAlerts)
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
      
      // If it's a lot conflict, show all existing lots for debugging
      if (error instanceof Error && error.message.includes('ya existe')) {
        try {
          const existingLots = await getAllLots()
          console.log('All existing lots:', existingLots)
          alert(`${error.message}\n\nLotes existentes: ${existingLots.map(l => `${l.code}: ${l.lot}`).join(', ')}`)
        } catch (debugError) {
          console.error('Error fetching lots for debugging:', debugError)
          alert(error.message)
        }
      } else {
        alert(error instanceof Error ? error.message : 'Error al agregar el equipo. Inténtalo de nuevo.')
      }
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
        const now = new Date()
        newValue = {
          ...equipmentToUpdate,
          status: "in-use" as const,
          lastUsedDate: now.toISOString(),
          lastDisconnectedAt: null, // Reset disconnected counter when connecting to patient
          // Preserve clinic information
          clinicName: equipmentToUpdate.clinicName,
          clinicCity: equipmentToUpdate.clinicCity,
          location: "clinic" as const,
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
        // NO resetear lastDisconnectedAt - mantener el conteo regresivo
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
      if (!equipmentToUpdate) {
        console.error('Equipment not found:', equipmentId)
        return
      }

      const now = new Date()
      const oldValue = { ...equipmentToUpdate }
      
      // Only send the fields that need to be updated
      const updates: Partial<Equipment> = {
        status: "at-clinic" as const,
        batteryLevel: 100,
        chargingStartTime: null,
        lastChargedDate: now.toISOString(),
        lastUsedDate: now.toISOString(), // Reset for general tracking
        lastDisconnectedAt: now.toISOString(), // CRITICAL: Set this to start the 5-day countdown after manual disconnect
        isDeepCharge: false,
        needsManualDisconnection: false,
        location: "clinic" as const,
        // Preserve clinic information - equipment stays at clinic
        clinicName: equipmentToUpdate.clinicName || undefined,
        clinicCity: equipmentToUpdate.clinicCity || undefined,
      }

      const updatedEquipment = await updateEquipment(equipmentId, updates)
      setEquipment(equipment.map(eq => eq.id === equipmentId ? updatedEquipment : eq))
      
      const newValue = { ...equipmentToUpdate, ...updates }
      await logEquipmentChange(equipmentId, 'manual_disconnect', oldValue, newValue, `Desconexión manual después de carga profunda completada en ${equipmentToUpdate.clinicName || 'clínica'} - ${equipmentToUpdate.clinicCity || ''}. Contador de 5 días iniciado`)
    } catch (error) {
      console.error('Error with manual disconnect:', error)
      // Show user-friendly error message
      alert(error instanceof Error ? error.message : 'Error al desconectar el equipo. Por favor, intenta nuevamente.')
    }
  }


  const activeAlerts = alerts.filter((a) => !a.dismissed)

  // Filter equipment based on search query
  const filteredEquipment = searchQuery.trim() === "" 
    ? equipment 
    : equipment.filter((eq) => {
        const query = searchQuery.toLowerCase()
        return (
          eq.code.toLowerCase().includes(query) ||
          eq.model.toLowerCase().includes(query) ||
          eq.lot.toLowerCase().includes(query) ||
          eq.clinicName?.toLowerCase().includes(query) ||
          eq.clinicCity?.toLowerCase().includes(query)
        )
      })


  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Connection Error Banner */}
        {connectionError && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bell className="h-5 w-5 text-red-600" />
              <div>
                <p className="text-sm font-medium text-red-800">Problema de conexión</p>
                <p className="text-xs text-red-600">Los datos pueden no estar actualizados</p>
              </div>
            </div>
            <Button 
              onClick={retryConnection} 
              variant="outline" 
              size="sm"
              className="text-red-700 border-red-300 hover:bg-red-100"
            >
              Reintentar
            </Button>
          </div>
        )}

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
          
          {/* Search Bar */}
          <div className="mt-4">
            <div className="relative max-w-2xl">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Buscar por código, modelo, lote, clínica o ciudad..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-10 text-gray-900 placeholder:text-gray-400"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {searchQuery && (
              <div className="mt-2 text-sm text-gray-600">
                Mostrando <span className="font-semibold text-blue-600">{filteredEquipment.length}</span> de {equipment.length} equipos
              </div>
            )}
          </div>
          
          {/* Action Buttons */}
          <div className="mt-4 flex flex-wrap gap-2 lg:gap-3">
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
          equipment={filteredEquipment}
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
