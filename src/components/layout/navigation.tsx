'use client'

import { useUser } from '@/hooks/useUser'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Menu, Home, User, FileText, RefreshCcw, BarChart, Users, LogOut, UserPlus } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useEffect, useState } from 'react'

const getNavigationItems = (role: string) => {
  const baseItems = [
    { href: '/dashboard', label: '전체 케이스', icon: Home },
  ]

  if (role === '학생') {
    return [
      ...baseItems,
      { href: '/dashboard/my-page', label: 'My Page', icon: User },
      { href: '/dashboard/my-cases', label: 'My Cases', icon: FileText },
      { href: '/dashboard/add-case', label: '케이스 입력', icon: FileText },
      { href: '/dashboard/exchange', label: '케이스 교환', icon: RefreshCcw },
      { href: '/dashboard/transfer', label: '케이스 양도', icon: RefreshCcw },
    ]
  }

  if (role === '관리자') {
    return [
      { href: '/dashboard/admin/cases', label: '전체 케이스', icon: FileText },
      { href: '/dashboard/my-page', label: 'My Page', icon: User },
      { href: '/dashboard/admin', label: '관리자 대시보드', icon: BarChart },
      { href: '/dashboard/admin/upload', label: '엑셀 업로드', icon: FileText },
      { href: '/dashboard/admin/student-list', label: '학생 명단 관리', icon: UserPlus },
      { href: '/dashboard/admin/users', label: '사용자 관리', icon: Users },
    ]
  }

  if (role === '전공의') {
    return [
      ...baseItems,
      { href: '/dashboard/my-page', label: 'My Page', icon: User },
    ]
  }

  return baseItems
}

export function Navigation() {
  const { user, signOut } = useUser()
  const pathname = usePathname()
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  if (!user || !isClient) return null

  const navigationItems = getNavigationItems(user.role)

  const NavContent = () => (
    <>
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h1 className="text-lg font-semibold">치과 케이스 관리</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm text-muted-foreground">{user.name}</span>
            <Badge variant="secondary">{user.role}</Badge>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {navigationItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-accent hover:text-accent-foreground'
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="p-4 border-t">
        <Button
          onClick={signOut}
          variant="ghost"
          className="w-full justify-start"
        >
          <LogOut className="h-4 w-4 mr-2" />
          로그아웃
        </Button>
      </div>
    </>
  )

  return (
    <>
      <div className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0">
        <div className="flex flex-col flex-1 bg-background border-r">
          <NavContent />
        </div>
      </div>

      <div className="md:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="fixed top-4 left-4 z-40">
              <Menu className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <NavContent />
          </SheetContent>
        </Sheet>
      </div>
    </>
  )
}