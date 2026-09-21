import LegalPage from '../_src/components/legalPage';

export const metadata = {
    title: 'Terms of Service',
    description: 'Rules for using Spare the Sympathy',
    openGraph: {
        title: 'Terms of Service',
        description: 'Rules for using Spare the Sympathy',
        images: [{ url: '/favicon/favicon.png' }],
    },
    twitter: {
        title: 'Terms of Service',
        description: 'Rules for using Spare the Sympathy',
        images: ['/favicon/favicon.png'],
    },
};

export default function TermsOfServicePage() {
    return (
        <LegalPage
            title="Terms of Service"
            meta="Last updated: September 21, 2026 | Applies to: https://deepa.cat"
            sections={[
                {
                    heading: 'Acceptance of Terms',
                    paragraphs: [
                        <>
                            By accessing or using https://deepa.cat (the &quot;Service&quot;) operated by deepa.cat
                            (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;), you agree to be bound by these Terms
                            of Service (&quot;Terms&quot;). If you disagree with any part of these terms, you may not
                            access the Service.
                        </>,
                    ],
                },
                {
                    heading: 'Description of Service',
                    paragraphs: [
                        <>
                            deepa.cat provides a free Monumenta build planner, item database, public build database and
                            custom item sharing, together with a Discord bot and an optional Minecraft mod for exporting
                            builds and items from the game. The Service is provided on a Free basis. We reserve the
                            right to modify, suspend, or discontinue the Service at any time with or without notice.
                        </>,
                    ],
                },
                {
                    heading: 'User Accounts',
                    paragraphs: [
                        <>
                            When you create an account with us, you must provide accurate, complete, and current
                            information. You are responsible for:
                        </>,
                    ],
                    items: [
                        <>Maintaining the confidentiality of your account credentials</>,
                        <>All activities that occur under your account</>,
                        <>Notifying us immediately of any unauthorized use of your account</>,
                    ],
                },
                {
                    heading: 'Age Requirements',
                    paragraphs: [
                        <>
                            You must be at least 13 years to use this Service. By using the Service, you represent that
                            you meet this age requirement. If we become aware that a user does not meet this
                            requirement, we will terminate their account.
                        </>,
                    ],
                },
                {
                    heading: 'Discord Bot',
                    paragraphs: [
                        <>
                            The Service includes a Discord bot. Using the bot is subject to these Terms and to the same
                            age requirement. You may not use the bot to spam, harass, or otherwise abuse other users or
                            the Service.
                        </>,
                        <>
                            The bot&apos;s commands are provided &quot;as is&quot; and may be changed, renamed, or
                            removed at any time.
                        </>,
                    ],
                },
                {
                    heading: 'Minecraft Mod',
                    paragraphs: [
                        <>
                            The Service includes an optional Minecraft mod that exports builds and items from the game
                            and uploads them to the site on your command.
                        </>,
                        <>
                            You may only upload content you have the right to share. Uploads are tied to your linked
                            Minecraft UUID and Discord account, count toward the Service&apos;s rate limits, and may be
                            removed if they break these Terms.
                        </>,
                        <>
                            Linking a Minecraft profile creates a single-use code that expires after 15 minutes; the
                            request&apos;s IP address and time are shown on the confirmation page, and the mod&apos;s
                            upload token is stored only as a hash.
                        </>,
                        <>
                            You may not use the mod to attack, overload, or reverse-engineer the Service, to bypass rate
                            limits, or to upload unlawful or infringing content.
                        </>,
                        <>
                            The mod is provided &quot;as is&quot;, requires a compatible Minecraft/Monumenta version,
                            and may be changed or discontinued at any time.
                        </>,
                    ],
                },
                {
                    heading: 'Data and Privacy',
                    paragraphs: [
                        <>
                            Our <a href="/privacy">Privacy Policy</a> explains what we store and why. In short: we store
                            your Discord profile data, the content you save, your Minecraft links, and (for security) IP
                            addresses used for rate limits and Minecraft link confirmation. We do not sell your personal
                            information and we do not share it with anyone except the service providers listed below and
                            where the law requires it.
                        </>,
                        <>
                            You are responsible for the content you upload and for keeping your account secure. You can
                            delete your account at any time from the account page; moderation records are kept as
                            described in the Privacy Policy.
                        </>,
                    ],
                },
                {
                    heading: 'Third-Party Services',
                    paragraphs: [
                        <>
                            The Service relies on third parties: Discord (login and bot), Cloudflare (network delivery,
                            security and database backups in R2 object storage), and Mojang&apos;s public API and
                            mc-heads.net (Minecraft profile names and avatar images). Cloudflare and our server also
                            process IP addresses to deliver the Service and enforce rate limits. Your use of those parts
                            of the Service is also subject to their own terms and privacy policies.
                        </>,
                    ],
                },
                {
                    heading: 'Prohibited Uses',
                    paragraphs: [<>You agree not to use the Service:</>],
                    items: [
                        <>In any way that violates applicable laws or regulations</>,
                        <>To transmit unsolicited commercial communications (spam)</>,
                        <>To impersonate any person or entity</>,
                        <>To engage in any conduct that restricts or inhibits others&apos; use of the Service</>,
                        <>To attempt to gain unauthorized access to any part of the Service</>,
                        <>To use automated scripts to collect information from or interact with the Service</>,
                        <>To upload content that is unlawful, infringing, or that you do not have the right to share</>,
                        <>To abuse, overload, or attempt to bypass the rate limits of the site, bot, or mod APIs</>,
                        <>To upload or transmit viruses or other malicious code</>,
                    ],
                },
                {
                    heading: 'Enforcement and Moderation',
                    paragraphs: [
                        <>
                            We may remove or hide any content that breaks these Terms, including public builds and
                            custom items, and we may restrict, suspend, or permanently ban accounts that break them.
                            This is done by the site&apos;s moderators and applies to the site, the Discord bot and the
                            Minecraft mod alike: a sanctioned account cannot save, publicise, upload, or link while the
                            sanction is active.
                        </>,
                        <>
                            Sanctions can be temporary or permanent and are recorded with their reason and expiry. If
                            you believe a moderation decision was made in error, contact us at{' '}
                            <a href="mailto:legal@deepa.cat">legal@deepa.cat</a>.
                        </>,
                    ],
                },
                {
                    heading: 'Payment Terms',
                    paragraphs: [<>Our Service operates on a Free basis.</>],
                },
                {
                    heading: 'Disclaimer of Warranties',
                    paragraphs: [
                        <>
                            The Service is provided on an &quot;AS IS&quot; and &quot;AS AVAILABLE&quot; basis without
                            any warranties of any kind, whether express or implied. deepa.cat expressly disclaims all
                            warranties, including but not limited to implied warranties of merchantability, fitness for
                            a particular purpose, and non-infringement.
                        </>,
                        <>
                            We do not warrant that: (a) the Service will function uninterrupted or error-free; (b)
                            defects will be corrected; (c) the Service is free of viruses or other harmful components.
                        </>,
                    ],
                },
                {
                    heading: 'Limitation of Liability',
                    paragraphs: [
                        <>
                            To the maximum extent permitted by applicable law, deepa.cat shall not be liable for any
                            indirect, incidental, special, consequential, or punitive damages, including but not limited
                            to loss of profits, data, goodwill, or other intangible losses, resulting from your use of
                            or inability to use the Service.
                        </>,
                        <>
                            In no event shall deepa.cat&apos;s total liability to you exceed the greater of one hundred
                            dollars ($100) or the amounts paid by you to deepa.cat in the past twelve months.
                        </>,
                    ],
                },
                {
                    heading: 'Governing Law',
                    paragraphs: [
                        <>
                            These Terms shall be governed and construed in accordance with the laws of the Netherlands,
                            without regard to its conflict of law provisions.
                        </>,
                        <>
                            Any disputes arising under these Terms will be resolved through binding arbitration in the
                            Netherlands, except that either party may seek injunctive relief in any court of competent
                            jurisdiction.
                        </>,
                    ],
                },
                {
                    heading: 'Changes to Terms',
                    paragraphs: [
                        <>
                            We reserve the right to modify these Terms at any time. We will notify users of material
                            changes by posting the updated Terms on this page with a new effective date. Your continued
                            use of the Service after changes are posted constitutes acceptance of the revised Terms.
                        </>,
                    ],
                },
                {
                    heading: 'Contact Us',
                    paragraphs: [
                        <>
                            If you have questions about these Terms, please contact us at{' '}
                            <a href="mailto:legal@deepa.cat">legal@deepa.cat</a>.
                        </>,
                    ],
                },
            ]}
        />
    );
}
