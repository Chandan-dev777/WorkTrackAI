import { useEffect, useState } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { useThemeStore } from '@/store/themeStore'
import { AppRouter } from './router'
import ConsentPage from '@/pages/ConsentPage'

const CONSENT_KEY = 'dailyops-consent-v1'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
})

function App() {
  const theme = useThemeStore((s) => s.theme)
  // sessionStorage: consent shown every new browser session/tab, not on refresh
  const [consented, setConsented] = useState<boolean>(
    () => sessionStorage.getItem(CONSENT_KEY) === 'accepted'
  )

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  function handleAccept() {
    sessionStorage.setItem(CONSENT_KEY, 'accepted')
    setConsented(true)
  }

  if (!consented) {
    return <ConsentPage onAccept={handleAccept} />
  }

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRouter />
        <Toaster position="bottom-right" richColors closeButton />
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
