'use client'

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function Login({ onLogin }: { onLogin: (username: string) => void }) {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // In a real app, you'd validate credentials here
    if (username && password) {
      localStorage.setItem("isLoggedIn", "true")
      localStorage.setItem("username", username)
      onLogin(username)
    }
  }

  return (
    <Card className="w-full max-w-md mx-auto mt-8 bg-zinc-900 text-zinc-50 border-zinc-800">
      <CardHeader>
        <CardTitle className="text-zinc-50">Login</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="bg-zinc-800 text-zinc-50 border-zinc-700"
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="bg-zinc-800 text-zinc-50 border-zinc-700"
          />
          <Button type="submit" className="w-full bg-zinc-800 text-zinc-50 hover:bg-zinc-700">
            Login
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}