"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import type { Equipment } from "@/types/equipment"
import { MapPin } from "lucide-react"

interface CheckInDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  equipment: Equipment[]
  onCheckIn: (equipmentId: string) => void
}

export function CheckInDialog({ open, onOpenChange, equipment, onCheckIn }: CheckInDialogProps) {
  const handleCheckIn = (equipmentId: string) => {
    onCheckIn(equipmentId)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Reingresar Equipo a Oficina</DialogTitle>
          <p className="text-sm text-gray-600">Selecciona el equipo que regresa de la clínica para ponerlo a cargar</p>
        </DialogHeader>

        <div className="space-y-3 max-h-96 overflow-y-auto">
          {equipment.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No hay equipos en clínica para reingresar</div>
          ) : (
            equipment.map((eq) => (
              <div
                key={eq.id}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div>
                  <p className="font-semibold text-gray-900">{eq.code}</p>
                  <p className="text-sm text-gray-600">{eq.model}</p>
                  <p className="text-xs text-gray-500">Lote: {eq.lot}</p>
                  <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                    <MapPin className="h-3 w-3" />
                    {eq.clinicName ? `En ${eq.clinicName}` : "En clínica"}
                  </div>
                </div>
                <Button onClick={() => handleCheckIn(eq.id)} className="bg-indigo-600 hover:bg-indigo-700">
                  Reingresar
                </Button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
