import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-purple-50 to-white">
      <div className="text-center space-y-6">
        <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-600 to-purple-800 bg-clip-text text-transparent">
          PL Survivor Pool
        </h1>
        <p className="text-gray-600 text-lg">Pick wisely. Survive longest. Win big.</p>
        
        <div className="flex gap-4 justify-center pt-6">
          <Link href="/login">
            <Button size="lg" className="bg-purple-600 text-white hover:bg-purple-700">
              Login
            </Button>
          </Link>
          <Link href="/register">
            <Button size="lg" variant="outline">
              Sign Up
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
