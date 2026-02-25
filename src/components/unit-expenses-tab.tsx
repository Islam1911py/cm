'use client'

import { useEffect, useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'

interface ExpensesSummary {
  totalPaid: number
  totalClaimed: number
  totalPending: number
  claimedCount: number
  pendingCount: number
}

export function UnitExpensesTab({ unitId }: { unitId: string }) {
  const [expenses, setExpenses] = useState<any[]>([])
  const [summary, setSummary] = useState<ExpensesSummary>({
    totalPaid: 0,
    totalClaimed: 0,
    totalPending: 0,
    claimedCount: 0,
    pendingCount: 0,
  })
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    const fetchExpenses = async () => {
      try {
        const res = await fetch(`/api/unit-expenses?unitId=${unitId}`)
        if (!res.ok) throw new Error('Failed to fetch')
        const data = await res.json()
        setExpenses(data)

        // Calculate summary
        const totalPaid = data.reduce((sum, e) => sum + e.amount, 0)
        const totalClaimed = data.reduce((sum, e) => {
          return sum + (e.isClaimed ? e.amount : 0)
        }, 0)
        const totalPending = totalPaid - totalClaimed
        const claimedCount = data.filter((e) => e.isClaimed).length
        const pendingCount = data.filter((e) => !e.isClaimed).length

        setSummary({
          totalPaid,
          totalClaimed,
          totalPending,
          claimedCount,
          pendingCount,
        })
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Failed to fetch unit expenses',
          variant: 'destructive',
        })
      } finally {
        setLoading(false)
      }
    }

    fetchExpenses()
  }, [unitId, toast])

  if (loading) {
    return <div className="p-8">Loading expenses...</div>
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary.totalPaid.toFixed(2)} EGP
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Claimed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {summary.totalClaimed.toFixed(2)} EGP
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Pending Claim
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {summary.totalPending.toFixed(2)} EGP
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm space-y-1">
              <div>
                <Badge variant="secondary">{summary.claimedCount} Claimed</Badge>
              </div>
              <div>
                <Badge variant="default">{summary.pendingCount} Pending</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Expenses Table */}
      <Card>
        <CardHeader>
          <CardTitle>Expense Details</CardTitle>
        </CardHeader>
        <CardContent>
          {expenses.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No expenses recorded for this unit
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Amount (EGP)</TableHead>
                  <TableHead>PM Advance</TableHead>
                  <TableHead>Claimed</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(expenses || []).map((expense: any) => (
                  <TableRow key={expense?.id}>
                    <TableCell>
                      {new Date(expense?.date).toLocaleDateString('en-US')}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {expense?.description}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {expense?.sourceType === 'TECHNICIAN_WORK'
                          ? 'Technician'
                          : expense?.sourceType === 'STAFF_WORK'
                            ? 'Staff'
                            : expense?.sourceType}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-semibold">
                      {expense?.amount?.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {expense?.pmAdvance ? (
                        <span className="text-xs">
                          Advanced:{' '}
                          {expense?.pmAdvance?.amount - expense?.pmAdvance?.remainingAmount}
                          /{expense?.pmAdvance?.amount}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={expense?.isClaimed ? 'secondary' : 'default'}
                      >
                        {expense?.isClaimed ? 'Yes' : 'No'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          expense?.isClaimed ? 'secondary' : 'destructive'
                        }
                      >
                        {expense?.isClaimed ? 'Claimed' : 'Pending'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
