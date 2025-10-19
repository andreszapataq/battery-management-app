"use client"

import type React from "react"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { Equipment } from "@/types/equipment"

interface AddEquipmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (equipment: Equipment) => void
}

export function AddEquipmentDialog({ open, onOpenChange, onAdd }: AddEquipmentDialogProps) {
  const [code, setCode] = useState("")
  const [model, setModel] = useState("")
  const [lot, setLot] = useState("")
  const [notes, setNotes] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const newEquipment: Equipment = {
      id: `eq-${Date.now()}`,
      code,
      model,
      lot,
      status: "ready",
      location: "office",
      batteryLevel: 100,
      chargingStartTime: null,
      lastChargedDate: new Date().toISOString(),
      lastUsedDate: new Date().toISOString(),
      isDeepCharge: false,
      notes,
    }

    onAdd(newEquipment)

    // Reset form
    setCode("")
    setModel("")
    setLot("")
    setNotes("")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Agregar Nuevo Equipo</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="code">Código *</Label>
            <Input id="code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="TV-001" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="model">Modelo *</Label>
            <Input
              id="model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="TopiVac Pro 2024"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="lot">Lote *</Label>
            <Input id="lot" value={lot} onChange={(e) => setLot(e.target.value)} placeholder="L2024-001" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notas (opcional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Información adicional sobre el equipo..."
              rows={3}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-700">
              Agregar Equipo
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
