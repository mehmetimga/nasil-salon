import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CustomerTable from '@/components/CustomerTable'
import CustomerForm from '@/components/CustomerForm'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Navigation from '@/components/Navigation'
import LogoutButton from '@/components/LogoutButton'

export default async function DashboardPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  // Check if user is admin - with fallback
  let isAdmin = false
  let roleData: { role: string } | null = null
  
  try {
    const { data, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    roleData = data

    // Debug logging
    console.log('User ID:', user.id)
    console.log('Role Data:', roleData)
    console.log('Role Error:', roleError)

    isAdmin = roleData?.role === 'admin'
  } catch (error) {
    console.error('Error checking admin role:', error)
    // Temporary: Check email as fallback
    isAdmin = user.email === 'imgamehmet@gmail.com'
  }
  
  // Additional fallback check
  if (!isAdmin && user.email === 'imgamehmet@gmail.com') {
    console.log('Using email fallback for admin check')
    isAdmin = true
  }

  // Fetch customers based on role
  let customersQuery = supabase.from('customers').select('*')
  
  if (!isAdmin) {
    // Regular users see only their customers
    customersQuery = customersQuery.eq('user_id', user.id)
  }
  
  const { data: customers } = await customersQuery
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <div className="container mx-auto py-8 px-4">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Customer Dashboard</h1>
            {isAdmin && (
              <p className="text-sm text-muted-foreground mt-1">
                Admin View - Showing all customers
              </p>
            )}
            {/* Debug info - remove this after testing */}
            <p className="text-xs text-gray-500 mt-2">
              User: {user.email} | Role: {roleData?.role || 'none'} | Admin: {isAdmin ? 'Yes' : 'No'} | Method: {roleData ? 'Database' : 'Email Fallback'}
            </p>
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