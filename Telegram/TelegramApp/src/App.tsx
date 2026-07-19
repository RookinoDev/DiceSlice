import { useEffect } from 'react'
import { initTelegram } from './telegram'
import { useGameSession } from './game/useGameSession'
import { GameShell } from './ui/GameShell'

function App() {
  useEffect(() => {
    initTelegram()
  }, [])

  const { session, offline, claimedGrants, cloudRestores, syncNow } = useGameSession()

  return <GameShell session={session} offline={offline} claimedGrants={claimedGrants} cloudRestores={cloudRestores} syncNow={syncNow} />
}

export default App
