// components/BaseLayout.tsx
import Link from 'next/link';
import { ReactNode } from 'react';

interface BaseLayoutProps {
  children: ReactNode;
  user?: {
    name: string;
    role?: string;
  };
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
}

export default function BaseLayout({ 
  children, 
  user, 
  title = "Dashboard", 
  subtitle = "Benvenuto nella tua dashboard",
  actions 
}: BaseLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header comune */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-8">
              <Link href="/dashboard" className="text-xl font-bold text-gray-900">
                Denthera Tasks
              </Link>
              
              {/* Navigation semplice */}
              <nav className="hidden md:flex items-center gap-6">
                <Link href="/dashboard" className="text-gray-600 hover:text-gray-900">
                  Dashboard
                </Link>
                <Link href="/tasks" className="text-gray-600 hover:text-gray-900">
                  Tasks
                </Link>
                <Link href="/calendar" className="text-gray-600 hover:text-gray-900">
                  Calendario
                </Link>
                <Link href="/team" className="text-gray-600 hover:text-gray-900">
                  Team
                </Link>
                
                {/* Menu Admin - solo per amministratori */}
                {user?.role === 'amministratore' && (
                  <>
                    <Link href="/admin/users" className="text-gray-600 hover:text-gray-900">
                      Utenti
                    </Link>
                    <Link href="/admin/permissions" className="text-gray-600 hover:text-gray-900">
                      Permessi
                    </Link>
                    <Link href="/admin/logs" className="text-gray-600 hover:text-gray-900">
                      Log Attività
                    </Link>
                  </>
                )}
              </nav>
            </div>

            <div className="flex items-center gap-4">
              {actions}
              
              {user && (
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-900">
                      {user.name}
                    </div>
                    {user.role && (
                      <div className="text-xs text-gray-600 capitalize">
                        {user.role}
                      </div>
                    )}
                  </div>
                  
                  <form action="/logout" method="post">
                    <button className="text-gray-600 hover:text-gray-800 px-3 py-1 border rounded-md text-sm">
                      Esci
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Page Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
              <p className="text-gray-600 mt-1">{subtitle}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-6">
        {children}
      </main>
    </div>
  );
}