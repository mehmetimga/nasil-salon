-- Online booking requests from non-registered customers
CREATE TABLE online_booking_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_name VARCHAR(200) NOT NULL,
  customer_email VARCHAR(255) NOT NULL,
  customer_phone VARCHAR(20) NOT NULL,
  service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  preferred_date DATE NOT NULL,
  preferred_time TIME NOT NULL,
  notes TEXT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  confirmed_at TIMESTAMP WITH TIME ZONE,
  confirmation_token UUID DEFAULT gen_random_uuid(),
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL
);

-- Index for faster lookups
CREATE INDEX idx_online_bookings_email ON online_booking_requests(customer_email);
CREATE INDEX idx_online_bookings_status ON online_booking_requests(status);
CREATE INDEX idx_online_bookings_date ON online_booking_requests(preferred_date);
CREATE INDEX idx_online_bookings_token ON online_booking_requests(confirmation_token);

-- RLS policies
ALTER TABLE online_booking_requests ENABLE ROW LEVEL SECURITY;

-- Anyone can create a booking request
CREATE POLICY "online_bookings_insert_policy" ON online_booking_requests
  FOR INSERT WITH CHECK (true);

-- Only authenticated users can view booking requests
CREATE POLICY "online_bookings_select_policy" ON online_booking_requests
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Only authenticated users can update booking requests
CREATE POLICY "online_bookings_update_policy" ON online_booking_requests
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Function to get available time slots for a given date and staff
CREATE OR REPLACE FUNCTION get_available_time_slots(
  p_date DATE,
  p_staff_id UUID,
  p_service_duration INTEGER
)
RETURNS TABLE (
  start_time TIME,
  end_time TIME
) AS $$
DECLARE
  v_day_of_week INTEGER;
  v_schedule RECORD;
  v_slot_start TIME;
  v_slot_end TIME;
BEGIN
  -- Get day of week (0 = Sunday, 6 = Saturday)
  v_day_of_week := EXTRACT(DOW FROM p_date);
  
  -- Get staff schedule for this day
  SELECT * INTO v_schedule
  FROM staff_schedules
  WHERE staff_id = p_staff_id
    AND day_of_week = v_day_of_week
    AND is_available = true;
  
  IF v_schedule IS NULL THEN
    RETURN; -- No schedule for this day
  END IF;
  
  -- Generate time slots
  v_slot_start := v_schedule.start_time;
  
  WHILE v_slot_start + (p_service_duration || ' minutes')::INTERVAL <= v_schedule.end_time LOOP
    v_slot_end := v_slot_start + (p_service_duration || ' minutes')::INTERVAL;
    
    -- Check if slot is available
    IF NOT EXISTS (
      SELECT 1
      FROM appointments
      WHERE staff_id = p_staff_id
        AND appointment_date = p_date
        AND status NOT IN ('cancelled', 'no_show')
        AND (
          (start_time <= v_slot_start AND end_time > v_slot_start)
          OR
          (start_time < v_slot_end AND end_time >= v_slot_end)
          OR
          (start_time >= v_slot_start AND end_time <= v_slot_end)
        )
    ) THEN
      RETURN QUERY SELECT v_slot_start, v_slot_end;
    END IF;
    
    -- Move to next slot (15 minute intervals)
    v_slot_start := v_slot_start + INTERVAL '15 minutes';
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Add public business information table
CREATE TABLE IF NOT EXISTS business_info (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_name VARCHAR(200) NOT NULL DEFAULT 'Glamour Nails Salon',
  phone VARCHAR(20) DEFAULT '+1 (555) 123-4567',
  email VARCHAR(255) DEFAULT 'info@glamournails.com',
  address TEXT DEFAULT '123 Beauty Street, Fashion District, NY 10001',
  description TEXT DEFAULT 'Welcome to Glamour Nails - Your premier destination for nail care and beauty. We offer professional nail services in a relaxing, hygienic environment.',
  opening_hours JSONB DEFAULT '{
    "monday": "9:00 AM - 7:00 PM",
    "tuesday": "9:00 AM - 7:00 PM",
    "wednesday": "9:00 AM - 7:00 PM",
    "thursday": "9:00 AM - 7:00 PM",
    "friday": "9:00 AM - 8:00 PM",
    "saturday": "9:00 AM - 8:00 PM",
    "sunday": "10:00 AM - 6:00 PM"
  }'::jsonb,
  social_media JSONB DEFAULT '{
    "facebook": "https://facebook.com/glamournails",
    "instagram": "https://instagram.com/glamournails",
    "twitter": "https://twitter.com/glamournails"
  }'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Insert default business info
INSERT INTO business_info (id) VALUES (gen_random_uuid()) ON CONFLICT DO NOTHING;

-- Allow public read access to business info
ALTER TABLE business_info ENABLE ROW LEVEL SECURITY;

CREATE POLICY "business_info_public_read" ON business_info
  FOR SELECT USING (true);

CREATE POLICY "business_info_admin_write" ON business_info
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );