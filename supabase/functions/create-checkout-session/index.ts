// Supabase Edge Function: create-checkout-session
// Variables requises : STRIPE_SECRET_KEY, STRIPE_PRICE_ID, SUPABASE_URL,
// SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
import Stripe from 'npm:stripe@16.12.0';
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const auth = req.headers.get('Authorization');
    if (!auth) throw new Error('Authentification requise.');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: auth } } }
    );
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) throw new Error('Utilisateur non authentifié.');

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    const { data: profile } = await admin.from('profiles').select('stripe_customer_id').eq('id', user.id).single();
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2024-06-20' });
    let customerId = profile?.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: user.email, metadata: { user_id: user.id } });
      customerId = customer.id;
      await admin.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id);
    }

    const body = await req.json().catch(() => ({}));
    const origin = body.return_url || req.headers.get('origin') || 'http://localhost:3000';
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription', customer: customerId,
      line_items: [{ price: Deno.env.get('STRIPE_PRICE_ID')!, quantity: 1 }],
      success_url: `${origin}?payment=success`, cancel_url: `${origin}?payment=cancelled`,
      client_reference_id: user.id,
      metadata: { user_id: user.id }, subscription_data: { metadata: { user_id: user.id } }
    });
    return new Response(JSON.stringify({ url: session.url }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});
