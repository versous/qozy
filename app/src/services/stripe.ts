import { loadStripe } from '@stripe/stripe-react-native';

export const stripePromise = loadStripe({
  publishableKey: 'pk_test_your_key_here',
});

export const stripeService = {
  async createPaymentSheet(paymentIntentId: string, customerId: string) {
    console.log('Initialisation du PaymentSheet Stripe...');
  },

  async confirmPayment() {
    console.log('Confirmation du paiement...');
  }
};
