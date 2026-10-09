import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import firebaseConfig from '../../../firebase-applet-config.json';

const CONSULTATION_AMOUNT = 50000;
const CONSULTATION_CURRENCY = 'INR';
const responseHeaders = { 'Cache-Control': 'no-store' };

function hasActiveAccount(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object' || !('users' in payload) || !Array.isArray(payload.users)) return false;
  return payload.users.some((user: unknown) => (
    Boolean(user) && typeof user === 'object' && user !== null &&
    'localId' in user && typeof user.localId === 'string' && Boolean(user.localId) &&
    (!('disabled' in user) || user.disabled !== true)
  ));
}

export async function POST(request: Request) {
  const idToken = request.headers.get('authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!idToken) {
    return NextResponse.json({ error: 'Sign in before starting payment.', code: 'AUTH_REQUIRED' }, { status: 401, headers: responseHeaders });
  }

  const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
  if (!keyId || !keySecret) {
    console.error('Payment order creation unavailable: provider credentials are not configured.');
    return NextResponse.json({ error: 'Payments are currently unavailable. Please try again later.', code: 'PAYMENT_NOT_CONFIGURED' }, { status: 503, headers: responseHeaders });
  }

  // Use the existing project's public API key without initializing or changing Firebase configuration.
  try {
    const authResponse = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(firebaseConfig.apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    });
    if (authResponse.status === 429 || authResponse.status >= 500) {
      return NextResponse.json({ error: 'We could not check your session. Please try again.', code: 'AUTH_UNAVAILABLE' }, { status: 503, headers: responseHeaders });
    }
    if (!authResponse.ok || !hasActiveAccount(await authResponse.json())) {
      return NextResponse.json({ error: 'Your session has expired. Please sign in again.', code: 'AUTH_INVALID' }, { status: 401, headers: responseHeaders });
    }
  } catch {
    console.error('Payment order creation unavailable: session verification could not be completed.');
    return NextResponse.json({ error: 'We could not check your session. Please try again.', code: 'AUTH_UNAVAILABLE' }, { status: 503, headers: responseHeaders });
  }

  try {
    const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
    const order = await razorpay.orders.create({
      amount: CONSULTATION_AMOUNT,
      currency: CONSULTATION_CURRENCY,
      receipt: 'curalink_' + Math.random().toString(36).substring(2, 9),
      notes: {
        platform: 'CuraLink Telehealth',
        service: 'Physician Video Consultation',
      },
    });
    if (!order.id || !/^order_[a-zA-Z0-9]+$/.test(order.id) || Number(order.amount) !== CONSULTATION_AMOUNT || order.currency !== CONSULTATION_CURRENCY) {
      console.error('Payment provider returned an invalid consultation order.');
      return NextResponse.json({ error: 'We could not start your payment. Please try again.', code: 'ORDER_INVALID' }, { status: 502, headers: responseHeaders });
    }
    return NextResponse.json({ orderId: order.id, amount: CONSULTATION_AMOUNT, currency: CONSULTATION_CURRENCY }, { headers: responseHeaders });
  } catch {
    console.error('Payment provider order creation failed.');
    return NextResponse.json({ error: 'We could not start your payment. Please try again.', code: 'PAYMENT_PROVIDER_ERROR' }, { status: 502, headers: responseHeaders });
  }
}
