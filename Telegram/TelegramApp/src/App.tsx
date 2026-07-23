import { useEffect } from 'react'
import { initTelegram } from './telegram'
import { useGameSession } from './game/useGameSession'
import { GameShell } from './ui/GameShell'

function App() {
  useEffect(() => {
    initTelegram()
  }, [])

  const { session, offline, claimedGrants, cloudRestores, syncNow, refreshPurchases } = useGameSession()

  return (
    <GameShell
      session={session}
      offline={offline}
      claimedGrants={claimedGrants}
      cloudRestores={cloudRestores}
      syncNow={syncNow}
      refreshPurchases={refreshPurchases}
    />
  )
}

export default App
