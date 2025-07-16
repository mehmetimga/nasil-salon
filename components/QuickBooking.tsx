'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

interface Staff {
  id: string;
  name: string;
}

interface Service {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
  service_categories?: { name: string } | null;
}

interface QuickBookingProps {
  customerId: string;
  customerName: string;
}

export default function QuickBooking({ customerId, customerName }: QuickBookingProps) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [formData, setFormData] = useState({
    staff_id: '',
    service_id: '',
    date: new Date().toISOString().split('T')[0],
    time: '',
  });

  const fetchStaff = useCallback(async () => {
    const { data, error } = await supabase
      .from('staff')
      .select('id, name')
      .eq('is_active', true)
      .order('name');
    
    if (error) {
      console.error('Error fetching staff:', error);
    } else {
      setStaff(data || []);
    }
  }, [supabase]);

  const fetchServices = useCallback(async () => {
    const { data, error } = await supabase
      .from('services')
      .select('id, name, price, duration_minutes, service_categories(name)')
      .eq('is_active', true)
      .order('display_order');
    
    if (error) {
      console.error('Error fetching services:', error);
    } else if (data) {
      const formattedServices = data.map((service) => ({
        id: service.id,
        name: service.name,
        price: service.price,
        duration_minutes: service.duration_minutes,
        service_categories: service.service_categories || null
      }));
      setServices(formattedServices as unknown as Service[]);
    }
  }, [supabase]);

  useEffect(() => {
    fetchStaff();
    fetchServices();
  }, [fetchStaff, fetchServices]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('Please log in to book appointments');
      setLoading(false);
      return;
    }

    // Calculate end time based on service duration
    const selectedService = services.find(s => s.id === formData.service_id);
    if (!selectedService) {
      toast.error('Please select a service');
      setLoading(false);
      return;
    }

    const startTime = new Date(`${formData.date}T${formData.time}`);
    const endTime = new Date(startTime.getTime() + selectedService.duration_minutes * 60000);

    const appointmentData = {
      customer_id: customerId,
      staff_id: formData.staff_id,
      service_id: formData.service_id,
      appointment_date: formData.date,
      start_time: formData.time + ':00',
      end_time: endTime.toTimeString().split(' ')[0],
      status: 'scheduled',
      total_price: selectedService.price,
      created_by: user.id,
    };

    const { error } = await supabase
      .from('appointments')
      .insert([appointmentData]);

    if (error) {
      toast.error('Failed to book appointment: ' + error.message);
      console.error('Error booking appointment:', error);
    } else {
      toast.success('Appointment booked successfully!');
      // Redirect to appointments page
      router.push('/dashboard/appointments');
    }

    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h3 className="font-semibold text-lg mb-2">Quick Booking for {customerName}</h3>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="date">Date</Label>
          <Input
            id="date"
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            min={new Date().toISOString().split('T')[0]}
            required
          />
        </div>

        <div>
          <Label htmlFor="time">Time</Label>
          <Input
            id="time"
            type="time"
            value={formData.time}
            onChange={(e) => setFormData({ ...formData, time: e.target.value })}
            min="09:00"
            max="19:00"
            required
          />
        </div>
      </div>

      <div>
        <Label htmlFor="service">Service</Label>
        <select
          id="service"
          className="w-full p-2 border rounded"
          value={formData.service_id}
          onChange={(e) => setFormData({ ...formData, service_id: e.target.value })}
          required
        >
          <option value="">Select a service</option>
          {services.map((service) => (
            <option key={service.id} value={service.id}>
              {service.service_categories?.name} - {service.name} (${service.price})
            </option>
          ))}
        </select>
      </div>

      <div>
        <Label htmlFor="staff">Staff Member</Label>
        <select
          id="staff"
          className="w-full p-2 border rounded"
          value={formData.staff_id}
          onChange={(e) => setFormData({ ...formData, staff_id: e.target.value })}
          required
        >
          <option value="">Select staff member</option>
          {staff.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name}
            </option>
          ))}
        </select>
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Booking...' : 'Book Appointment'}
      </Button>
    </form>
  );
}