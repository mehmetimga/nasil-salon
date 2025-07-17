'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import Navigation from '@/components/Navigation';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';

interface BookingRequest {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  service_id: string;
  staff_id: string | null;
  preferred_date: string;
  preferred_time: string;
  notes: string | null;
  status: 'pending' | 'confirmed' | 'rejected' | 'cancelled';
  created_at: string;
  service?: {
    name: string;
    price: number;
    duration_minutes: number;
  };
  staff?: {
    name: string;
  };
}

export default function BookingRequestsPage() {
  const [bookingRequests, setBookingRequests] = useState<BookingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState<BookingRequest | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmationDetails, setConfirmationDetails] = useState({
    date: '',
    time: '',
    staff_id: ''
  });
  const supabase = createClient();

  useEffect(() => {
    fetchBookingRequests();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchBookingRequests = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('online_booking_requests')
      .select(`
        *,
        service:services(name, price, duration_minutes),
        staff:staff(name)
      `)
      .order('created_at', { ascending: false });
    
    if (error) {
      toast.error('Failed to load booking requests');
      console.error('Error fetching booking requests:', error);
    } else {
      setBookingRequests(data || []);
    }
    setLoading(false);
  };

  const updateBookingStatus = async (bookingId: string, status: string) => {
    const { error } = await supabase
      .from('online_booking_requests')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', bookingId);

    if (error) {
      toast.error('Failed to update booking status');
      console.error('Error updating status:', error);
    } else {
      toast.success(`Booking ${status}`);
      fetchBookingRequests();
    }
  };

  const confirmBooking = async () => {
    if (!selectedBooking || !confirmationDetails.date || !confirmationDetails.time) {
      toast.error('Please fill in all confirmation details');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('You must be logged in to confirm bookings');
      return;
    }

    // Create a customer record
    const { data: customerData, error: customerError } = await supabase
      .from('customers')
      .insert([{
        user_id: user.id,
        name: selectedBooking.customer_name,
        email: selectedBooking.customer_email,
        phone: selectedBooking.customer_phone,
        service: selectedBooking.service?.name || 'Service',
        product_used: '',
        product_quantity: 0,
        service_price: selectedBooking.service?.price || 0
      }])
      .select()
      .single();

    if (customerError) {
      toast.error('Failed to create customer record');
      console.error('Customer error:', customerError);
      return;
    }

    // Create the appointment
    const { data: appointmentData, error: appointmentError } = await supabase
      .from('appointments')
      .insert([{
        customer_id: customerData.id,
        staff_id: confirmationDetails.staff_id || selectedBooking.staff_id,
        service_id: selectedBooking.service_id,
        appointment_date: confirmationDetails.date,
        start_time: confirmationDetails.time,
        end_time: calculateEndTime(confirmationDetails.time, selectedBooking.service?.duration_minutes || 30),
        status: 'confirmed',
        notes: selectedBooking.notes,
        total_price: selectedBooking.service?.price || 0,
        created_by: user.id
      }])
      .select()
      .single();

    if (appointmentError) {
      toast.error('Failed to create appointment');
      console.error('Appointment error:', appointmentError);
      return;
    }

    // Update booking request
    const { error: updateError } = await supabase
      .from('online_booking_requests')
      .update({ 
        status: 'confirmed',
        appointment_id: appointmentData.id,
        confirmed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', selectedBooking.id);

    if (updateError) {
      toast.error('Failed to update booking status');
      console.error('Update error:', updateError);
    } else {
      toast.success('Booking confirmed and appointment created!');
      setShowConfirmDialog(false);
      setSelectedBooking(null);
      fetchBookingRequests();
    }
  };

  const calculateEndTime = (startTime: string, durationMinutes: number) => {
    const [hours, minutes] = startTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + durationMinutes;
    const endHours = Math.floor(totalMinutes / 60);
    const endMinutes = totalMinutes % 60;
    return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}:00`;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      pending: 'secondary',
      confirmed: 'default',
      rejected: 'destructive',
      cancelled: 'outline'
    };
    return <Badge variant={variants[status] || 'secondary'}>{status}</Badge>;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <div className="container mx-auto py-8 px-4">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Online Booking Requests</h1>
          <p className="text-gray-600 mt-2">
            Manage booking requests from the online booking website
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Booking Requests</CardTitle>
            <CardDescription>
              Review and manage customer booking requests
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div>Loading booking requests...</div>
            ) : bookingRequests.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No booking requests yet
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date Requested</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead>Preferred Date/Time</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bookingRequests.map((booking) => (
                    <TableRow key={booking.id}>
                      <TableCell>
                        {format(new Date(booking.created_at), 'MMM dd, yyyy')}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{booking.customer_name}</div>
                          <div className="text-sm text-gray-500">{booking.customer_phone}</div>
                          <div className="text-sm text-gray-500">{booking.customer_email}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div>{booking.service?.name}</div>
                          <div className="text-sm text-gray-500">
                            ${booking.service?.price} - {booking.service?.duration_minutes} min
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div>{format(new Date(booking.preferred_date), 'MMM dd, yyyy')}</div>
                          <div className="text-sm text-gray-500">
                            {booking.preferred_time}
                            {booking.staff && ` with ${booking.staff.name}`}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(booking.status)}
                      </TableCell>
                      <TableCell>
                        {booking.status === 'pending' && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedBooking(booking);
                                setConfirmationDetails({
                                  date: booking.preferred_date,
                                  time: booking.preferred_time,
                                  staff_id: booking.staff_id || ''
                                });
                                setShowConfirmDialog(true);
                              }}
                            >
                              Confirm
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => updateBookingStatus(booking.id, 'rejected')}
                            >
                              Reject
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Confirmation Dialog */}
        <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Booking</DialogTitle>
              <DialogDescription>
                Confirm the appointment details for {selectedBooking?.customer_name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="confirm-date">Appointment Date</Label>
                <Input
                  id="confirm-date"
                  type="date"
                  value={confirmationDetails.date}
                  onChange={(e) => setConfirmationDetails({ ...confirmationDetails, date: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="confirm-time">Appointment Time</Label>
                <Input
                  id="confirm-time"
                  type="time"
                  value={confirmationDetails.time}
                  onChange={(e) => setConfirmationDetails({ ...confirmationDetails, time: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="confirm-staff">Staff Member</Label>
                <Input
                  id="confirm-staff"
                  placeholder="Staff ID (optional)"
                  value={confirmationDetails.staff_id}
                  onChange={(e) => setConfirmationDetails({ ...confirmationDetails, staff_id: e.target.value })}
                />
              </div>
              {selectedBooking?.notes && (
                <div>
                  <Label>Customer Notes</Label>
                  <p className="text-sm text-gray-600 mt-1">{selectedBooking.notes}</p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
                Cancel
              </Button>
              <Button onClick={confirmBooking}>
                Confirm Appointment
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}