'use client'

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { login, isFirstUser, registerUser } from "@/lib/api"

export default function Login({ onLogin }: { onLogin: (token: string) => void }) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [rememberMe, setRememberMe] = useState(false)
  const [isFirstTimeUser, setIsFirstTimeUser] = useState(false)

  useEffect(() => {
    isFirstUser().then(setIsFirstTimeUser).catch(console.error)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null) // Clear any previous error messages

    try {
      let token: string

      if (isFirstTimeUser) {
        await registerUser(username, password)
        token = await login(username, password, rememberMe)
      } else {
        token = await login(username, password, rememberMe)
      }

      onLogin(token)
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message)
      } else {
        setErrorMessage("An unexpected error occurred")
      }
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
            type="email"
            placeholder="Email"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full bg-zinc-700 text-zinc-50 border-zinc-600"
            required
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-zinc-700 text-zinc-50 border-zinc-600"
            required
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
      <AlertDialog open={!!errorMessage} onOpenChange={() => setErrorMessage(null)}>
        <AlertDialogContent className="bg-zinc-800 text-zinc-50">
          <AlertDialogHeader>
            <AlertDialogTitle>Error</AlertDialogTitle>
            <AlertDialogDescription>{errorMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setErrorMessage(null)} className="bg-zinc-700 text-zinc-50 hover:bg-zinc-600">Ok</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}