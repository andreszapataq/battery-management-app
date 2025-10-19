"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import type { Alert } from "@/types/equipment"
import { AlertCircle, AlertTriangle, Info, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface AlertsPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  alerts: Alert[]
  onDismiss: (alertId: string) => void
}

export function AlertsPanel({ open, onOpenChange, alerts, onDismiss }: AlertsPanelProps) {
  const activeAlerts = alerts.filter((a) => !a.dismissed)

  const severityConfig = {
    info: {
      icon: Info,
      color: "text-blue-600",
      bg: "bg-blue-50",
      border: "border-blue-200",
      badge: "bg-blue-100 text-blue-700",
    },
    warning: {
      icon: AlertTriangle,
      color: "text-orange-600",
      bg: "bg-orange-50",
      border: "border-orange-200",
      badge: "bg-orange-100 text-orange-700",
    },
    critical: {
      icon: AlertCircle,
      color: "text-red-600",
      bg: "bg-red-50",
      border: "border-red-200",
      badge: "bg-red-100 text-red-700",
    },
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            Alertas del Sistema
            {activeAlerts.length > 0 && (
              <Badge className="ml-3 bg-red-100 text-red-700">{activeAlerts.length} activas</Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 max-h-[500px] overflow-y-auto">
          {activeAlerts.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Info className="h-12 w-12 mx-auto mb-3 text-gray-400" />
              <p className="text-lg">No hay alertas activas</p>
              <p className="text-sm">Todas las operaciones están funcionando correctamente</p>
            </div>
          ) : (
            activeAlerts.map((alert) => {
              const config = severityConfig[alert.severity]
              const Icon = config.icon

              return (
                <div key={alert.id} className={`p-4 rounded-lg border ${config.bg} ${config.border}`}>
                  <div className="flex items-start gap-3">
                    <Icon className={`h-5 w-5 ${config.color} flex-shrink-0 mt-0.5`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <Badge className={config.badge}>
                          {alert.severity === "info" && "Información"}
                          {alert.severity === "warning" && "Advertencia"}
                          {alert.severity === "critical" && "Crítico"}
                        </Badge>
                        {alert.type === "battery-calibration" && (
                          <Badge className="ml-2 bg-purple-100 text-purple-700">
                            Calibración
                          </Badge>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => onDismiss(alert.id)} className="h-6 w-6 p-0">
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-sm font-medium text-gray-900 mb-1">{alert.message}</p>
                      <p className="text-xs text-gray-600">
                        Equipo: {alert.equipmentCode} • {new Date(alert.timestamp).toLocaleString("es-ES")}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
