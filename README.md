# Nail Salon Management System

A comprehensive web application for managing nail salon operations including customer records, service catalog, appointments, and more. Built with Next.js, Supabase, and shadcn/ui.

## Tech Stack

- **Frontend**: Next.js 15 with App Router and TypeScript
- **Backend**: Supabase (PostgreSQL database + Authentication)
- **UI Components**: shadcn/ui
- **Styling**: Tailwind CSS

## Features

### Implemented
- 🔐 User authentication (signup/login)
- 📊 Customer management dashboard
- ➕ Add new customer records
- 💅 Service catalog with categories and pricing
- 📅 Appointment booking system with calendar view
- 👨‍💼 Basic staff management
- 🔄 Quick booking from customer records
- 👥 Role-based access control (Admin/User)
- 📱 Responsive design
- 🎨 Modern UI with shadcn/ui components

### In Development
- 💳 Payment processing and checkout
- 📊 Analytics dashboard
- 🎁 Loyalty rewards program
- 📦 Inventory management
- 🎟️ Gift vouchers and coupons

## Prerequisites

Before you begin, ensure you have:
- Node.js 18+ installed
- A Supabase account (free tier available at [supabase.io](https://supabase.io))

## Supabase Setup

1. **Create a new Supabase project**
   - Go to [app.supabase.io](https://app.supabase.io)
   - Click "New Project"
   - Fill in the project details

2. **Create the customers table**
   
   Run this SQL in the Supabase SQL Editor:
   
   ```sql
   -- Create customers table
   CREATE TABLE customers (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
     name TEXT NOT NULL,
     phone TEXT NOT NULL,
     email TEXT NOT NULL,
     service TEXT NOT NULL,
     product_used TEXT NOT NULL,
     product_quantity NUMERIC NOT NULL,
     service_price NUMERIC NOT NULL,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );

   -- Enable Row Level Security
   ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

   -- Create policies
   CREATE POLICY "Users can view own customer records" ON customers
     FOR SELECT USING (auth.uid() = user_id);

   CREATE POLICY "Users can insert own customer records" ON customers
     FOR INSERT WITH CHECK (auth.uid() = user_id);

   CREATE POLICY "Users can update own customer records" ON customers
     FOR UPDATE USING (auth.uid() = user_id);

   CREATE POLICY "Users can delete own customer records" ON customers
     FOR DELETE USING (auth.uid() = user_id);
   ```

3. **Set up Admin Role System (Optional)**
   
   To enable admin users who can view all customers:
   
   ```sql
   -- Create user_roles table
   CREATE TABLE user_roles (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
     role TEXT NOT NULL DEFAULT 'user',
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     UNIQUE(user_id)
   );

   -- Enable RLS
   ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

   -- Create policy
   CREATE POLICY "Users can view their own role" ON user_roles
     FOR SELECT USING (auth.uid() = user_id);

   -- Update customers table policy to allow admins to view all records
   DROP POLICY IF EXISTS "Users can view own customer records" ON customers;
   
   CREATE POLICY "Users can view customer records" ON customers
     FOR SELECT USING (
       auth.uid() = user_id 
       OR 
       EXISTS (
         SELECT 1 FROM user_roles
         WHERE user_roles.user_id = auth.uid() 
         AND user_roles.role = 'admin'
       )
     );

   -- Function to make a user admin
   CREATE OR REPLACE FUNCTION make_user_admin(user_email TEXT)
   RETURNS void AS $$
   DECLARE
     target_user_id uuid;
   BEGIN
     SELECT id INTO target_user_id 
     FROM auth.users 
     WHERE email = user_email;
     
     IF target_user_id IS NULL THEN
       RAISE EXCEPTION 'User with email % not found', user_email;
     END IF;
     
     INSERT INTO user_roles (user_id, role)
     VALUES (target_user_id, 'admin')
     ON CONFLICT (user_id) 
     DO UPDATE SET role = 'admin';
     
     RAISE NOTICE 'User % is now an admin', user_email;
   END;
   $$ LANGUAGE plpgsql SECURITY DEFINER;
   ```

4. **Set up Service Catalog**
   
   Run the SQL from `sql/service_catalog.sql` to create the service tables and sample data.

5. **Set up Appointments and Staff**
   
   Run the SQL from `sql/appointments_and_staff.sql` to create appointment booking tables, staff management, and sample data.

3. **Get your project credentials**
   - Go to Project Settings > API
   - Copy your `Project URL` and `anon public` key

## Local Development Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd nail-salon
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Create a `.env.local` file in the root directory:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open the application**
   
   Navigate to [http://localhost:3000](http://localhost:3000)

## Project Structure

```
nail-salon/
├── app/                    # Next.js App Router
│   ├── dashboard/         # Protected dashboard page
│   │   └── services/     # Service catalog page
│   ├── login/            # Login page
│   ├── signup/           # Signup page
│   ├── layout.tsx        # Root layout
│   └── page.tsx          # Home page (redirects)
├── components/            # React components
│   ├── CustomerForm.tsx  # Form for adding customers
│   ├── CustomerTable.tsx # Table displaying customers
│   ├── Navigation.tsx    # Dashboard navigation
│   └── ui/              # shadcn/ui components
├── lib/                  # Utility functions
│   └── supabase/        # Supabase client configs
├── sql/                  # Database schemas
│   └── service_catalog.sql # Service tables
└── middleware.ts         # Auth middleware
```

## Deployment

### Deploy to Vercel

1. **Push your code to GitHub**

2. **Connect to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Import your GitHub repository
   - Add environment variables:
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

3. **Deploy**
   - Click "Deploy"
   - Vercel will automatically build and deploy your app

### Deploy to Netlify

1. **Build command**: `npm run build`
2. **Publish directory**: `.next`
3. **Add environment variables in Netlify dashboard**

## Usage

1. **Sign Up**: Create a new account on the signup page
2. **Log In**: Access your dashboard with your credentials
3. **Add Customers**: Use the form to add new customer records
4. **View Records**: See all your customer visits in the table

### Admin Features

Admin users can view all customer records across the system. To make a user an admin:

1. First create the user through the signup page or Supabase Dashboard
2. Run this SQL in Supabase SQL Editor:
   ```sql
   SELECT make_user_admin('user@email.com');
   ```
3. The user will now see all customers when they log in

## Security Notes

- Never commit your `.env.local` file
- Row Level Security (RLS) ensures users can only access their own data
- All API calls are authenticated through Supabase

## Support

For issues or questions:
- Check Supabase documentation: [supabase.io/docs](https://supabase.io/docs)
- Check Next.js documentation: [nextjs.org/docs](https://nextjs.org/docs)
- Check shadcn/ui documentation: [ui.shadcn.com](https://ui.shadcn.com)

## License

This project is open source and available under the MIT License.
