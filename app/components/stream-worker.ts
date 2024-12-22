// Worker to handle stream processing
self.onmessage = async (e) => {
  const { url } = e.data
  const eventSource = new EventSource(url)

  eventSource.onmessage = async (event) => {
    // Convert base64 to ImageBitmap for efficient rendering
    const base64Data = event.data
    const response = await fetch(`data:image/webp;base64,${base64Data}`)
    const blob = await response.blob()
    const imageBitmap = await createImageBitmap(blob)

    // Create a structured message with transfer list
    const message = { type: 'frame', imageBitmap }
    const transfer = [imageBitmap]

    // Use the correct overload with transfer list
    self.postMessage(message, { transfer })
  }

  eventSource.onerror = (error) => {
    self.postMessage({ type: 'error', error: 'Stream connection error' })
    eventSource.close()
  }

  // Handle cleanup message
  self.onmessage = (e) => {
    if (e.data.type === 'cleanup') {
      eventSource.close()
      self.close()
    }
  }
}
