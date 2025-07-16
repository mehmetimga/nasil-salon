import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CustomerTable from '@/components/CustomerTable'
import CustomerForm from '@/components/CustomerForm'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

import LogoutButton from '@/components/LogoutButton'

export default async function DashboardPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  const { data: customers, error } = await supabase
    .from('customers')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto py-8 px-4">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Customer Dashboard</h1>
          <LogoutButton />
        </div>
        
        <div className="grid gap-8 md:grid-cols-1 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Add New Customer</CardTitle>
                <CardDescription>
                  Record a new customer visit
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CustomerForm userId={user.id} />
              </CardContent>
            </Card>
          </div>
          
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Customer Records</CardTitle>
                <CardDescription>
                  All your customer visits and services
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CustomerTable customers={customers || []} />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
} 