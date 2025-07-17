-- Analytics Functions and Views

-- Revenue Analytics
CREATE OR REPLACE FUNCTION get_revenue_by_period(
    start_date DATE,
    end_date DATE
)
RETURNS TABLE (
    date DATE,
    revenue DECIMAL(10,2),
    appointment_count INTEGER,
    service_revenue DECIMAL(10,2),
    product_revenue DECIMAL(10,2)
) AS $$
BEGIN
    RETURN QUERY
    WITH daily_revenue AS (
        SELECT 
            DATE(a.start_time) as appointment_date,
            COUNT(DISTINCT a.id) as appointments,
            COALESCE(SUM(s.price), 0) as service_rev
        FROM appointments a
        LEFT JOIN services s ON a.service_id = s.id
        WHERE a.status = 'completed'
        AND DATE(a.start_time) BETWEEN start_date AND end_date
        GROUP BY DATE(a.start_time)
    ),
    daily_products AS (
        SELECT 
            DATE(sm.created_at) as sale_date,
            COALESCE(SUM(ABS(sm.quantity) * p.unit_price), 0) as product_rev
        FROM stock_movements sm
        JOIN products p ON sm.product_id = p.id
        WHERE sm.movement_type = 'sale'
        AND DATE(sm.created_at) BETWEEN start_date AND end_date
        GROUP BY DATE(sm.created_at)
    )
    SELECT 
        COALESCE(dr.appointment_date, dp.sale_date) as date,
        COALESCE(dr.service_rev, 0) + COALESCE(dp.product_rev, 0) as revenue,
        COALESCE(dr.appointments, 0) as appointment_count,
        COALESCE(dr.service_rev, 0) as service_revenue,
        COALESCE(dp.product_rev, 0) as product_revenue
    FROM daily_revenue dr
    FULL OUTER JOIN daily_products dp ON dr.appointment_date = dp.sale_date
    ORDER BY date;
END;
$$ LANGUAGE plpgsql;

