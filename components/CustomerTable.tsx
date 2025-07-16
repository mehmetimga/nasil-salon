'use client'

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

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
  if (customers.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No customer records found. Add your first customer!
      </div>
    )
  }

  return (
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
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
} 