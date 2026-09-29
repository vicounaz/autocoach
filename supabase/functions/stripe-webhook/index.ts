// Supabase Edge Function: stripe-webhook
// Variables requises : STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
// SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
import Stripe from 'npm:stripe@16.12.0';
import { createClient } from 'npm:@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2024-06-20' });
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

Deno.serve(async (req) => {
  const signature = req.headers.get('stripe-signature');
  if (!signature) return new Response('Signature absente', { status: 400 });
  const raw = await req.text();
  try {
    const event = await stripe.webhooks.constructEventAsync(raw, signature, Deno.env.get('STRIPE_WEBHOOK_SECRET')!);
    const object = event.data.object as any;
    const userId = object.metadata?.user_id || object.client_reference_id;
    if (event.type === 'checkout.session.completed' && userId) {
      await admin.from('profiles').update({ is_premium: true, stripe_customer_id: object.customer }).eq('id', userId);
    }
    if ((event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated') && userId) {
      const active = ['active', 'trialing'].includes(object.status);
      await admin.from('profiles').update({ is_premium: active, stripe_customer_id: object.customer }).eq('id', userId);
      await admin.from('subscriptions').upsert({ user_id: userId, stripe_customer_id: object.customer, stripe_subscription_id: object.id, stripe_price_id: object.items?.data?.[0]?.price?.id, status: object.status, current_period_end: object.current_period_end ? new Date(object.current_period_end * 1000).toISOString() : null, updated_at: new Date().toISOString() }, { onConflict: 'stripe_subscription_id' });
    }
    if (event.type === 'customer.subscription.deleted') {
      const sub = await admin.from('subscriptions').select('user_id').eq('stripe_subscription_id', object.id).single();
      if (sub.data?.user_id) await admin.from('profiles').update({ is_premium: false }).eq('id', sub.data.user_id);
      await admin.from('subscriptions').update({ status: 'canceled', updated_at: new Date().toISOString() }).eq('stripe_subscription_id', object.id);
    }
    return new Response('ok', { status: 200 });
  } catch (e) {
    return new Response(`Webhook invalide: ${e.message}`, { status: 400 });
  }
});
