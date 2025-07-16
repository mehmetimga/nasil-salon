'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Calendar, dateFnsLocalizer, View, Views } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import './calendar.css';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import Navigation from '@/components/Navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

const locales = {
  'en-US': enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

interface Staff {
  id: string;
  name: string;
  email: string;
}

interface Service {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
}

interface Appointment {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: {
    customer_id: string;
    staff_id: string;
    service_id: string;
    status: string;
    customer?: Customer;
    staff?: Staff;
    service?: Service;
  };
}

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>(Views.WEEK);
  const [date, setDate] = useState(new Date());
  const [showBookingDialog, setShowBookingDialog] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ start: Date; end: Date } | null>(null);
  const supabase = createClient();

  const [bookingForm, setBookingForm] = useState({
    customer_id: '',
    staff_id: '',
    service_id: '',
    notes: '',
  });

  useEffect(() => {
    fetchStaff();
    fetchServices();
    fetchCustomers();
    fetchAppointments();
  }, []);

  const fetchStaff = async () => {
    const { data, error } = await supabase
      .from('staff')
      .select('*')
      .eq('is_active', true)
      .order('name');
    
    if (error) {
      toast.error('Failed to load staff');
      console.error('Error fetching staff:', error);
    } else {
      setStaff(data || []);
    }
  };

  const fetchServices = async () => {
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('is_active', true)
      .order('name');
    
    if (error) {
      toast.error('Failed to load services');
      console.error('Error fetching services:', error);
    } else {
      setServices(data || []);
    }
  };

  const fetchCustomers = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Check if admin
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();
    
    let query = supabase.from('customers').select('*');
    
    if (roleData?.role !== 'admin') {
      query = query.eq('user_id', user.id);
    }
    
    const { data, error } = await query.order('name');
    
    if (error) {
      toast.error('Failed to load customers');
      console.error('Error fetching customers:', error);
    } else {
      setCustomers(data || []);
    }
  };

  const fetchAppointments = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('appointments')
      .select(`
        *,
        customer:customers(*),
        staff:staff(*),
        service:services(*)
      `)
      .neq('status', 'cancelled')
      .order('appointment_date');
    
    if (error) {
      toast.error('Failed to load appointments');
      console.error('Error fetching appointments:', error);
    } else {
      const formattedAppointments = (data || []).map((apt) => {
        const startDate = new Date(`${apt.appointment_date}T${apt.start_time}`);
        const endDate = new Date(`${apt.appointment_date}T${apt.end_time}`);
        
        return {
          id: apt.id,
          title: `${apt.customer?.name || 'Unknown'} - ${apt.service?.name || 'Service'}`,
          start: startDate,
          end: endDate,
          resource: {
            customer_id: apt.customer_id,
            staff_id: apt.staff_id,
            service_id: apt.service_id,
            status: apt.status,
            customer: apt.customer,
            staff: apt.staff,
            service: apt.service,
          },
        };
      });
      setAppointments(formattedAppointments);
    }
    setLoading(false);
  };

  const handleSelectSlot = useCallback(
    ({ start, end }: { start: Date; end: Date }) => {
      setSelectedSlot({ start, end });
      setShowBookingDialog(true);
    },
    []
  );

  const handleSelectEvent = useCallback(
    (event: Appointment) => {
      // Show appointment details
      const details = `
Customer: ${event.resource.customer?.name}
Staff: ${event.resource.staff?.name}
Service: ${event.resource.service?.name}
Status: ${event.resource.status}
Time: ${format(event.start, 'h:mm a')} - ${format(event.end, 'h:mm a')}
      `;
      alert(details);
    },
    []
  );

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot || !bookingForm.customer_id || !bookingForm.staff_id || !bookingForm.service_id) {
      toast.error('Please fill in all required fields');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const appointmentData = {
      customer_id: bookingForm.customer_id,
      staff_id: bookingForm.staff_id,
      service_id: bookingForm.service_id,
      appointment_date: format(selectedSlot.start, 'yyyy-MM-dd'),
      start_time: format(selectedSlot.start, 'HH:mm:ss'),
      end_time: format(selectedSlot.end, 'HH:mm:ss'),
      status: 'scheduled',
      notes: bookingForm.notes,
      created_by: user.id,
    };

    const { error } = await supabase
      .from('appointments')
      .insert([appointmentData]);

    if (error) {
      toast.error('Failed to book appointment');
      console.error('Error booking appointment:', error);
    } else {
      toast.success('Appointment booked successfully');
      setShowBookingDialog(false);
      setBookingForm({
        customer_id: '',
        staff_id: '',
        service_id: '',
        notes: '',
      });
      fetchAppointments();
    }
  };

  const eventStyleGetter = (event: Appointment) => {
    let backgroundColor = '#3174ad';
    
    switch (event.resource.status) {
      case 'confirmed':
        backgroundColor = '#16a34a';
        break;
      case 'in_progress':
        backgroundColor = '#eab308';
        break;
      case 'completed':
        backgroundColor = '#6b7280';
        break;
      case 'no_show':
        backgroundColor = '#dc2626';
        break;
    }

    return {
      style: {
        backgroundColor,
        borderRadius: '5px',
        opacity: 0.8,
        color: 'white',
        border: '0px',
        display: 'block',
      },
    };
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <div className="container mx-auto py-8 px-4">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Appointments</h1>
          <div className="flex gap-2">
            <Dialog open={showBookingDialog} onOpenChange={setShowBookingDialog}>
              <DialogTrigger asChild>
                <Button>Book Appointment</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Book New Appointment</DialogTitle>
                  <DialogDescription>
                    {selectedSlot && (
                      <span>
                        {format(selectedSlot.start, 'PPP')} at {format(selectedSlot.start, 'h:mm a')}
                      </span>
                    )}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleBookingSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="customer">Customer</Label>
                    <select
                      id="customer"
                      className="w-full p-2 border rounded"
                      value={bookingForm.customer_id}
                      onChange={(e) => setBookingForm({ ...bookingForm, customer_id: e.target.value })}
                      required
                    >
                      <option value="">Select a customer</option>
                      {customers.map((customer) => (
                        <option key={customer.id} value={customer.id}>
                          {customer.name} - {customer.phone}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="staff">Staff Member</Label>
                    <select
                      id="staff"
                      className="w-full p-2 border rounded"
                      value={bookingForm.staff_id}
                      onChange={(e) => setBookingForm({ ...bookingForm, staff_id: e.target.value })}
                      required
                    >
                      <option value="">Select staff</option>
                      {staff.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="service">Service</Label>
                    <select
                      id="service"
                      className="w-full p-2 border rounded"
                      value={bookingForm.service_id}
                      onChange={(e) => setBookingForm({ ...bookingForm, service_id: e.target.value })}
                      required
                    >
                      <option value="">Select a service</option>
                      {services.map((service) => (
                        <option key={service.id} value={service.id}>
                          {service.name} - ${service.price} ({service.duration_minutes} min)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="notes">Notes (Optional)</Label>
                    <Input
                      id="notes"
                      value={bookingForm.notes}
                      onChange={(e) => setBookingForm({ ...bookingForm, notes: e.target.value })}
                      placeholder="Any special requests or notes..."
                    />
                  </div>

                  <Button type="submit" className="w-full">Book Appointment</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Appointment Calendar</CardTitle>
            <CardDescription>
              Click on a time slot to book an appointment
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div style={{ height: 600 }}>
              {loading ? (
                <div>Loading appointments...</div>
              ) : (
                <Calendar
                  localizer={localizer}
                  events={appointments}
                  startAccessor="start"
                  endAccessor="end"
                  onSelectSlot={handleSelectSlot}
                  onSelectEvent={handleSelectEvent}
                  selectable
                  view={view}
                  onView={(newView) => setView(newView)}
                  date={date}
                  onNavigate={(newDate) => setDate(newDate)}
                  eventPropGetter={eventStyleGetter}
                  style={{ height: '100%' }}
                />
              )}
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-[#3174ad] rounded"></div>
            <span className="text-sm">Scheduled</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-[#16a34a] rounded"></div>
            <span className="text-sm">Confirmed</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-[#eab308] rounded"></div>
            <span className="text-sm">In Progress</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-[#6b7280] rounded"></div>
            <span className="text-sm">Completed</span>
          </div>
        </div>
      </div>
    </div>
  );
}