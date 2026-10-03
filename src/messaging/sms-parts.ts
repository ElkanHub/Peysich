/** SMS arithmetic. Pure, client-safe: the blast form counts live with it.
 *
 *  GSM-7 text: 160 characters in one part, 153 per part after that. Anything
 *  outside the GSM alphabet (an em dash, an emoji, a curly quote) makes the
 *  whole message UCS-2: 70, then 67 per part. Extension characters
 *  (^ { } \ [ ] ~ | €) cost two in GSM-7. */

const GSM = new Set(
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà",
);
const GSM_EXT = new Set("^{}\\[~]|€");

export function smsParts(text: string): number {
  let units = 0;
  for (const ch of text) {
    if (GSM.has(ch)) units += 1;
    else if (GSM_EXT.has(ch)) units += 2;
    else return text.length <= 70 ? 1 : Math.ceil(text.length / 67);
  }
  return units <= 160 ? 1 : Math.ceil(units / 153);
}
