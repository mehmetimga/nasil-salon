'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Calendar } from 'lucide-react';
import Link from 'next/link';

interface Service {
  id: string;
  name: string;
  description: string | null;
  price: number;
  duration_minutes: number;
  service_categories: {
    name: string;
  } | null;
}

interface Staff {
  id: string;
  name: string;
}

interface BusinessInfo {
  business_name: string;
  phone: string;
  email: string;
  address: string;
  description: string;
  opening_hours: Record<string, string>;
  social_media: Record<string, string>;
}

export default function BookingPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [businessInfo, setBusinessInfo] = useState<BusinessInfo | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [bookingComplete, setBookingComplete] = useState(false);
  
  const [formData, setFormData] = useState({
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    service_id: '',
    staff_id: '',
    preferred_date: '',
    preferred_time: '',
    notes: ''
  });

  const supabase = createClient();

  useEffect(() => {
    fetchBusinessInfo();
    fetchServices();
    fetchStaff();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchBusinessInfo = async () => {
    const { data, error } = await supabase
      .from('business_info')
      .select('*')
      .single();
    
    if (!error && data) {
      setBusinessInfo(data);
    }
  };

  const fetchServices = async () => {
    const { data, error } = await supabase
      .from('services')
      .select(`
        *,
        service_categories(name)
      `)
      .eq('is_active', true)
      .order('display_order');
    
    if (error) {
      console.error('Error fetching services:', error);
    } else {
      setServices(data || []);
    }
  };

  const fetchStaff = async () => {
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
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // Validate form
      if (!formData.customer_name || !formData.customer_email || !formData.customer_phone || 
          !formData.service_id || !formData.preferred_date || !formData.preferred_time) {
        toast.error('Please fill in all required fields');
        setSubmitting(false);
        return;
      }

      // Submit booking request
      const { error } = await supabase
        .from('online_booking_requests')
        .insert([{
          ...formData,
          status: 'pending'
        }]);

      if (error) {
        toast.error('Failed to submit booking request');
        console.error('Booking error:', error);
      } else {
        setBookingComplete(true);
        toast.success('Booking request submitted successfully!');
      }
    } catch (err) {
      toast.error('An error occurred. Please try again.');
      console.error('Submit error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  if (bookingComplete) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white py-12">
        <div className="container mx-auto px-4 max-w-2xl">
          <Card className="text-center">
            <CardHeader>
              <div className="mx-auto mb-4 h-20 w-20 rounded-full bg-green-100 flex items-center justify-center">
                <svg className="h-10 w-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <CardTitle className="text-2xl">Booking Request Submitted!</CardTitle>
              <CardDescription className="text-lg mt-2">
                Thank you for choosing {businessInfo?.business_name || 'our salon'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-600">
                We&apos;ve received your booking request and will contact you shortly to confirm your appointment.
              </p>
              <p className="text-sm text-gray-500">
                Please check your email for confirmation. If you don&apos;t hear from us within 24 hours, 
                please call us at {businessInfo?.phone || 'our phone number'}.
              </p>
              <Button onClick={() => window.location.reload()} className="mt-6">
                Book Another Appointment
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-gray-900">
              {businessInfo?.business_name || 'Nail Salon'}
            </h1>
            <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900">
              Staff Login
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-12">
        <div className="text-center max-w-3xl mx-auto">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Book Your Appointment Online
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            {businessInfo?.description || 'Experience luxury nail care in a relaxing environment'}
          </p>
        </div>
      </section>

      {/* Booking Form */}
      <section className="container mx-auto px-4 pb-12">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Book Your Appointment
              </CardTitle>
              <CardDescription>
                Fill in the form below to request an appointment. We&apos;ll contact you to confirm.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Personal Information */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Your Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="name">Full Name *</Label>
                      <Input
                        id="name"
                        type="text"
                        value={formData.customer_name}
                        onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.customer_email}
                        onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="phone">Phone *</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={formData.customer_phone}
                        onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Service Selection */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Select Service</h3>
                  <div>
                    <Label htmlFor="service">Service *</Label>
                    <select
                      id="service"
                      className="w-full p-2 border rounded-md"
                      value={formData.service_id}
                      onChange={(e) => setFormData({ ...formData, service_id: e.target.value })}
                      required
                    >
                      <option value="">Choose a service</option>
                      {services.map((service) => (
                        <option key={service.id} value={service.id}>
                          {service.service_categories?.name} - {service.name} 
                          (${service.price} - {service.duration_minutes} min)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Staff Selection (Optional) */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Preference</h3>
                  <div>
                    <Label htmlFor="staff">Preferred Staff Member (Optional)</Label>
                    <select
                      id="staff"
                      className="w-full p-2 border rounded-md"
                      value={formData.staff_id}
                      onChange={(e) => setFormData({ ...formData, staff_id: e.target.value })}
                    >
                      <option value="">No preference</option>
                      {staff.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Date and Time */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Date & Time</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="date">Preferred Date *</Label>
                      <Input
                        id="date"
                        type="date"
                        value={formData.preferred_date}
                        onChange={(e) => setFormData({ ...formData, preferred_date: e.target.value })}
                        min={new Date().toISOString().split('T')[0]}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="time">Preferred Time *</Label>
                      <Input
                        id="time"
                        type="time"
                        value={formData.preferred_time}
                        onChange={(e) => setFormData({ ...formData, preferred_time: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <Label htmlFor="notes">Special Requests or Notes (Optional)</Label>
                  <textarea
                    id="notes"
                    className="w-full p-2 border rounded-md"
                    rows={3}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Any special requests or information we should know?"
                  />
                </div>

                <Button 
                  type="submit" 
                  className="w-full" 
                  size="lg"
                  disabled={submitting}
                >
                  {submitting ? 'Submitting...' : 'Request Appointment'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Contact Information */}
      <section className="bg-gray-50 py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div>
              <h3 className="font-semibold text-lg mb-2">Address</h3>
              <p className="text-gray-600">
                {businessInfo?.address || '123 Main Street, City'}
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-2">Phone</h3>
              <p className="text-gray-600">
                {businessInfo?.phone || '(555) 123-4567'}
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-2">Email</h3>
              <p className="text-gray-600">
                {businessInfo?.email || 'info@nailsalon.com'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Opening Hours */}
      {businessInfo?.opening_hours && (
        <section className="container mx-auto px-4 py-12">
          <div className="max-w-2xl mx-auto">
            <h3 className="text-2xl font-bold text-center mb-8">Opening Hours</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(businessInfo.opening_hours).map(([day, hours]) => (
                <div key={day} className="flex justify-between border-b pb-2">
                  <span className="font-medium capitalize">{day}:</span>
                  <span className="text-gray-600">{hours}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}