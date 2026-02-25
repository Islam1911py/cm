import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { amount, invoiceId } = await request.json();

    // Validate input
    if (!amount || !invoiceId || amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount or invoiceId' },
        { status: 400 }
      );
    }

    // Round to 2 decimal places to avoid floating point precision issues
    const roundedAmount = Math.round(amount * 100) / 100;

    // Get invoice
    const invoice = await db.invoice.findUnique({
      where: { id: invoiceId },
      include: { payments: true },
    });

    if (!invoice) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      );
    }

    // Use database stored values (which are already correctly calculated)
    const currentTotalPaid = invoice.totalPaid || 0;
    const newTotalPaid = Math.round((currentTotalPaid + roundedAmount) * 100) / 100;

    // Check if payment exceeds invoice amount (with small tolerance)
    if (newTotalPaid > Math.round(invoice.amount * 100) / 100 + 0.01) {
      return NextResponse.json(
        { error: `Payment amount exceeds invoice amount. Max allowed: ${Math.round((invoice.remainingBalance) * 100) / 100}` },
        { status: 400 }
      );
    }

    // Create payment with rounded amount
    const payment = await db.payment.create({
      data: {
        amount: roundedAmount,
        invoiceId,
      },
    });

    // Update invoice - use stored totalPaid + new amount
    const roundedRemaining = Math.round((invoice.amount - newTotalPaid) * 100) / 100;
    const isPaid = roundedRemaining <= 0.01;

    await db.invoice.update({
      where: { id: invoiceId },
      data: {
        totalPaid: newTotalPaid,
        remainingBalance: roundedRemaining,
        isPaid,
      },
    });

    return NextResponse.json(payment, { status: 201 });
  } catch (error) {
    console.error('Payment creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create payment' },
      { status: 500 }
    );
  }
}
