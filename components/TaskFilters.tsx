'use client'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

function setParam(sp: URLSearchParams, key: string, val?: string) {
  if (!val) sp.delete(key); else sp.set(key, val)
  return sp
}

function Btn({
  active, children, onClick
}: { active?: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-xl border text-sm ${active ? 'bg-gray-100' : ''}`}
    >
      {children}
    </button>
  )
}

export default function TaskFilters() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const scope = searchParams.get('scope') || 'visible' // visible | mine | created
  const status = searchParams.get('status') || ''      // todo | doing | done | (vuoto)

  function update(k: string, v?: string) {
    const sp = new URLSearchParams(searchParams.toString())
    setParam(sp, k, v)
    const url = `${pathname}?${sp.toString()}`
    router.push(url)
    router.refresh()
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Scopo */}
      <div className="flex items-center gap-1">
        <Btn active={scope==='visible'} onClick={()=>update('scope','visible')}>Visibili a me</Btn>
        <Btn active={scope==='mine'} onClick={()=>update('scope','mine')}>Assegnati a me</Btn>
        <Btn active={scope==='created'} onClick={()=>update('scope','created')}>Creati da me</Btn>
      </div>

      <span className="mx-2 opacity-50">|</span>

      {/* Stato */}
      <div className="flex items-center gap-1">
        <Btn active={status===''} onClick={()=>update('status', undefined)}>Tutti</Btn>
        <Btn active={status==='todo'} onClick={()=>update('status','todo')}>To-do</Btn>
        <Btn active={status==='doing'} onClick={()=>update('status','doing')}>Doing</Btn>
        <Btn active={status==='done'} onClick={()=>update('status','done')}>Done</Btn>
      </div>
    </div>
  )
}
