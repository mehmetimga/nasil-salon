'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import Navigation from '@/components/Navigation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  TrendingUp,
  TrendingDown,
  Users,
  Calendar,
  DollarSign,
  Activity,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface RevenueData {
  date: string;
  revenue: number;
  appointment_count: number;
  service_revenue: number;
  product_revenue: number;
}

interface TopService {
  service_id: string;
  service_name: string;
  category_name: string;
  booking_count: number;
  total_revenue: number;
  avg_price: number;
}

interface StaffPerformance {
  staff_id: string;
  staff_name: string;
  appointments_completed: number;
  total_revenue: number;
  avg_service_time: string;
  utilization_rate: number;
}

interface CustomerAnalytics {
  new_customers: number;
  returning_customers: number;
  total_visits: number;
  avg_ticket_size: number;
  retention_rate: number;
}

interface AppointmentAnalytics {
  total_appointments: number;
  completed_appointments: number;
  cancelled_appointments: number;
  no_show_appointments: number;
  completion_rate: number;
  avg_appointments_per_day: number;
  peak_hour: number;
  peak_day_of_week: number;
}

interface InventoryAnalytics {
  total_products: number;
  low_stock_count: number;
  out_of_stock_count: number;
  total_inventory_value: number;
  total_retail_value: number;
  potential_profit: number;
  top_moving_products: Array<{ name: string; quantity_sold: number }>;
}

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('30');
  const [revenueData, setRevenueData] = useState<RevenueData[]>([]);
  const [topServices, setTopServices] = useState<TopService[]>([]);
  const [staffPerformance, setStaffPerformance] = useState<StaffPerformance[]>([]);
  const [customerAnalytics, setCustomerAnalytics] = useState<CustomerAnalytics | null>(null);
  const [appointmentAnalytics, setAppointmentAnalytics] = useState<AppointmentAnalytics | null>(null);
  const [inventoryAnalytics, setInventoryAnalytics] = useState<InventoryAnalytics | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    checkUserRole();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isAdmin !== null) {
      fetchAnalytics();
    }
  }, [dateRange, isAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  const checkUserRole = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();
      
      setIsAdmin(roleData?.role === 'admin');
    }
  };

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(dateRange));

      // Fetch revenue data
      const { data: revenue, error: revenueError } = await supabase
        .rpc('get_revenue_by_period', {
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
        });

      if (revenueError) throw revenueError;
      setRevenueData(revenue || []);

      // Fetch top services
      const { data: services, error: servicesError } = await supabase
        .rpc('get_top_services', {
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
        });

      if (servicesError) throw servicesError;
      setTopServices(services || []);

      // Fetch staff performance (admin only)
      if (isAdmin) {
        const { data: staff, error: staffError } = await supabase
          .rpc('get_staff_performance', {
            start_date: startDate.toISOString().split('T')[0],
            end_date: endDate.toISOString().split('T')[0],
          });

        if (staffError) throw staffError;
        setStaffPerformance(staff || []);
      }

      // Fetch customer analytics
      const { data: customers, error: customersError } = await supabase
        .rpc('get_customer_analytics', {
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
        });

      if (customersError) throw customersError;
      setCustomerAnalytics(customers?.[0] || null);

      // Fetch appointment analytics
      const { data: appointments, error: appointmentsError } = await supabase
        .rpc('get_appointment_analytics', {
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
        });

      if (appointmentsError) throw appointmentsError;
      setAppointmentAnalytics(appointments?.[0] || null);

      // Fetch inventory analytics
      const { data: inventory, error: inventoryError } = await supabase
        .rpc('get_inventory_analytics');

      if (inventoryError) throw inventoryError;
      setInventoryAnalytics(inventory?.[0] || null);

    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast.error('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  const calculateTotalRevenue = () => {
    return revenueData.reduce((sum, day) => sum + parseFloat(day.revenue.toString()), 0);
  };

  const calculateRevenueGrowth = () => {
    if (revenueData.length < 2) return 0;
    const midPoint = Math.floor(revenueData.length / 2);
    const firstHalf = revenueData.slice(0, midPoint).reduce((sum, day) => sum + parseFloat(day.revenue.toString()), 0);
    const secondHalf = revenueData.slice(midPoint).reduce((sum, day) => sum + parseFloat(day.revenue.toString()), 0);
    
    if (firstHalf === 0) return 100;
    return ((secondHalf - firstHalf) / firstHalf) * 100;
  };

  const getDayOfWeek = (dow: number) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dow];
  };

  const formatHour = (hour: number) => {
    if (hour === 0) return '12 AM';
    if (hour === 12) return '12 PM';
    return hour > 12 ? `${hour - 12} PM` : `${hour} AM`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="container mx-auto py-8 px-4">
          <div>Loading analytics...</div>
        </div>
      </div>
    );
  }

  const totalRevenue = calculateTotalRevenue();
  const revenueGrowth = calculateRevenueGrowth();

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <div className="container mx-auto py-8 px-4">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Revenue Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${totalRevenue.toFixed(2)}</div>
              <div className="flex items-center text-xs text-muted-foreground">
                {revenueGrowth > 0 ? (
                  <>
                    <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
                    <span className="text-green-500">+{revenueGrowth.toFixed(1)}%</span>
                  </>
                ) : (
                  <>
                    <TrendingDown className="h-3 w-3 text-red-500 mr-1" />
                    <span className="text-red-500">{revenueGrowth.toFixed(1)}%</span>
                  </>
                )}
                <span className="ml-1">from previous period</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Appointments</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{appointmentAnalytics?.total_appointments || 0}</div>
              <p className="text-xs text-muted-foreground">
                {appointmentAnalytics?.completion_rate || 0}% completion rate
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">New Customers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{customerAnalytics?.new_customers || 0}</div>
              <p className="text-xs text-muted-foreground">
                {customerAnalytics?.retention_rate || 0}% retention rate
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Ticket Size</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${customerAnalytics?.avg_ticket_size?.toFixed(2) || '0.00'}
              </div>
              <p className="text-xs text-muted-foreground">
                Per customer visit
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Top Services */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Top Services</CardTitle>
            <CardDescription>
              Most popular services by booking count
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topServices.slice(0, 5).map((service, index) => (
                <div key={service.service_id} className="flex items-center">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                    {index + 1}
                  </div>
                  <div className="ml-4 flex-1">
                    <p className="text-sm font-medium">{service.service_name}</p>
                    <p className="text-xs text-muted-foreground">{service.category_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{service.booking_count} bookings</p>
                    <p className="text-xs text-muted-foreground">${service.total_revenue?.toFixed(2) || '0.00'}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Staff Performance (Admin Only) */}
        {isAdmin && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Staff Performance</CardTitle>
              <CardDescription>
                Staff productivity and revenue generation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {staffPerformance.map((staff) => (
                  <div key={staff.staff_id} className="flex items-center">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{staff.staff_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {staff.appointments_completed} appointments • {staff.utilization_rate}% utilization
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">${staff.total_revenue?.toFixed(2) || '0.00'}</p>
                      <p className="text-xs text-muted-foreground">Revenue generated</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Appointment Insights */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <Card>
            <CardHeader>
              <CardTitle>Appointment Status Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Completed</span>
                  <Badge variant="default">
                    {appointmentAnalytics?.completed_appointments || 0}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Cancelled</span>
                  <Badge variant="secondary">
                    {appointmentAnalytics?.cancelled_appointments || 0}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">No Show</span>
                  <Badge variant="destructive">
                    {appointmentAnalytics?.no_show_appointments || 0}
                  </Badge>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t">
                <p className="text-xs text-muted-foreground">
                  Peak hour: {formatHour(appointmentAnalytics?.peak_hour || 0)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Peak day: {getDayOfWeek(appointmentAnalytics?.peak_day_of_week || 0)}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Inventory Insights</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Total Products</span>
                  <span className="font-medium">{inventoryAnalytics?.total_products || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Low Stock</span>
                  <Badge variant="secondary">
                    {inventoryAnalytics?.low_stock_count || 0}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Out of Stock</span>
                  <Badge variant="destructive">
                    {inventoryAnalytics?.out_of_stock_count || 0}
                  </Badge>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t">
                <p className="text-xs text-muted-foreground">
                  Inventory value: ${inventoryAnalytics?.total_inventory_value?.toFixed(2) || '0.00'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Potential profit: ${inventoryAnalytics?.potential_profit?.toFixed(2) || '0.00'}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Customer Insights */}
        <Card>
          <CardHeader>
            <CardTitle>Customer Analytics</CardTitle>
            <CardDescription>
              Customer acquisition and retention metrics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">New Customers</p>
                <p className="text-2xl font-bold">{customerAnalytics?.new_customers || 0}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Returning Customers</p>
                <p className="text-2xl font-bold">{customerAnalytics?.returning_customers || 0}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Visits</p>
                <p className="text-2xl font-bold">{customerAnalytics?.total_visits || 0}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Retention Rate</p>
                <p className="text-2xl font-bold">{customerAnalytics?.retention_rate || 0}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}