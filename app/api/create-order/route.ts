import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';

export async function POST() {
    try {
        const key_id = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_Tjvb5EHmaluLGr';
        const key_secret = process.env.RAZORPAY_KEY_SECRET || '97lM6CNq5HSfl4qi16oZqUUE';

        const razorpay = new Razorpay({
            key_id,
            key_secret,
        });

        const order = await razorpay.orders.create({
            amount: 50000, // Amount is in paise (50000 paise = ₹500)
            currency: 'INR',
            receipt: 'curalink_' + Math.random().toString(36).substring(2, 9),
            notes: {
                platform: 'CuraLink Telehealth',
                service: 'Physician Video Consultation',
            },
        });

        return NextResponse.json({ orderId: order.id, amount: 50000, currency: 'INR' });
    } catch (error: any) {
        console.warn('Razorpay API order error, using local transaction fallback:', error?.message);
        return NextResponse.json({
            orderId: 'order_curalink_' + Math.random().toString(36).substring(2, 10),
            amount: 50000,
            currency: 'INR',
            fallback: true,
        });
    }
}