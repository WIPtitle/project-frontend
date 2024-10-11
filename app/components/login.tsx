'use client'

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { login, isFirstUser, registerUser } from "@/lib/api"
import { User } from "@/types"

export default function Login({ onLogin }: { onLogin: (user: User) => void }) {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [rememberMe, setRememberMe] = useState(false)
  const [isFirstTimeUser, setIsFirstTimeUser] = useState(false)

  useEffect(() => {
    isFirstUser().then(setIsFirstTimeUser).catch(console.error)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    let user: User

    if (isFirstTimeUser) {
      await registerUser(username, password)
      user = await login(username, password, rememberMe)
    } else {
      user = await login(username, password, rememberMe)
    }

    if (user) {
      onLogin(user)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-zinc-800">
      <form onSubmit={handleSubmit} className="p-8 bg-zinc-900 rounded-lg shadow-lg w-96">
        <h1 className="text-3xl font-bold mb-6 text-center text-zinc-50">
          {isFirstTimeUser ? "Register" : "Login"}
        </h1>
        <div className="space-y-4">
          <Input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full bg-zinc-700 text-zinc-50 border-zinc-600"
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-zinc-700 text-zinc-50 border-zinc-600"
          />
          {!isFirstTimeUser && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="remember-me"
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(checked as boolean)}
              />
              <label htmlFor="remember-me" className="text-sm text-zinc-300">Remember me</label>
            </div>
          )}
          <Button type="submit" className="w-full bg-white text-black hover:bg-zinc-200">
            {isFirstTimeUser ? "Register" : "Login"}
          </Button>
        </div>
      </form>
    </div>
  )
}