import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { A, H2, P, Summary, Table } from "../prose";

export const metadata: Metadata = pageMeta({
  title: "Cookies & local storage", path: "/legal/cookies",
  description: "The two cookies SchoolSpec sets, what is saved on your own device, and why there is no cookie pop-up: nothing tracks you.",
});

export default function Cookies() {
  return (
    <>
      <p className="mk-hand">cookies & local storage</p>
      <h1 className="mt-2 text-[clamp(36px,5vw,56px)] font-medium leading-[.98] tracking-[-.035em]">Two cookies, no tracking, no pop-up</h1>
      <Summary items={[
        "One cookie keeps you signed in. One routes you to your school on a preview address. That is all.",
        "No advertising, no analytics, no third-party cookies, nothing that follows you to other sites.",
        "A few things are saved on your own phone or computer so the app works offline and remembers your choices. They never leave your device.",
        "Because none of this needs consent under the law, there is no cookie banner. It would be noise.",
      ]} />

      <H2>Cookies</H2>
      <Table head={["Name", "What it does", "Lasts", "Needed?"]} rows={[
        ["better-auth.session_token (and its short cache)", "Keeps you signed in and tells the server who you are on each request", "Until you sign out, or 7 days of inactivity", "Yes — the app cannot work without it"],
        ["pv_tenant", "On a preview address without subdomains, remembers which school you entered. On the real address your school is in the web address, and this cookie is not used", "Session", "Yes, in preview only"],
      ]} />
      <P>Both are first-party, HttpOnly where the browser allows, and sent only to SchoolSpec. Neither is read by anyone else.</P>

      <H2>Saved on your device (not cookies)</H2>
      <Table head={["What", "Why", "Leaves your device?"]} rows={[
        ["Your light or dark choice", "So the app opens the way you left it", "No"],
        ["Which accounts have signed in on this device (name and login name, never the password)", "So Switch account is two taps", "No"],
        ["Whether you have seen the walkthrough", "So it does not keep offering", "No"],
        ["Whether you hid the setup checklist", "Same", "No"],
        ["A register you saved with no signal", "So it sends itself when the signal returns — then it is removed from the device", "Yes, to the school’s account, once"],
        ["Recently opened pages (the app’s offline cache)", "So the app opens without a connection", "No"],
        ["A push-notification subscription, if you turned notifications on", "So your phone can be reached", "The subscription address goes to SchoolSpec so it can send to you"],
      ]} />
      <P>Signing out removes the accounts list and the cached pages from that device. Clearing your browser’s site data removes all of it.</P>

      <H2>Why there is no cookie banner</H2>
      <P>Cookie banners exist to collect consent for cookies that track people or serve advertising. SchoolSpec sets none. The two cookies above are strictly necessary for the service you asked for, and the things saved on your device are your own conveniences that never leave it. Ghana’s Data Protection Act does not require consent for that, and neither does the stricter European rule. So there is nothing to ask, and a banner would only be one more thing between a head teacher and the register. If that ever changes, this page will change first, and consent will be asked properly.</P>

      <H2>Third parties</H2>
      <P>Fonts are served from SchoolSpec’s own address, not from Google. The payment page for the school’s subscription is provided by Paystack and has its own cookies on its own address; they apply only while you are there. Everything else about who receives data is in the <A href="/legal/privacy#who-sees">privacy policy</A>.</P>
    </>
  );
}
