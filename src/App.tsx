import { useEffect, useState } from 'react'
import type { Db } from './data.ts'
import { loadDb } from './data.ts'
import { ItemDetail } from './ItemDetail.tsx'
import { SearchPage } from './SearchPage.tsx'
import { useRoute } from './route.ts'

function App() {
  const route = useRoute()
  const [db, setDb] = useState<Db>()
  const [error, setError] = useState<string>()
  const pageKey = route.page === 'item' ? `item/${route.name}` : 'search'

  // Hash navigation does not reset scroll on its own.
  useEffect(() => {
    scrollTo(0, 0)
  }, [pageKey])

  useEffect(() => {
    loadDb().then(setDb, e => setError(String(e)))
  }, [])

  if (error) {
    return <p className="status">Could not load the item data: {error}</p>
  }
  if (!db) {
    return <p className="status">Loading items...</p>
  }
  if (route.page === 'item') {
    const item = db.byName.get(route.name)
    if (!item) {
      return (
        <p className="status">
          No item named <code>{route.name}</code>.{' '}
          <a href="#/">Back to search</a>
        </p>
      )
    }
    return <ItemDetail db={db} item={item} />
  }
  return <SearchPage db={db} query={route.query} />
}

export default App
