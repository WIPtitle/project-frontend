import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type Device = {
  id: number
  name: string
}

type AlarmCard = {
  id: number
  name: string
  devices: Device[]
}

const alarmCards: AlarmCard[] = [
  {
    id: 1,
    name: "Home Alarm",
    devices: [
      { id: 1, name: "Front Door Sensor" },
      { id: 2, name: "Living Room Motion Detector" },
    ],
  },
  {
    id: 2,
    name: "Office Alarm",
    devices: [
      { id: 3, name: "Main Entrance Sensor" },
      { id: 4, name: "Server Room Sensor" },
    ],
  },
]

export default function Alarm() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {alarmCards.map((card) => (
        <Card key={card.id} className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-zinc-50">{card.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-5 text-zinc-300">
              {card.devices.map((device) => (
                <li key={device.id}>{device.name}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}