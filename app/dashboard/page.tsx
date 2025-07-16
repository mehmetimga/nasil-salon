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

  // Check if user is admin
  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  const isAdmin = roleData?.role === 'admin'

  // Fetch customers based on role
  let customersQuery = supabase.from('customers').select('*')
  
  if (!isAdmin) {
    // Regular users see only their customers
    customersQuery = customersQuery.eq('user_id', user.id)
  }
  
  const { data: customers, error } = await customersQuery
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto py-8 px-4">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Customer Dashboard</h1>
            {isAdmin && (
              <p className="text-sm text-muted-foreground mt-1">
                Admin View - Showing all customers
              </p>
            )}
          </div>
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
                <CardTitle>
                  {isAdmin ? 'All Customer Records' : 'Your Customer Records'}
                </CardTitle>
                <CardDescription>
                  {isAdmin 
                    ? 'Viewing all customers across the system' 
                    : 'All your customer visits and services'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CustomerTable customers={customers || []} isAdmin={isAdmin} />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
} 