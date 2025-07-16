-- Service categories table
CREATE TABLE service_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Services table
CREATE TABLE services (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID REFERENCES service_categories(id) ON DELETE SET NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  price DECIMAL(10, 2) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  requires_consultation BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Service add-ons table (for additional treatments/upgrades)
CREATE TABLE service_addons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  service_id UUID REFERENCES services(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  duration_minutes INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Insert sample service categories
INSERT INTO service_categories (name, description, display_order) VALUES
('Manicure', 'Hand and nail care services', 1),
('Pedicure', 'Foot and nail care services', 2),
('Nail Art', 'Creative nail designs and decorations', 3),
('Nail Extensions', 'Artificial nail enhancements', 4),
('Nail Treatment', 'Therapeutic and repair services', 5);

-- Insert sample services
INSERT INTO services (category_id, name, description, duration_minutes, price, display_order) VALUES
-- Manicure services
((SELECT id FROM service_categories WHERE name = 'Manicure'), 'Classic Manicure', 'Basic nail shaping, cuticle care, and polish', 30, 25.00, 1),
((SELECT id FROM service_categories WHERE name = 'Manicure'), 'Gel Manicure', 'Long-lasting gel polish application', 45, 40.00, 2),
((SELECT id FROM service_categories WHERE name = 'Manicure'), 'French Manicure', 'Classic french tip design', 45, 35.00, 3),
((SELECT id FROM service_categories WHERE name = 'Manicure'), 'Spa Manicure', 'Luxurious treatment with exfoliation and massage', 60, 50.00, 4),

-- Pedicure services
((SELECT id FROM service_categories WHERE name = 'Pedicure'), 'Classic Pedicure', 'Basic foot care and polish', 45, 35.00, 1),
((SELECT id FROM service_categories WHERE name = 'Pedicure'), 'Gel Pedicure', 'Long-lasting gel polish for toes', 60, 50.00, 2),
((SELECT id FROM service_categories WHERE name = 'Pedicure'), 'Spa Pedicure', 'Deluxe treatment with massage and mask', 75, 65.00, 3),

-- Nail Art services
((SELECT id FROM service_categories WHERE name = 'Nail Art'), 'Simple Nail Art', 'Basic designs on 2 nails', 15, 10.00, 1),
((SELECT id FROM service_categories WHERE name = 'Nail Art'), 'Complex Nail Art', 'Intricate designs on all nails', 30, 25.00, 2),
((SELECT id FROM service_categories WHERE name = 'Nail Art'), '3D Nail Art', 'Three-dimensional decorations', 45, 35.00, 3),

-- Nail Extensions
((SELECT id FROM service_categories WHERE name = 'Nail Extensions'), 'Acrylic Full Set', 'Full set of acrylic extensions', 90, 80.00, 1),
((SELECT id FROM service_categories WHERE name = 'Nail Extensions'), 'Gel Extensions', 'Full set of gel extensions', 90, 85.00, 2),
((SELECT id FROM service_categories WHERE name = 'Nail Extensions'), 'Dip Powder Nails', 'Dip powder application', 60, 65.00, 3),

-- Nail Treatment
((SELECT id FROM service_categories WHERE name = 'Nail Treatment'), 'Nail Repair', 'Fix broken or damaged nails', 15, 15.00, 1),
((SELECT id FROM service_categories WHERE name = 'Nail Treatment'), 'Strengthening Treatment', 'Nail strengthening therapy', 30, 30.00, 2),
((SELECT id FROM service_categories WHERE name = 'Nail Treatment'), 'Cuticle Treatment', 'Intensive cuticle care', 20, 20.00, 3);

-- Insert sample add-ons
INSERT INTO service_addons (service_id, name, price, duration_minutes) VALUES
((SELECT id FROM services WHERE name = 'Classic Manicure'), 'Paraffin Wax Treatment', 15.00, 15),
((SELECT id FROM services WHERE name = 'Classic Manicure'), 'Hand Massage Extended', 10.00, 10),
((SELECT id FROM services WHERE name = 'Gel Manicure'), 'Chrome Powder Finish', 15.00, 10),
((SELECT id FROM services WHERE name = 'Classic Pedicure'), 'Callus Removal', 20.00, 15),
((SELECT id FROM services WHERE name = 'Classic Pedicure'), 'Foot Mask Treatment', 15.00, 15);

-- Add indexes for better performance
CREATE INDEX idx_services_category_id ON services(category_id);
CREATE INDEX idx_services_is_active ON services(is_active);
CREATE INDEX idx_service_addons_service_id ON service_addons(service_id);

-- RLS policies for service catalog (read-only for all authenticated users)
ALTER TABLE service_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_addons ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read service catalog
CREATE POLICY "service_categories_read_policy" ON service_categories
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "services_read_policy" ON services
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "service_addons_read_policy" ON service_addons
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Only admins can modify service catalog
CREATE POLICY "service_categories_admin_policy" ON service_categories
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

CREATE POLICY "services_admin_policy" ON services
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

CREATE POLICY "service_addons_admin_policy" ON service_addons
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );