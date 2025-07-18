'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { toast } from 'sonner'

interface CustomerFormProps {
  userId: string
}

interface ServiceCategory {
  name: string
}

interface Service {
  id: string
  name: string
  price: number
  duration_minutes: number
  service_categories: ServiceCategory | null
}

export default function CustomerForm({ userId }: CustomerFormProps) {
  const router = useRouter()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [services, setServices] = useState<Service[]>([])
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    service: '',
    product_used: '',
    product_quantity: '',
    service_price: ''
  })

  const fetchServices = useCallback(async () => {
    const { data, error } = await supabase
      .from('services')
      .select('id, name, price, duration_minutes, service_categories(name)')
      .eq('is_active', true)
      .order('display_order')
    
    if (error) {
      console.error('Error fetching services:', error)
    } else if (data) {
      const formattedServices = data.map((service) => ({
        id: service.id,
        name: service.name,
        price: service.price,
        duration_minutes: service.duration_minutes,
        service_categories: service.service_categories || null
      }))
      setServices(formattedServices as unknown as Service[])
    }
  }, [supabase])

  useEffect(() => {
    fetchServices()
  }, [fetchServices])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const insertData = {
        user_id: userId,
        name: formData.name,
        phone: formData.phone,
        email: formData.email,
        service: selectedService ? selectedService.name : formData.service,
        product_used: formData.product_used,
        product_quantity: parseFloat(formData.product_quantity) || 0,
        service_price: parseFloat(formData.service_price) || 0
      }
      
      console.log('Inserting customer data:', insertData)
      
      const { data, error } = await supabase
        .from('customers')
        .insert([insertData])
        .select()

      console.log('Insert result:', { data, error })

      if (error) {
        console.error('Insert error:', error)
        setError(error.message)
        toast.error('Failed to add customer: ' + error.message)
      } else {
        toast.success('Customer added successfully!')
        // Reset form
        setFormData({
          name: '',
          phone: '',
          email: '',
          service: '',
          product_used: '',
          product_quantity: '',
          service_price: ''
        })
        // Force a hard refresh to reload the data
        router.refresh()
        // Alternative: reload the entire page
        window.location.reload()
      }
    } catch (_err) {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      <div className="space-y-2">
        <Label htmlFor="name">Customer Name</Label>
        <Input
          id="name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">Phone Number</Label>
        <Input
          id="phone"
          name="phone"
          type="tel"
          value={formData.phone}
          onChange={handleChange}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          value={formData.email}
          onChange={handleChange}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="service">Service</Label>
        <select
          id="service"
          name="service"
          value={formData.service}
          onChange={(e) => {
            const service = services.find(s => s.id === e.target.value)
            setSelectedService(service || null)
            setFormData({
              ...formData,
              service: e.target.value,
              service_price: service ? service.price.toString() : ''
            })
          }}
          className="w-full p-2 border rounded"
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

      <div className="space-y-2">
        <Label htmlFor="product_used">Product Used</Label>
        <Input
          id="product_used"
          name="product_used"
          value={formData.product_used}
          onChange={handleChange}
          placeholder="e.g., OPI Nail Polish"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="product_quantity">Quantity</Label>
          <Input
            id="product_quantity"
            name="product_quantity"
            type="number"
            step="0.1"
            value={formData.product_quantity}
            onChange={handleChange}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="service_price">Service Price</Label>
          <Input
            id="service_price"
            name="service_price"
            type="number"
            step="0.01"
            value={formData.service_price}
            onChange={handleChange}
            required
            readOnly={selectedService !== null}
          />
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Adding Customer...' : 'Add Customer'}
      </Button>
    </form>
  )
} 