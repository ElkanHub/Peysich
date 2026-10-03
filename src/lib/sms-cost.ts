/** The DEFAULT price of one SMS part to the school, in pesewas
 *  (docs/MESSAGING_SETUP.md §0: 6p). The live price is the `sms` row of
 *  `price_settings`, read through getPrices() in src/messaging/wallet.ts;
 *  this constant only seeds that row and gives client code a fallback. */
export const SMS_COST_PESEWAS = 6;
