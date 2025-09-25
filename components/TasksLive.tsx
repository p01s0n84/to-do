// components/TasksLive.tsx
'use client'
import { useEffect } from 'react'
import { subscribeTasks } from '@/lib/realtime'
import { useRouter } from 'next/navigation'

export default function TasksLive() {
  const router = useRouter()
  useEffect(() => {
    const unsub = subscribeTasks(() => router.refresh())
    return () => unsub()
  }, [router])
  return null
}
