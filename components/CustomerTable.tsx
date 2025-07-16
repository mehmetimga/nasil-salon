'use client'

import { useState } from 'react'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import QuickBooking from './QuickBooking'

interface Customer {
  id: string
  user_id: string
  name: string
  phone: string
  email: string
  service: string
  product_used: string
  product_quantity: number
  service_price: number
  created_at?: string
}

interface CustomerTableProps {
  customers: Customer[]
  isAdmin?: boolean
}

export default function CustomerTable({ customers, isAdmin = false }: CustomerTableProps) {
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [showBookingDialog, setShowBookingDialog] = useState(false)

  if (customers.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No customer records found. Add your first customer!
      </div>
    )
  }

  return (
    <>
    <Table>
      <TableCaption>
        {isAdmin 
          ? `Showing ${customers.length} total customer records from all users.`
          : `A list of your recent customer visits.`}
      </TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Phone</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Service</TableHead>
          <TableHead>Product</TableHead>
          <TableHead className="text-right">Quantity</TableHead>
          <TableHead className="text-right">Price</TableHead>
          <TableHead>Date</TableHead>
          {isAdmin && <TableHead>User ID</TableHead>}
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {customers.map((customer) => (
          <TableRow key={customer.id}>
            <TableCell className="font-medium">{customer.name}</TableCell>
            <TableCell>{customer.phone}</TableCell>
            <TableCell>{customer.email}</TableCell>
            <TableCell>{customer.service}</TableCell>
            <TableCell>{customer.product_used}</TableCell>
            <TableCell className="text-right">{customer.product_quantity}</TableCell>
            <TableCell className="text-right">${customer.service_price.toFixed(2)}</TableCell>
            <TableCell>
              {customer.created_at
                ? new Date(customer.created_at).toLocaleDateString()
                : 'N/A'}
            </TableCell>
            {isAdmin && (
              <TableCell className="text-xs text-muted-foreground">
                {customer.user_id.slice(0, 8)}...
              </TableCell>
            )}
            <TableCell>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSelectedCustomer(customer)
                  setShowBookingDialog(true)
                }}
              >
                Book Appointment
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>

    <Dialog open={showBookingDialog} onOpenChange={setShowBookingDialog}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Book Appointment</DialogTitle>
        </DialogHeader>
        {selectedCustomer && (
          <QuickBooking
            customerId={selectedCustomer.id}
            customerName={selectedCustomer.name}
          />
        )}
      </DialogContent>
    </Dialog>
  </>
  )
} 