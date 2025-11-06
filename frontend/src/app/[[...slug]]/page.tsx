import '../../index.css'
import { ClientOnly } from './client'

export function generateStaticParams() {
  // Generate static paths for known routes
  // React Router will handle client-side routing
  return [
    { slug: [] }, // Root path
    { slug: ['search'] }, // Search page
  ]
}

export default function Page() {
  return <ClientOnly />
}