-- Top Services Analytics
CREATE OR REPLACE FUNCTION get_top_services(
    start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
    end_date DATE DEFAULT CURRENT_DATE,
    limit_count INTEGER DEFAULT 10
)
RETURNS TABLE (
    service_id UUID,
    service_name TEXT,
    category_name TEXT,
    booking_count INTEGER,
    total_revenue DECIMAL(10,2),
    avg_price DECIMAL(10,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id,
        s.name,
        sc.name as category,
        COUNT(a.id)::INTEGER as bookings,
        SUM(s.price) as revenue,
        AVG(s.price) as avg_price
    FROM services s
    JOIN service_categories sc ON s.category_id = sc.id
    LEFT JOIN appointments a ON s.id = a.service_id 
        AND a.status = 'completed'
        AND DATE(a.start_time) BETWEEN start_date AND end_date
    GROUP BY s.id, s.name, sc.name
    ORDER BY bookings DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Staff Performance Analytics
CREATE OR REPLACE FUNCTION get_staff_performance(
    start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
    end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    staff_id UUID,
    staff_name TEXT,
    appointments_completed INTEGER,
    total_revenue DECIMAL(10,2),
    avg_service_time INTERVAL,
    utilization_rate DECIMAL(5,2)
) AS $$
BEGIN
    RETURN QUERY
    WITH staff_stats AS (
        SELECT 
            st.id,
            st.name,
            COUNT(a.id) as completed_appointments,
            SUM(s.price) as revenue,
            AVG(a.end_time - a.start_time) as avg_duration
        FROM staff st
        LEFT JOIN appointments a ON st.id = a.staff_id 
            AND a.status = 'completed'
            AND DATE(a.start_time) BETWEEN start_date AND end_date
        LEFT JOIN services s ON a.service_id = s.id
        WHERE st.is_active = true
        GROUP BY st.id, st.name
    ),
    staff_hours AS (
        SELECT 
            st.id,
            COUNT(DISTINCT DATE(a.start_time)) * 8 as available_hours -- Assuming 8 hour work days
        FROM staff st
        LEFT JOIN appointments a ON st.id = a.staff_id
            AND DATE(a.start_time) BETWEEN start_date AND end_date
        GROUP BY st.id
    )
    SELECT 
        ss.id,
        ss.name,
        COALESCE(ss.completed_appointments, 0)::INTEGER,
        COALESCE(ss.revenue, 0),
        ss.avg_duration,
        CASE 
            WHEN sh.available_hours > 0 
            THEN ROUND((EXTRACT(EPOCH FROM ss.avg_duration) * ss.completed_appointments / 3600) / sh.available_hours * 100, 2)
            ELSE 0
        END as utilization_rate
    FROM staff_stats ss
    JOIN staff_hours sh ON ss.id = sh.id
    ORDER BY ss.revenue DESC;
END;
$$ LANGUAGE plpgsql;

-- Customer Analytics
CREATE OR REPLACE FUNCTION get_customer_analytics(
    start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
    end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    new_customers INTEGER,
    returning_customers INTEGER,
    total_visits INTEGER,
    avg_ticket_size DECIMAL(10,2),
    retention_rate DECIMAL(5,2)
) AS $$
BEGIN
    RETURN QUERY
    WITH customer_stats AS (
        SELECT 
            c.id,
            MIN(c.created_at) as first_visit,
            COUNT(DISTINCT DATE(c.created_at)) as visit_count,
            SUM(c.service_price) as total_spent
        FROM customers c
        WHERE DATE(c.created_at) BETWEEN start_date AND end_date
        GROUP BY c.id
    ),
    new_vs_returning AS (
        SELECT 
            COUNT(CASE WHEN first_visit >= start_date THEN 1 END) as new_count,
            COUNT(CASE WHEN first_visit < start_date THEN 1 END) as returning_count,
            SUM(visit_count)::INTEGER as total_visit_count,
            AVG(total_spent) as avg_ticket
        FROM customer_stats
    ),
    retention AS (
        SELECT 
            COUNT(DISTINCT c1.id) as month_1_customers,
            COUNT(DISTINCT c2.id) as month_2_customers
        FROM customers c1
        LEFT JOIN customers c2 ON c1.email = c2.email
            AND DATE(c2.created_at) BETWEEN (start_date + INTERVAL '30 days') AND end_date
        WHERE DATE(c1.created_at) BETWEEN start_date AND (start_date + INTERVAL '30 days')
    )
    SELECT 
        nv.new_count::INTEGER,
        nv.returning_count::INTEGER,
        nv.total_visit_count,
        nv.avg_ticket,
        CASE 
            WHEN r.month_1_customers > 0 
            THEN ROUND((r.month_2_customers::DECIMAL / r.month_1_customers) * 100, 2)
            ELSE 0
        END as retention_rate
    FROM new_vs_returning nv, retention r;
END;
$$ LANGUAGE plpgsql;

-- Appointment Analytics
CREATE OR REPLACE FUNCTION get_appointment_analytics(
    start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
    end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    total_appointments INTEGER,
    completed_appointments INTEGER,
    cancelled_appointments INTEGER,
    no_show_appointments INTEGER,
    completion_rate DECIMAL(5,2),
    avg_appointments_per_day DECIMAL(5,2),
    peak_hour INTEGER,
    peak_day_of_week INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH appointment_stats AS (
        SELECT 
            COUNT(*) as total,
            COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
            COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled,
            COUNT(CASE WHEN status = 'no_show' THEN 1 END) as no_show,
            COUNT(DISTINCT DATE(start_time)) as days_with_appointments
        FROM appointments
        WHERE DATE(start_time) BETWEEN start_date AND end_date
    ),
    peak_times AS (
        SELECT 
            EXTRACT(HOUR FROM start_time)::INTEGER as peak_hour,
            EXTRACT(DOW FROM start_time)::INTEGER as peak_dow,
            COUNT(*) as appointment_count
        FROM appointments
        WHERE DATE(start_time) BETWEEN start_date AND end_date
        AND status = 'completed'
        GROUP BY EXTRACT(HOUR FROM start_time), EXTRACT(DOW FROM start_time)
        ORDER BY appointment_count DESC
        LIMIT 1
    )
    SELECT 
        s.total::INTEGER,
        s.completed::INTEGER,
        s.cancelled::INTEGER,
        s.no_show::INTEGER,
        CASE 
            WHEN s.total > 0 
            THEN ROUND((s.completed::DECIMAL / s.total) * 100, 2)
            ELSE 0
        END as completion_rate,
        CASE 
            WHEN s.days_with_appointments > 0 
            THEN ROUND(s.total::DECIMAL / s.days_with_appointments, 2)
            ELSE 0
        END as avg_per_day,
        COALESCE(p.peak_hour, 0),
        COALESCE(p.peak_dow, 0)
    FROM appointment_stats s, peak_times p;
END;
$$ LANGUAGE plpgsql;

-- Inventory Analytics
CREATE OR REPLACE FUNCTION get_inventory_analytics()
RETURNS TABLE (
    total_products INTEGER,
    low_stock_count INTEGER,
    out_of_stock_count INTEGER,
    total_inventory_value DECIMAL(10,2),
    total_retail_value DECIMAL(10,2),
    potential_profit DECIMAL(10,2),
    top_moving_products JSONB
) AS $$
BEGIN
    RETURN QUERY
    WITH inventory_stats AS (
        SELECT 
            COUNT(DISTINCT p.id) as total_products,
            COUNT(CASE WHEN i.current_stock <= p.low_stock_threshold AND i.current_stock > 0 THEN 1 END) as low_stock,
            COUNT(CASE WHEN i.current_stock = 0 THEN 1 END) as out_of_stock,
            SUM(i.current_stock * COALESCE(p.cost_price, 0)) as inventory_cost,
            SUM(i.current_stock * p.unit_price) as retail_value
        FROM products p
        JOIN inventory i ON p.id = i.product_id
        WHERE p.is_active = true
    ),
    top_products AS (
        SELECT jsonb_agg(
            jsonb_build_object(
                'name', product_name,
                'quantity_sold', quantity_sold
            ) ORDER BY quantity_sold DESC
        ) as top_moving
        FROM (
            SELECT 
                p.name as product_name,
                SUM(ABS(sm.quantity)) as quantity_sold
            FROM stock_movements sm
            JOIN products p ON sm.product_id = p.id
            WHERE sm.movement_type = 'sale'
            AND sm.created_at >= CURRENT_DATE - INTERVAL '30 days'
            GROUP BY p.name
            ORDER BY quantity_sold DESC
            LIMIT 5
        ) t
    )
    SELECT 
        s.total_products::INTEGER,
        s.low_stock::INTEGER,
        s.out_of_stock::INTEGER,
        s.inventory_cost,
        s.retail_value,
        s.retail_value - s.inventory_cost as potential_profit,
        t.top_moving
    FROM inventory_stats s, top_products t;
END;
$$ LANGUAGE plpgsql;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_appointments_start_time ON appointments(start_time);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_staff_id ON appointments(staff_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON stock_movements(created_at);
CREATE INDEX IF NOT EXISTS idx_stock_movements_type ON stock_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_customers_created_at ON customers(created_at);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);