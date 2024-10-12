'use client'

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { getEmailConfig, getAlarmAudioConfig, createEmailConfig, createAlarmAudioConfig, updateEmailConfig, updateAlarmAudioConfig, deleteEmailConfig, deleteAlarmAudioConfig } from "@/lib/api"
import { EmailConfig, AlarmAudioConfig } from "@/types"


export default function Configuration() {
  const [emailConfig, setEmailConfig] = useState<EmailConfig | null>(null)
  const [alarmAudioConfig, setAlarmAudioConfig] = useState<AlarmAudioConfig | null>(null)
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false)
  const [isAudioDialogOpen, setIsAudioDialogOpen] = useState(false)
  const [editingEmailConfig, setEditingEmailConfig] = useState<EmailConfig | null>(null)
  const [editingAudioConfig, setEditingAudioConfig] = useState<AlarmAudioConfig | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const canChangeMailConfig = true
  const canChangeAlarmSound = true

  useEffect(() => {
    const fetchConfigs = async () => {
      try {
        if (canChangeMailConfig) {
          const emailCfg = await getEmailConfig()
          setEmailConfig(emailCfg)
        }
        if (canChangeAlarmSound) {
          const audioCfg = await getAlarmAudioConfig()
          setAlarmAudioConfig(audioCfg)
        }
      } catch (error) {
        setErrorMessage("Failed to fetch configurations")
      }
    }
    fetchConfigs()
  }, [canChangeMailConfig, canChangeAlarmSound])

  const handleAddEmailConfig = () => {
    setEditingEmailConfig({ smtpServer: "", port: 0, username: "", password: "", sender: "" })
    setIsEmailDialogOpen(true)
  }

  const handleAddAudioConfig = () => {
    setEditingAudioConfig({ audio: null })
    setIsAudioDialogOpen(true)
  }

  const handleEditEmailConfig = () => {
    setEditingEmailConfig(emailConfig)
    setIsEmailDialogOpen(true)
  }

  const handleEditAudioConfig = () => {
    setEditingAudioConfig(alarmAudioConfig)
    setIsAudioDialogOpen(true)
  }

  const handleDeleteEmailConfig = async () => {
    try {
      await deleteEmailConfig()
      setEmailConfig(null)
    } catch (error) {
      setErrorMessage("Failed to delete email configuration")
    }
  }

  const handleDeleteAudioConfig = async () => {
    try {
      await deleteAlarmAudioConfig()
      setAlarmAudioConfig(null)
    } catch (error) {
      setErrorMessage("Failed to delete alarm audio configuration")
    }
  }

  const handleSaveEmailConfig = async (config: EmailConfig) => {
    try {
      if (emailConfig) {
        const updatedConfig = await updateEmailConfig(config)
        setEmailConfig(updatedConfig)
      } else {
        const newConfig = await createEmailConfig(config)
        setEmailConfig(newConfig)
      }
      setIsEmailDialogOpen(false)
    } catch (error) {
      setErrorMessage("Failed to save email configuration")
    }
  }

  const handleSaveAudioConfig = async (config: AlarmAudioConfig) => {
    try {
      if (alarmAudioConfig) {
        const updatedConfig = await updateAlarmAudioConfig(config)
        setAlarmAudioConfig(updatedConfig)
      } else {
        const newConfig = await createAlarmAudioConfig(config)
        setAlarmAudioConfig(newConfig)
      }
      setIsAudioDialogOpen(false)
    } catch (error) {
      setErrorMessage("Failed to save alarm audio configuration")
    }
  }

  if (!canChangeMailConfig && !canChangeAlarmSound) {
    return null
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-4 text-zinc-50">Configuration</h1>
      <div className="grid gap-4 md:grid-cols-2">
        {canChangeMailConfig && (
          <Card className="bg-zinc-800 border-zinc-700">
            <CardHeader>
              <CardTitle className="text-zinc-50">Email Configuration</CardTitle>
            </CardHeader>
            <CardContent>
              {emailConfig ? (
                <>
                  <p className="text-zinc-300">SMTP Server: {emailConfig.smtpServer}</p>
                  <p className="text-zinc-300">Port: {emailConfig.port}</p>
                  <p className="text-zinc-300">Username: {emailConfig.username}</p>
                  <p className="text-zinc-300">Sender: {emailConfig.sender}</p>
                </>
              ) : (
                <p className="text-zinc-400">No email configuration saved</p>
              )}
            </CardContent>
            <CardFooter className="flex justify-end space-x-2">
              {emailConfig ? (
                <>
                  <Button variant="outline" className="bg-zinc-700 text-zinc-50 hover:bg-zinc-600" onClick={handleEditEmailConfig}>Edit</Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" className="bg-red-900 hover:bg-red-800">Delete</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="bg-zinc-800 text-zinc-50">
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently delete the email configuration.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="bg-zinc-700 text-zinc-50 hover:bg-zinc-600">Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteEmailConfig} className="bg-red-900 hover:bg-red-800 text-white">Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              ) : (
                <Button variant="outline" className="bg-zinc-700 text-zinc-50 hover:bg-zinc-600" onClick={handleAddEmailConfig}>Add Configuration</Button>
              )}
            </CardFooter>
          </Card>
        )}
        {canChangeAlarmSound && (
          <Card className="bg-zinc-800 border-zinc-700">
            <CardHeader>
              <CardTitle className="text-zinc-50">Alarm Audio Configuration</CardTitle>
            </CardHeader>
            <CardContent>
              {alarmAudioConfig?.audio ? (
                <p className="text-zinc-300">Audio file: {alarmAudioConfig.audio.name}</p>
              ) : (
                <p className="text-zinc-400">No alarm audio configuration saved</p>
              )}
            </CardContent>
            <CardFooter className="flex justify-end space-x-2">
              {alarmAudioConfig ? (
                <>
                  <Button variant="outline" className="bg-zinc-700 text-zinc-50 hover:bg-zinc-600" onClick={handleEditAudioConfig}>Edit</Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" className="bg-red-900 hover:bg-red-800">Delete</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="bg-zinc-800 text-zinc-50">
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently delete the alarm audio configuration.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="bg-zinc-700 text-zinc-50 hover:bg-zinc-600">Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteAudioConfig} className="bg-red-900 hover:bg-red-800 text-white">Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              ) : (
                <Button variant="outline" className="bg-zinc-700 text-zinc-50 hover:bg-zinc-600" onClick={handleAddAudioConfig}>Add Configuration</Button>
              )}
            </CardFooter>
          </Card>
        )}
      </div>
      <Dialog open={isEmailDialogOpen} onOpenChange={setIsEmailDialogOpen}>
        <DialogContent className="bg-zinc-800 text-zinc-50">
          <DialogHeader>
            <DialogTitle>{editingEmailConfig?.smtpServer ? "Edit" : "Add"} Email Configuration</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault()
            if (editingEmailConfig) {
              handleSaveEmailConfig(editingEmailConfig)
            }
          }}>
            <div className="space-y-4">
              <Input
                placeholder="SMTP Server"
                value={editingEmailConfig?.smtpServer || ""}
                onChange={(e) => setEditingEmailConfig(prev => prev ? {...prev, smtpServer: e.target.value} : null)}
                className="bg-zinc-700 text-zinc-50 border-zinc-600"
              />
              <Input
                type="number"
                placeholder="Port"
                value={editingEmailConfig?.port || ""}
                onChange={(e) => setEditingEmailConfig(prev => prev ? {...prev, port: parseInt(e.target.value)} : null)}
                className="bg-zinc-700 text-zinc-50 border-zinc-600"
              />
              <Input
                placeholder="Username"
                value={editingEmailConfig?.username || ""}
                onChange={(e) => setEditingEmailConfig(prev => prev ? {...prev, username: e.target.value} : null)}
                className="bg-zinc-700 text-zinc-50 border-zinc-600"
              />
              <Input
                type="password"
                placeholder="Password"
                value={editingEmailConfig?.password || ""}
                onChange={(e) => setEditingEmailConfig(prev => prev ? {...prev, password: e.target.value} : null)}
                className="bg-zinc-700 text-zinc-50 border-zinc-600"
              />
              <Input
                placeholder="Sender"
                value={editingEmailConfig?.sender || ""}
                onChange={(e) => setEditingEmailConfig(prev => prev ? {...prev, sender: e.target.value} : null)}
                className="bg-zinc-700 text-zinc-50 border-zinc-600"
              />
              <Button type="submit" className="w-full bg-zinc-700 text-zinc-50 hover:bg-zinc-600">
                {editingEmailConfig?.smtpServer ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={isAudioDialogOpen} onOpenChange={setIsAudioDialogOpen}>
        <DialogContent className="bg-zinc-800 text-zinc-50">
          <DialogHeader>
            <DialogTitle>{editingAudioConfig?.audio ? "Edit" : "Add"} Alarm Audio Configuration</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault()
            if (editingAudioConfig) {
              handleSaveAudioConfig(editingAudioConfig)
            }
          }}>
            <div className="space-y-4">
              <Input
                type="file"
                accept="audio/*"
                onChange={(e) => setEditingAudioConfig(prev => prev ? {...prev, audio: e.target.files?.[0] || null} : null)}
                className="bg-zinc-700 text-zinc-50 border-zinc-600"
              />
              <Button type="submit" className="w-full bg-zinc-700 text-zinc-50 hover:bg-zinc-600">
                {editingAudioConfig?.audio ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <AlertDialog open={!!errorMessage} onOpenChange={() => setErrorMessage(null)}>
        <AlertDialogContent className="bg-zinc-800 text-zinc-50">
          <AlertDialogHeader>
            <AlertDialogTitle>Error</AlertDialogTitle>
            <AlertDialogDescription>{errorMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setErrorMessage(null)} className="bg-zinc-700 text-zinc-50 hover:bg-zinc-600">OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}