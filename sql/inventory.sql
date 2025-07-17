-- Inventory Management Tables

-- Product categories for retail items
CREATE TABLE product_categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Products/retail items
CREATE TABLE products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    category_id UUID REFERENCES product_categories(id) ON DELETE SET NULL,
    sku TEXT UNIQUE,
    barcode TEXT,
    unit_price DECIMAL(10,2) NOT NULL,
    cost_price DECIMAL(10,2),
    supplier TEXT,
    brand TEXT,
    size TEXT,
    color TEXT,
    image_url TEXT,
    is_active BOOLEAN DEFAULT true,
    low_stock_threshold INTEGER DEFAULT 10,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inventory tracking
CREATE TABLE inventory (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    current_stock INTEGER NOT NULL DEFAULT 0,
    reserved_stock INTEGER DEFAULT 0, -- For pending orders
    available_stock INTEGER GENERATED ALWAYS AS (current_stock - reserved_stock) STORED,
    last_restock_date TIMESTAMP WITH TIME ZONE,
    last_sale_date TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(product_id)
);

-- Stock movements (in/out)
CREATE TABLE stock_movements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    movement_type TEXT NOT NULL CHECK (movement_type IN ('purchase', 'sale', 'adjustment', 'return', 'damage')),
    quantity INTEGER NOT NULL, -- Positive for in, negative for out
    reference_type TEXT, -- 'appointment', 'manual', 'supplier_order', etc.
    reference_id UUID, -- ID of related record (appointment_id, etc.)
    notes TEXT,
    cost_per_unit DECIMAL(10,2),
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Supplier orders
CREATE TABLE supplier_orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_number TEXT UNIQUE NOT NULL,
    supplier_name TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'ordered', 'shipped', 'received', 'cancelled')),
    order_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expected_date TIMESTAMP WITH TIME ZONE,
    received_date TIMESTAMP WITH TIME ZONE,
    total_amount DECIMAL(10,2),
    notes TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Supplier order items
CREATE TABLE supplier_order_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID REFERENCES supplier_orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    quantity INTEGER NOT NULL,
    unit_cost DECIMAL(10,2) NOT NULL,
    total_cost DECIMAL(10,2) GENERATED ALWAYS AS (quantity * unit_cost) STORED,
    received_quantity INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_order_items ENABLE ROW LEVEL SECURITY;

-- Policies - Allow authenticated users to view products
CREATE POLICY "Users can view product categories" ON product_categories
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can view products" ON products
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can view inventory" ON inventory
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can view stock movements" ON stock_movements
    FOR SELECT USING (auth.uid() IS NOT NULL);

-- Admin policies for modifications
CREATE POLICY "Admins can manage product categories" ON product_categories
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_roles.user_id = auth.uid() 
            AND user_roles.role = 'admin'
        )
    );

CREATE POLICY "Admins can manage products" ON products
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_roles.user_id = auth.uid() 
            AND user_roles.role = 'admin'
        )
    );

CREATE POLICY "Admins can manage inventory" ON inventory
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_roles.user_id = auth.uid() 
            AND user_roles.role = 'admin'
        )
    );

CREATE POLICY "Users can create stock movements" ON stock_movements
    FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Admins can view all supplier orders" ON supplier_orders
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_roles.user_id = auth.uid() 
            AND user_roles.role = 'admin'
        )
    );

CREATE POLICY "Admins can manage supplier orders" ON supplier_orders
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_roles.user_id = auth.uid() 
            AND user_roles.role = 'admin'
        )
    );

CREATE POLICY "Admins can manage supplier order items" ON supplier_order_items
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_roles.user_id = auth.uid() 
            AND user_roles.role = 'admin'
        )
    );

-- Functions

-- Function to update inventory after stock movement
CREATE OR REPLACE FUNCTION update_inventory_on_movement()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.movement_type IN ('purchase', 'return') THEN
        -- Increase stock
        INSERT INTO inventory (product_id, current_stock)
        VALUES (NEW.product_id, NEW.quantity)
        ON CONFLICT (product_id)
        DO UPDATE SET 
            current_stock = inventory.current_stock + NEW.quantity,
            last_restock_date = CASE 
                WHEN NEW.movement_type = 'purchase' THEN NOW() 
                ELSE inventory.last_restock_date 
            END,
            updated_at = NOW();
    ELSE
        -- Decrease stock
        UPDATE inventory 
        SET 
            current_stock = current_stock + NEW.quantity, -- quantity is negative for outgoing
            last_sale_date = CASE 
                WHEN NEW.movement_type = 'sale' THEN NOW() 
                ELSE last_sale_date 
            END,
            updated_at = NOW()
        WHERE product_id = NEW.product_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for stock movements
CREATE TRIGGER trigger_update_inventory_on_movement
AFTER INSERT ON stock_movements
FOR EACH ROW
EXECUTE FUNCTION update_inventory_on_movement();

-- Function to check low stock
CREATE OR REPLACE FUNCTION get_low_stock_products()
RETURNS TABLE (
    product_id UUID,
    product_name TEXT,
    sku TEXT,
    current_stock INTEGER,
    threshold INTEGER,
    category_name TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.name,
        p.sku,
        i.current_stock,
        p.low_stock_threshold,
        pc.name
    FROM products p
    JOIN inventory i ON p.id = i.product_id
    LEFT JOIN product_categories pc ON p.category_id = pc.id
    WHERE i.current_stock <= p.low_stock_threshold
    AND p.is_active = true
    ORDER BY i.current_stock ASC;
END;
$$ LANGUAGE plpgsql;

-- Sample data
INSERT INTO product_categories (name, description, display_order) VALUES
('Nail Polish', 'Professional nail polish and lacquers', 1),
('Nail Care', 'Nail treatment and care products', 2),
('Tools & Equipment', 'Professional nail tools and equipment', 3),
('Skincare', 'Hand and foot care products', 4),
('Accessories', 'Nail art and accessories', 5);

-- Sample products
INSERT INTO products (name, description, category_id, sku, unit_price, cost_price, supplier, brand, size, low_stock_threshold) VALUES
('OPI Nail Lacquer - Red', 'Classic red nail polish', 
    (SELECT id FROM product_categories WHERE name = 'Nail Polish'), 
    'OPI-RED-001', 12.99, 6.50, 'OPI Distributor', 'OPI', '15ml', 15),
('Cuticle Oil', 'Nourishing cuticle oil with vitamin E', 
    (SELECT id FROM product_categories WHERE name = 'Nail Care'), 
    'CARE-OIL-001', 8.99, 4.00, 'Beauty Supplies Co', 'CND', '10ml', 20),
('Professional Nail File Set', 'Set of 10 professional nail files', 
    (SELECT id FROM product_categories WHERE name = 'Tools & Equipment'), 
    'TOOL-FILE-001', 15.99, 7.00, 'Pro Tools Inc', 'Generic', 'Standard', 10),
('Hand Cream - Lavender', 'Moisturizing hand cream with lavender', 
    (SELECT id FROM product_categories WHERE name = 'Skincare'), 
    'SKIN-CREAM-001', 9.99, 5.00, 'Skincare Plus', 'L''Occitane', '75ml', 25);

-- Initial inventory
INSERT INTO inventory (product_id, current_stock)
SELECT id, 50 FROM products;

-- Update timestamps function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_product_categories_updated_at BEFORE UPDATE ON product_categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_supplier_orders_updated_at BEFORE UPDATE ON supplier_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();