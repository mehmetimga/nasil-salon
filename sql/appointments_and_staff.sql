-- Staff table
CREATE TABLE staff (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20),
  role VARCHAR(50) DEFAULT 'Nail Technician',
  is_active BOOLEAN DEFAULT true,
  hire_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Staff services (which services each staff member can perform)
CREATE TABLE staff_services (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id UUID REFERENCES staff(id) ON DELETE CASCADE,
  service_id UUID REFERENCES services(id) ON DELETE CASCADE,
  is_expert BOOLEAN DEFAULT false, -- If they're an expert at this service
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE(staff_id, service_id)
);

-- Staff working hours
CREATE TABLE staff_schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id UUID REFERENCES staff(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0 = Sunday, 6 = Saturday
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE(staff_id, day_of_week)
);

-- Appointments table
CREATE TABLE appointments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  appointment_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show')),
  notes TEXT,
  total_price DECIMAL(10, 2),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  cancelled_at TIMESTAMP WITH TIME ZONE,
  cancellation_reason TEXT
);

-- Appointment services (for multiple services in one appointment)
CREATE TABLE appointment_services (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  appointment_id UUID REFERENCES appointments(id) ON DELETE CASCADE,
  service_id UUID REFERENCES services(id) ON DELETE CASCADE,
  price DECIMAL(10, 2) NOT NULL,
  duration_minutes INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Time slots configuration (business hours)
CREATE TABLE business_hours (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  open_time TIME NOT NULL,
  close_time TIME NOT NULL,
  is_open BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE(day_of_week)
);

-- Insert sample staff
INSERT INTO staff (name, email, phone, role) VALUES
('Sarah Johnson', 'sarah@nailsalon.com', '555-0101', 'Senior Nail Technician'),
('Maria Garcia', 'maria@nailsalon.com', '555-0102', 'Nail Technician'),
('Jessica Kim', 'jessica@nailsalon.com', '555-0103', 'Nail Art Specialist'),
('Emily Chen', 'emily@nailsalon.com', '555-0104', 'Nail Technician');

-- Set up staff schedules (Monday-Saturday, 9 AM - 7 PM)
INSERT INTO staff_schedules (staff_id, day_of_week, start_time, end_time)
SELECT 
  s.id,
  d.day,
  '09:00:00'::TIME,
  '19:00:00'::TIME
FROM staff s
CROSS JOIN generate_series(1, 6) AS d(day) -- Monday to Saturday
WHERE s.is_active = true;

-- Assign services to staff (all staff can do basic services)
INSERT INTO staff_services (staff_id, service_id)
SELECT 
  s.id,
  srv.id
FROM staff s
CROSS JOIN services srv
WHERE s.is_active = true
  AND srv.is_active = true;

-- Mark Jessica as expert in nail art
UPDATE staff_services
SET is_expert = true
WHERE staff_id = (SELECT id FROM staff WHERE name = 'Jessica Kim')
  AND service_id IN (SELECT id FROM services WHERE category_id = (SELECT id FROM service_categories WHERE name = 'Nail Art'));

-- Set up business hours
INSERT INTO business_hours (day_of_week, open_time, close_time, is_open) VALUES
(0, '10:00:00', '18:00:00', true),  -- Sunday
(1, '09:00:00', '19:00:00', true),  -- Monday
(2, '09:00:00', '19:00:00', true),  -- Tuesday
(3, '09:00:00', '19:00:00', true),  -- Wednesday
(4, '09:00:00', '19:00:00', true),  -- Thursday
(5, '09:00:00', '20:00:00', true),  -- Friday
(6, '09:00:00', '20:00:00', true);  -- Saturday

-- Create indexes for better performance
CREATE INDEX idx_appointments_date ON appointments(appointment_date);
CREATE INDEX idx_appointments_staff_date ON appointments(staff_id, appointment_date);
CREATE INDEX idx_appointments_customer ON appointments(customer_id);
CREATE INDEX idx_appointments_status ON appointments(status);

-- RLS policies for staff
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_hours ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view staff and schedules
CREATE POLICY "staff_read_policy" ON staff
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "staff_services_read_policy" ON staff_services
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "staff_schedules_read_policy" ON staff_schedules
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "business_hours_read_policy" ON business_hours
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Appointments policies
-- Users can view their own appointments
CREATE POLICY "appointments_view_own" ON appointments
  FOR SELECT USING (
    created_by = auth.uid() 
    OR 
    customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid())
  );

-- Users can create appointments for their customers
CREATE POLICY "appointments_create" ON appointments
  FOR INSERT WITH CHECK (
    created_by = auth.uid()
    AND
    customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid())
  );

-- Users can update their own appointments
CREATE POLICY "appointments_update_own" ON appointments
  FOR UPDATE USING (
    created_by = auth.uid()
    OR
    customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid())
  );

-- Admin policies for full access
CREATE POLICY "staff_admin_policy" ON staff
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

CREATE POLICY "appointments_admin_policy" ON appointments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Function to check appointment availability
CREATE OR REPLACE FUNCTION check_appointment_availability(
  p_staff_id UUID,
  p_date DATE,
  p_start_time TIME,
  p_end_time TIME,
  p_appointment_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if there are any overlapping appointments
  RETURN NOT EXISTS (
    SELECT 1
    FROM appointments
    WHERE staff_id = p_staff_id
      AND appointment_date = p_date
      AND status NOT IN ('cancelled', 'no_show')
      AND (p_appointment_id IS NULL OR id != p_appointment_id)
      AND (
        (start_time <= p_start_time AND end_time > p_start_time)
        OR
        (start_time < p_end_time AND end_time >= p_end_time)
        OR
        (start_time >= p_start_time AND end_time <= p_end_time)
      )
  );
END;
$$ LANGUAGE plpgsql;