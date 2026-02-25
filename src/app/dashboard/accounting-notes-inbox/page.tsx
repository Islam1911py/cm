'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'

export default function AccountingNotesPage() {
  const [notes, setNotes] = useState<any[]>([])
  const [pmAdvances, setPmAdvances] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedNote, setSelectedNote] = useState<any>(null)
  const [selectedAdvance, setSelectedAdvance] = useState('')
  const [converting, setConverting] = useState(false)
  const [filterStatus, setFilterStatus] = useState('PENDING')
  const [errorMsg, setErrorMsg] = useState('')
  const { toast } = useToast()

  // Fetch accounting notes
  useEffect(() => {
    const fetchNotes = async () => {
      try {
        const res = await fetch(`/api/accounting-notes?status=${filterStatus}`)
        if (!res.ok) throw new Error('Failed to fetch')
        const data = await res.json()
        setNotes(data)
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Failed to fetch accounting notes',
          variant: 'destructive',
        })
      } finally {
        setLoading(false)
      }
    }

    fetchNotes()
  }, [filterStatus, toast])

  // Fetch PM Advances (when converting)
  const handleOpenConvert = async (note) => {
    setSelectedNote(note)
    try {
      const res = await fetch(`/api/pm-advances?projectId=${note.projectId}`)
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setPmAdvances(data)
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch PM Advances',
        variant: 'destructive',
      })
    }
  }

  // Convert note to expense
  const handleConvertToExpense = async () => {
    if (!selectedAdvance) {
      toast({
        title: 'Error',
        description: 'Please select a PM Advance',
        variant: 'destructive',
      })
      return
    }

    setConverting(true)
    try {
      if (!selectedNote) {
        setErrorMsg('No note selected')
        setConverting(false)
        return
      }

      const res = await fetch(
        `/api/accounting-notes/${selectedNote.id}/convert-to-expense`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pmAdvanceId: selectedAdvance }),
        }
      )

      if (!res.ok) throw new Error('Failed to convert')

      toast({
        title: 'Success',
        description: 'Note converted to expense successfully',
      })

      // Refresh notes
      const updatedRes = await fetch(`/api/accounting-notes?status=${filterStatus}`)
      const updatedData = await updatedRes.json()
      setNotes(updatedData)

      // Reset state
      setSelectedNote(null)
      setSelectedAdvance('')
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to convert note to expense',
        variant: 'destructive',
      })
    } finally {
      setConverting(false)
    }
  }

  if (loading) {
    return <div className="p-8">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">صندوق الوارد للملاحظات المحاسبية</h1>
        <p className="text-gray-600 mt-2">
          مراجعة وتحويل ملاحظات مدير المشروع إلى نفقات رسمية للوحدة
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Notes Pending Review</CardTitle>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="CONVERTED">Converted</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {notes.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No notes to display
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Amount (EGP)</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(notes || []).map((note: any) => (
                  <TableRow key={note?.id}>
                    <TableCell>{note?.project?.name}</TableCell>
                    <TableCell>{note?.unit?.name}</TableCell>
                    <TableCell className="max-w-xs truncate">
                      {note?.description}
                    </TableCell>
                    <TableCell className="font-semibold">
                      {note?.amount?.toFixed(2)}
                    </TableCell>
                    <TableCell>{note?.createdByUser?.name}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          note?.status === 'PENDING'
                            ? 'default'
                            : note?.status === 'CONVERTED'
                              ? 'secondary'
                              : 'destructive'
                        }
                      >
                        {note.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {note.status === 'PENDING' && (
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              size="sm"
                              onClick={() => handleOpenConvert(note)}
                            >
                              Convert
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>
                                Convert to Expense: {note.description}
                              </DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <label className="block text-sm font-medium mb-2">
                                  Amount: {note.amount} EGP
                                </label>
                                <label className="block text-sm font-medium mb-2">
                                  Select PM Advance
                                </label>
                                <Select
                                  value={selectedAdvance}
                                  onValueChange={setSelectedAdvance}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Choose advance..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {pmAdvances.map((adv) => (
                                      <SelectItem key={adv.id} value={adv.id}>
                                        {adv.amount} EGP (Remaining:{' '}
                                        {adv.remainingAmount})
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <Button
                                onClick={handleConvertToExpense}
                                disabled={converting}
                              >
                                {converting ? 'Converting...' : 'Confirm'}
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                      )}
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
