'use server'

import { promises as fs } from 'fs'
import path from 'path'

export async function getBackendUrl(): Promise<string | null> {
  try {
    const credentialsFilePath = process.env.LT_CREDENTIALS_FILE

    if (!credentialsFilePath) {
      console.error('LT_CREDENTIALS_FILE environment variable is not set')
      return null
    }

    const fileContents = await fs.readFile(credentialsFilePath, 'utf8')

    const credentials = JSON.parse(fileContents)

    if (credentials && credentials.URL_BACKEND) {
      return credentials.URL_BACKEND
    } else {
      console.error('URL_BACKEND not found in the credentials file')
      return null
    }
  } catch (error) {
    console.error('Error reading backend URL:', error)
    return null
  }
}