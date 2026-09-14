import { Tree } from 'fluid-framework'
import { useEffect, useState } from 'react'
import './App.css'
import type { Counter } from './fluid/schema'

function App({ counter }: { counter: Counter }) {
  const [count, setCount] = useState(counter.count)

  useEffect(() => {
    // All UI updates flow through this subscription, so local button
    // clicks and remote edits from other clients render identically.
    const unsubscribe = Tree.on(counter, 'nodeChanged', () => {
      setCount(counter.count)
    })
    return unsubscribe
  }, [counter])

  return (
    <main>
      <h1>Shared counter</h1>
      <p className="count">{count}</p>
      <button onClick={() => counter.increment()}>+1</button>
    </main>
  )
}

export default App
