"use client"

import type { Equipment } from "@/types/equipment"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Battery, BatteryCharging, Clock, MapPin, AlertTriangle, Building2 } from "lucide-react"
import { getChargingProgress, getTimeRemaining, getDaysSinceLastUse } from "@/lib/equipment-utils"
import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface EquipmentCardProps {
  equipment: Equipment
  onMarkCharged: (id: string) => void
  onStartCharging: (id: string, isDeepCharge: boolean) => void
  onCheckOut: (id: string, clinicName: string) => void
  onStopCharging: (id: string) => void
}

export function EquipmentCard({
  equipment,
  onMarkCharged,
  onStartCharging,
  onCheckOut,
  onStopCharging,
}: EquipmentCardProps) {
  const [showClinicDialog, setShowClinicDialog] = useState(false)
  const [clinicName, setClinicName] = useState("")

  const progress = getChargingProgress(equipment)
  const timeRemaining = getTimeRemaining(equipment)
  const daysSinceUse = getDaysSinceLastUse(equipment)
  const needsDeepCharge = daysSinceUse >= 3

  const statusConfig = {
    charging: { label: "Cargando", color: "bg-amber-100 text-amber-700 border-amber-200" },
    ready: { label: "Listo", color: "bg-green-100 text-green-700 border-green-200" },
    "in-use": { label: "En Uso", color: "bg-blue-100 text-blue-700 border-blue-200" },
    "at-clinic": { label: "En Clínica", color: "bg-purple-100 text-purple-700 border-purple-200" },
    maintenance: { label: "Mantenimiento", color: "bg-gray-100 text-gray-700 border-gray-200" },
  }

  const status = statusConfig[equipment.status]

  const handleSendToClinic = () => {
    if (clinicName.trim()) {
      onCheckOut(equipment.id, clinicName.trim())
      setClinicName("")
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

  return (
    <>
      <Card className="p-6 hover:shadow-lg transition-shadow bg-white border border-gray-200">
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

          {(equipment.status === "in-use" || equipment.status === "at-clinic") && equipment.clinicName && (
            <div className="flex items-center gap-2 text-sm text-blue-700 bg-blue-50 rounded-lg p-2 border border-blue-200">
              <Building2 className="h-4 w-4" />
              <span className="font-medium">{equipment.clinicName}</span>
            </div>
          )}

          {/* Deep Charge Warning */}
          {needsDeepCharge && equipment.status === "ready" && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-orange-700">
                <p className="font-semibold">Requiere carga profunda</p>
                <p>{daysSinceUse} días sin uso</p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            {equipment.status === "charging" && progress >= 100 && (
              <Button onClick={() => onMarkCharged(equipment.id)} className="flex-1 bg-green-600 hover:bg-green-700">
                Marcar Cargado
              </Button>
            )}

            {equipment.status === "charging" && progress < 100 && (
              <Button
                onClick={() => onStopCharging(equipment.id)}
                variant="outline"
                className="flex-1 border-red-300 text-red-700 hover:bg-red-50"
              >
                Detener Carga
              </Button>
            )}

            {equipment.status === "ready" && (
              <>
                <Button
                  onClick={() => onStartCharging(equipment.id, needsDeepCharge)}
                  variant="outline"
                  className="flex-1"
                >
                  {needsDeepCharge ? "Carga Profunda" : "Recargar"}
                </Button>
                <Button onClick={() => setShowClinicDialog(true)} className="flex-1 bg-indigo-600 hover:bg-indigo-700">
                  Enviar a Clínica
                </Button>
              </>
            )}

            {equipment.status === "at-clinic" && (
              <Button onClick={handleConnectToPatient} className="flex-1 bg-blue-600 hover:bg-blue-700">
                Conectar a Paciente
              </Button>
            )}

            {equipment.status === "in-use" && (
              <Button
                onClick={handleDisconnectFromPatient}
                variant="outline"
                className="flex-1 border-orange-300 text-orange-700 hover:bg-orange-50 bg-transparent"
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
                  if (e.key === "Enter" && clinicName.trim()) {
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
              disabled={!clinicName.trim()}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700"
            >
              Enviar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
