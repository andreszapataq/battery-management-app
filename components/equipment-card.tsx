"use client"

import type { Equipment, Alert } from "@/types/equipment"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Battery, BatteryCharging, Clock, MapPin, AlertTriangle, Building2, CheckCircle, Power } from "lucide-react"
import { getChargingProgress, getTimeRemaining, getDaysSinceLastUse, getDaysUntilDeepCharge } from "@/lib/equipment-utils"
import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface EquipmentCardProps {
  equipment: Equipment
  alerts: Alert[]
  onMarkCharged: (id: string) => void
  onStartCharging: (id: string, isDeepCharge: boolean) => void
  onCheckOut: (id: string, clinicName: string, clinicCity: string) => void
  onStopCharging: (id: string) => void
  onStartDeepCharge: (id: string) => void
  onManualDisconnect?: (id: string) => void
}

export function EquipmentCard({
  equipment,
  alerts,
  onMarkCharged,
  onStartCharging,
  onCheckOut,
  onStopCharging,
  onStartDeepCharge,
  onManualDisconnect,
}: EquipmentCardProps) {
  const [showClinicDialog, setShowClinicDialog] = useState(false)
  const [clinicName, setClinicName] = useState("")
  const [clinicCity, setClinicCity] = useState("")
  const [showDeepChargeDialog, setShowDeepChargeDialog] = useState(false)

  const progress = getChargingProgress(equipment)
  const timeRemaining = getTimeRemaining(equipment)
  const daysSinceUse = getDaysSinceLastUse(equipment)
  const daysUntilDeepCharge = getDaysUntilDeepCharge(equipment)
  
  // Check if deep charge is needed (5 days for both clinic and office equipment)
  // Both clinic and office equipment now use days-based logic
  const needsDeepCharge = daysSinceUse >= 5

  // Check if equipment has critical alerts (not just any alerts)
  // For equipment at clinic, show alerts based on days idle, not battery level
  // For equipment at office, show alerts based on battery level
  const hasCriticalAlerts = alerts.some(alert => 
    alert.equipmentId === equipment.id && 
    !alert.dismissed && 
    (alert.severity === "critical" || alert.severity === "warning") &&
    // Don't show red indicator for equipment that's already charging (they're being addressed)
    !(equipment.status === "charging" && alert.type === "clinic-idle")
  )

  const statusConfig = {
    charging: { label: "Cargando", color: "bg-amber-100 text-amber-700 border-amber-200" },
    ready: { label: "Listo", color: "bg-green-100 text-green-700 border-green-200" },
    "in-use": { label: "En Uso", color: "bg-blue-100 text-blue-700 border-blue-200" },
    "at-clinic": { label: "En Clínica", color: "bg-purple-100 text-purple-700 border-purple-200" },
    maintenance: { label: "Mantenimiento", color: "bg-gray-100 text-gray-700 border-gray-200" },
  }

  const status = statusConfig[equipment.status]

  const handleSendToClinic = () => {
    if (clinicName.trim() && clinicCity.trim()) {
      onCheckOut(equipment.id, clinicName.trim(), clinicCity.trim())
      setClinicName("")
      setClinicCity("")
      setShowClinicDialog(false)
    }
  }

  const handleConnectToPatient = () => {
    // Change status from at-clinic to in-use
    onStartCharging(equipment.id, false)
  }

  const handleDisconnectFromPatient = () => {
    // Change status from in-use back to at-clinic
    onStopCharging(equipment.id)
  }

  const handleStartDeepCharge = () => {
    onStartDeepCharge(equipment.id)
    setShowDeepChargeDialog(false)
  }

  const handleManualDisconnect = () => {
    if (onManualDisconnect) {
      onManualDisconnect(equipment.id)
    }
  }

  return (
    <>
      <Card className="p-6 hover:shadow-lg transition-shadow bg-white border border-gray-200 relative">
        {/* Critical alert indicator - only show for real problems */}
        {hasCriticalAlerts && (
          <div className="absolute -top-1 -right-1">
            {/* Pulsing ring */}
            <span className="absolute inline-flex h-6 w-6 rounded-full bg-red-500 opacity-75 animate-ping" />
            {/* Solid dot */}
            <span className="relative inline-flex h-6 w-6 rounded-full bg-red-500 shadow-lg" />
          </div>
        )}
        
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-bold text-lg text-gray-900">{equipment.code}</h3>
              <p className="text-sm text-gray-600">{equipment.model}</p>
              <p className="text-xs text-gray-500">Lote: {equipment.lot}</p>
            </div>
            <Badge className={status.color}>{status.label}</Badge>
          </div>

          {/* Battery Level */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600 flex items-center gap-1">
                {equipment.status === "charging" ? (
                  <BatteryCharging className="h-4 w-4" />
                ) : (
                  <Battery className="h-4 w-4" />
                )}
                Batería
              </span>
              <span className="font-semibold text-gray-900">{equipment.batteryLevel}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  equipment.batteryLevel >= 80
                    ? "bg-green-500"
                    : equipment.batteryLevel >= 50
                      ? "bg-amber-500"
                      : "bg-red-500"
                }`}
                style={{ width: `${equipment.batteryLevel}%` }}
              />
            </div>
          </div>

          {/* Charging Progress */}
          {equipment.status === "charging" && (
            <div className="space-y-2 bg-amber-50 rounded-lg p-3 border border-amber-200">
              <div className="flex items-center justify-between text-sm">
                <span className="text-amber-700 font-medium">
                  {equipment.isDeepCharge ? "Carga Profunda (12h)" : "Carga Normal (8h)"}
                </span>
                <span className="text-amber-900 font-semibold">{Math.floor(progress)}%</span>
              </div>
              <div className="w-full bg-amber-200 rounded-full h-2">
                <div className="bg-amber-500 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
              <div className="flex items-center gap-1 text-xs text-amber-700">
                <Clock className="h-3 w-3" />
                Tiempo restante: {timeRemaining}
              </div>
            </div>
          )}

          {/* Location */}
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <MapPin className="h-4 w-4" />
            <span>{equipment.location === "office" ? "Oficina" : "Clínica"}</span>
          </div>

          {(equipment.status === "in-use" || equipment.status === "at-clinic" || (equipment.status === "charging" && equipment.location === "clinic")) && equipment.clinicName && (
            <div className="flex items-center gap-2 text-sm text-blue-700 bg-blue-50 rounded-lg p-2 border border-blue-200">
              <Building2 className="h-4 w-4" />
              <div>
                <span className="font-medium">{equipment.clinicName}</span>
                {equipment.clinicCity && (
                  <span className="text-blue-600 ml-1">- {equipment.clinicCity}</span>
                )}
              </div>
            </div>
          )}

          {/* Deep Charge Warning */}
          {needsDeepCharge && equipment.status === "ready" && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-orange-700">
                <p className="font-semibold">Requiere carga profunda</p>
                <p>{Math.floor(daysSinceUse)} días sin uso</p>
              </div>
            </div>
          )}

          {/* Days Remaining Warning */}
          {!needsDeepCharge && daysUntilDeepCharge > 0 && daysUntilDeepCharge <= 4 && (equipment.status === "ready" || equipment.status === "at-clinic") && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
              <Clock className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-blue-700">
                <p className="font-semibold">Faltan {daysUntilDeepCharge} días</p>
                <p>para requerir carga profunda</p>
              </div>
            </div>
          )}

          {/* Manual Disconnection Notice */}
          {equipment.needsManualDisconnection && equipment.status === "charging" && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-3">
              <div className="flex items-center gap-2 text-green-700 mb-2">
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm font-medium">Carga profunda completada</span>
              </div>
              <p className="text-xs text-green-600 mb-3">
                El equipo completó la carga de 12 horas y está listo para desconectar manualmente.
              </p>
              {onManualDisconnect && (
                <Button 
                  onClick={handleManualDisconnect}
                  className="w-full bg-green-600 hover:bg-green-700 text-sm"
                >
                  <Power className="h-4 w-4 mr-2" />
                  ✅ Desconectar Manualmente
                </Button>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            {equipment.status === "charging" && progress >= 100 && (
              <Button onClick={() => onMarkCharged(equipment.id)} className="flex-1 bg-green-600 hover:bg-green-700 text-sm">
                Marcar Cargado
              </Button>
            )}

            {equipment.status === "charging" && progress < 100 && (
              <Button
                onClick={() => onStopCharging(equipment.id)}
                variant="outline"
                className="flex-1 border-red-300 text-red-700 hover:bg-red-50 text-sm"
              >
                Detener Carga
              </Button>
            )}

            {equipment.status === "ready" && (
              <>
                {/* Only show recharge button if battery is not 100% or if deep charge is needed */}
                {(equipment.batteryLevel < 100 || needsDeepCharge) && (
                  <Button
                    onClick={() => onStartCharging(equipment.id, needsDeepCharge)}
                    variant="outline"
                    className="flex-1 text-sm"
                  >
                    {needsDeepCharge ? "Carga Profunda" : "Recargar"}
                  </Button>
                )}
                <Button onClick={() => setShowClinicDialog(true)} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-sm">
                  Enviar a Clínica
                </Button>
              </>
            )}

            {equipment.status === "at-clinic" && (
              <div className="flex flex-col sm:flex-row gap-2 w-full">
                <Button onClick={handleConnectToPatient} className="flex-1 bg-blue-600 hover:bg-blue-700 text-sm">
                  Conectar a Paciente
                </Button>
                {needsDeepCharge && (
                  <Button 
                    onClick={() => setShowDeepChargeDialog(true)} 
                    variant="outline"
                    size="sm"
                    className="flex-1 border-amber-300 text-amber-700 hover:bg-amber-50 hover:border-amber-400 bg-white text-sm rounded-sm sm:rounded-md py-1"
                  >
                    <span className="text-amber-600 mr-1">[⚡]</span>
                    Carga Profunda
                  </Button>
                )}
              </div>
            )}

            {equipment.status === "in-use" && (
              <Button
                onClick={handleDisconnectFromPatient}
                variant="outline"
                className="flex-1 border-orange-300 text-orange-700 hover:bg-orange-50 bg-transparent text-sm"
              >
                Desconectar de Paciente
              </Button>
            )}
          </div>

          {/* Notes */}
          {equipment.notes && (
            <p className="text-xs text-gray-500 italic border-t border-gray-100 pt-3">{equipment.notes}</p>
          )}
        </div>
      </Card>

      <Dialog open={showClinicDialog} onOpenChange={setShowClinicDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Enviar a Clínica</DialogTitle>
            <p className="text-sm text-gray-600">Ingresa el nombre de la clínica donde se enviará el equipo</p>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="clinic-name">Nombre de la Clínica *</Label>
              <Input
                id="clinic-name"
                placeholder="Ej: Clínica Santa María"
                value={clinicName}
                onChange={(e) => setClinicName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && clinicName.trim() && clinicCity.trim()) {
                    handleSendToClinic()
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clinic-city">Ciudad *</Label>
              <Input
                id="clinic-city"
                placeholder="Ej: Bogotá"
                value={clinicCity}
                onChange={(e) => setClinicCity(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && clinicName.trim() && clinicCity.trim()) {
                    handleSendToClinic()
                  }
                }}
              />
            </div>
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <p className="text-sm text-gray-700">
                <span className="font-semibold">Equipo:</span> {equipment.code}
              </p>
              <p className="text-sm text-gray-700">
                <span className="font-semibold">Modelo:</span> {equipment.model}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowClinicDialog(false)} className="flex-1">
              Cancelar
            </Button>
            <Button
              onClick={handleSendToClinic}
              disabled={!clinicName.trim() || !clinicCity.trim()}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700"
            >
              Enviar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Deep Charge Confirmation Dialog */}
      <Dialog open={showDeepChargeDialog} onOpenChange={setShowDeepChargeDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Iniciar Carga Profunda</DialogTitle>
            <p className="text-sm text-gray-600">El equipo llevará 12 horas en carga profunda para despegar la batería</p>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
              <p className="text-sm text-amber-700">
                <span className="font-semibold">Equipo:</span> {equipment.code}
              </p>
              <p className="text-sm text-amber-700">
                <span className="font-semibold">Modelo:</span> {equipment.model}
              </p>
              <p className="text-sm text-amber-700">
                <span className="font-semibold">Clínica:</span> {equipment.clinicName} - {equipment.clinicCity}
              </p>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
              <p className="text-sm text-blue-700 font-medium">
                ⚠️ El equipo permanecerá en la clínica durante la carga profunda
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowDeepChargeDialog(false)} className="flex-1">
              Cancelar
            </Button>
            <Button
              onClick={handleStartDeepCharge}
              className="flex-1 bg-amber-600 hover:bg-amber-700"
            >
              Iniciar Carga
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
