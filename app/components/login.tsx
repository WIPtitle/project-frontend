'use client'

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { loginAndSetToken, isFirstUser, registerUser } from "@/lib/api"

// Validation function for username
function validateUsername(username: string): string | null {
  if (username.length <= 3) {
    return "Username must be more than 3 characters long"
  }
  // Allow letters, numbers, dash, underscore, and basic punctuation (no backslash)
  const usernameRegex = /^[a-zA-Z0-9_\-.,;:'"!? ]+$/
  if (!usernameRegex.test(username)) {
    return "Username can only contain letters, numbers, dash, underscore, and basic punctuation (no backslash)"
  }
  return null
}

export default function Component({ onLogin }: { onLogin: (token: string) => void }) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [pin, setPin] = useState("")
  const [pinError, setPinError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [usernameError, setUsernameError] = useState<string | null>(null)
  const [rememberMe, setRememberMe] = useState(false)
  const [isFirstTimeUser, setIsFirstTimeUser] = useState<boolean | null>(null)

  useEffect(() => {
    isFirstUser().then(setIsFirstTimeUser).catch(console.error)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setPinError(null)
    setPasswordError(null)
    setUsernameError(null)

    // Validate username
    const usernameValidation = validateUsername(username)
    if (usernameValidation) {
      setUsernameError(usernameValidation)
      return
    }

    if (isFirstTimeUser) {
      if (password.length < 5) {
        setPasswordError("Password must be at least 5 characters long")
        return
      }
      if (password !== confirmPassword) {
        setPasswordError("Passwords do not match")
        return
      }
      if (pin.length < 4 || pin.length > 8) {
        setPinError("PIN must be between 4 and 8 digits")
        return
      }
    }

    try {
      let token: string

      if (isFirstTimeUser) {
        await registerUser(username, password, pin)
        token = await loginAndSetToken(username, password, rememberMe)
      } else {
        token = await loginAndSetToken(username, password, rememberMe)
      }

      onLogin(token)
    } catch (error) {
      setErrorMessage(isFirstTimeUser ? "Registration failed" : "Login failed")
    }
  }

  if (isFirstTimeUser === null) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-800">
        <div className="text-2xl font-bold text-zinc-50">Loading...</div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-zinc-800">
      <form onSubmit={handleSubmit} className="p-8 bg-zinc-900 rounded-lg shadow-lg w-96">
        <h1 className="text-3xl font-bold mb-6 text-center text-zinc-50">
          {isFirstTimeUser ? "Register" : "Login"}
        </h1>
        <div className="space-y-4">
          <div>
            <Input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value)
                setUsernameError(null)
              }}
              className="w-full bg-zinc-700 text-zinc-50 border-zinc-600"
              required
            />
            {usernameError && <p className="text-red-500 text-sm mt-1">{usernameError}</p>}
          </div>
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-zinc-700 text-zinc-50 border-zinc-600"
            required
          />
          {isFirstTimeUser && (
            <>
              <Input
                type="password"
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-zinc-700 text-zinc-50 border-zinc-600"
                required
              />
              <Input
                type="text"
                placeholder="PIN"
                value={pin}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '')
                  if (value.length > 8) return
                  if (/^\d+$/.test(value) || value === '') {
                    setPin(value)
                    setPinError(null)
                  } else {
                    setPinError("PIN must contain only numbers")
                  }
                }}
                className="w-full bg-zinc-700 text-zinc-50 border-zinc-600"
                required
              />
            </>
          )}
          {passwordError && <p className="text-red-500 text-sm">{passwordError}</p>}
          {pinError && <p className="text-red-500 text-sm">{pinError}</p>}
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