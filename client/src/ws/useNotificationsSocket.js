import { useEffect, useRef, useCallback } from 'react'
import { queryClient } from '../api/queryClient.js'

const WS_BASE = import.meta.env.VITE_WS_BASE || 'ws://localhost:4000'

/**
 * Opens a WebSocket connection to the notifications endpoint.
 * On receiving a message, invalidates the notifications query so
 * the bell badge and list update automatically.
 */
export function useNotificationsSocket(token) {
  const wsRef = useRef(null)
  const reconnectTimeoutRef = useRef(null)

  const connect = useCallback(() => {
    if (!token) return
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const ws = new WebSocket(`${WS_BASE}/ws/notifications?token=${token}`)
    wsRef.current = ws

    ws.onopen = () => {
      // connection established
    }

    ws.onmessage = () => {
      // Any incoming message means a new notification — invalidate to refetch
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    }

    ws.onclose = (event) => {
      // Reconnect after 5 seconds unless the closure was intentional (code 1000)
      if (event.code !== 1000) {
        reconnectTimeoutRef.current = setTimeout(connect, 5000)
      }
    }

    ws.onerror = () => {
      ws.close()
    }
  }, [token])

  useEffect(() => {
    connect()

    return () => {
      clearTimeout(reconnectTimeoutRef.current)
      if (wsRef.current) {
        wsRef.current.close(1000, 'component unmounted')
        wsRef.current = null
      }
    }
  }, [connect])
}
