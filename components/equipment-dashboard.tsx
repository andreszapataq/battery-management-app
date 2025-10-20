import type { Equipment, Alert } from "@/types/equipment"
import { EquipmentCard } from "./equipment-card"

interface EquipmentDashboardProps {
  equipment: Equipment[]
  alerts: Alert[]
  onMarkCharged: (id: string) => void
  onStartCharging: (id: string, isDeepCharge: boolean) => void
  onCheckOut: (id: string, clinicName: string, clinicCity: string) => void
  onStopCharging: (id: string) => void
  onStartDeepCharge: (id: string) => void
}

export function EquipmentDashboard({
  equipment,
  alerts,
  onMarkCharged,
  onStartCharging,
  onCheckOut,
  onStopCharging,
  onStartDeepCharge,
}: EquipmentDashboardProps) {
  const chargingEquipment = equipment.filter((e) => e.status === "charging")
  const readyEquipment = equipment.filter((e) => e.status === "ready")
  const atClinicEquipment = equipment.filter((e) => e.status === "at-clinic")
  const inUseEquipment = equipment.filter((e) => e.status === "in-use")

  return (
    <div className="space-y-8">
      {/* Charging Section */}
      {chargingEquipment.length > 0 && (
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Equipos en Carga ({chargingEquipment.length})</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {chargingEquipment.map((eq) => (
              <EquipmentCard
                key={eq.id}
                equipment={eq}
                alerts={alerts}
                onMarkCharged={onMarkCharged}
                onStartCharging={onStartCharging}
                onCheckOut={onCheckOut}
                onStopCharging={onStopCharging}
                onStartDeepCharge={onStartDeepCharge}
              />
            ))}
          </div>
        </section>
      )}

      {/* Ready Section */}
      {readyEquipment.length > 0 && (
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Equipos Listos ({readyEquipment.length})</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {readyEquipment.map((eq) => (
              <EquipmentCard
                key={eq.id}
                equipment={eq}
                alerts={alerts}
                onMarkCharged={onMarkCharged}
                onStartCharging={onStartCharging}
                onCheckOut={onCheckOut}
                onStopCharging={onStopCharging}
                onStartDeepCharge={onStartDeepCharge}
              />
            ))}
          </div>
        </section>
      )}

      {/* At Clinic Section */}
      {atClinicEquipment.length > 0 && (
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Equipos en Clínica - Disponibles ({atClinicEquipment.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {atClinicEquipment.map((eq) => (
              <EquipmentCard
                key={eq.id}
                equipment={eq}
                alerts={alerts}
                onMarkCharged={onMarkCharged}
                onStartCharging={onStartCharging}
                onCheckOut={onCheckOut}
                onStopCharging={onStopCharging}
                onStartDeepCharge={onStartDeepCharge}
              />
            ))}
          </div>
        </section>
      )}

      {/* In Use Section */}
      {inUseEquipment.length > 0 && (
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Equipos en Uso - Conectados a Paciente ({inUseEquipment.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {inUseEquipment.map((eq) => (
              <EquipmentCard
                key={eq.id}
                equipment={eq}
                alerts={alerts}
                onMarkCharged={onMarkCharged}
                onStartCharging={onStartCharging}
                onCheckOut={onCheckOut}
                onStopCharging={onStopCharging}
                onStartDeepCharge={onStartDeepCharge}
              />
            ))}
          </div>
        </section>
      )}

      {equipment.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">No hay equipos registrados. Agrega tu primer equipo para comenzar.</p>
        </div>
      )}
    </div>
  )
}
