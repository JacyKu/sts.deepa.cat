import LegalPage from '../_src/components/legalPage';

export const metadata = {
    title: 'Privacy Policy',
    description: 'How Spare the Sympathy stores and uses your data',
    openGraph: {
        title: 'Privacy Policy',
        description: 'How Spare the Sympathy stores and uses your data',
        images: [{ url: '/favicon/favicon.png' }],
    },
    twitter: {
        title: 'Privacy Policy',
        description: 'How Spare the Sympathy stores and uses your data',
        images: ['/favicon/favicon.png'],
    },
};

export default function PrivacyPolicyPage() {
    return (
        <LegalPage
            title="Privacy Policy"
            meta="Last updated: September 21, 2026 | Applies to: https://deepa.cat"
            sections={[
                {
                    heading: 'Introduction',
                    paragraphs: [
                        <>
                            This Privacy Policy describes how deepa.cat (&quot;we,&quot; &quot;us,&quot; or
                            &quot;our&quot;) collects, uses, and shares information about you when you use our website
                            at https://deepa.cat (the &quot;Service&quot;).
                        </>,
                        <>
                            By using our Service, you agree to the collection and use of information in accordance with
                            this policy. This policy applies to all visitors, users, and others who access or use the
                            Service.
                        </>,
                    ],
                },
                {
                    heading: 'Information We Collect',
                    paragraphs: [<>We collect several types of information in connection with the Service:</>],
                    items: [
                        <>
                            <strong>Information you provide directly:</strong> Your Discord account ID, username,
                            display name and avatar, plus the content you save on the site: builds, notes, custom items,
                            saved skill and infusion sets, favourites and any profile pictures you upload.
                        </>,
                        <>
                            <strong>Minecraft data (mod and account linking):</strong> When you link a Minecraft
                            profile, your Minecraft UUID and username; the build, item and infusion data you choose to
                            export or upload with the mod. The mod&apos;s per-device upload token is stored only as a
                            hash, so the token itself is never kept. The link request also stores the IP address it came
                            from and its time; both are shown on the confirmation page so you can check the request was
                            yours, and the row is deleted once the code is used or after 15 minutes.
                        </>,
                        <>
                            <strong>Information collected automatically:</strong> We do not use analytics or tracking
                            technologies, and there are no advertising cookies. To deliver the site and protect it from
                            abuse we process your IP address and basic request data (time, path, browser user agent):
                            the IP is used for rate limits and temporary blocks, which are kept in server memory only.
                            Cloudflare and our server also keep standard access logs for security and troubleshooting,
                            which are rotated and kept short-term. Minecraft head images you or other visitors request
                            are cached on our server so they don&apos;t have to be fetched again.
                        </>,
                        <>
                            <strong>Information from third-party services: </strong>Your Discord identity when you log
                            in with Discord, and your Minecraft username and avatar from Mojang&apos;s public API and
                            mc-heads.net when you link a profile.
                        </>,
                        <>
                            <strong>Moderation records:</strong> When your account is moderated, we store the sanction
                            applied (for example a suspension or a ban), the reason, when it expires, the moderator who
                            applied it, and when it was issued.
                        </>,
                    ],
                },
                {
                    heading: 'How We Use Your Information',
                    paragraphs: [<>We use the information we collect to:</>],
                    items: [
                        <>
                            Provide, operate, and maintain our Service (build planner, item database, public build
                            database, custom items, Discord bot and Minecraft mod)
                        </>,
                        <>Link your Minecraft profile to your Discord account when you ask us to</>,
                        <>
                            Enforce our Terms of Service and keep the Service and its users safe - for example hiding
                            public content that breaks the Terms or applying suspensions and bans
                        </>,
                        <>
                            Prevent abuse of the Service with rate limits and temporary IP blocks, and show you where a
                            Minecraft link request came from
                        </>,
                        <>Keep regular backups of the database so the Service can be restored after failures</>,
                        <>Comply with legal obligations</>,
                    ],
                },
                {
                    heading: 'How We Share Your Information',
                    paragraphs: [
                        <>
                            <strong>
                                We do not sell your personal information, and we do not give it to anyone for
                                advertising or analytics.
                            </strong>{' '}
                            We only share it with the service providers needed to run the Service, or when the law
                            requires it:
                        </>,
                    ],
                    items: [
                        <>
                            <strong>Service providers: </strong>The site is delivered through Cloudflare&apos;s network
                            (traffic proxying, caching, DDoS protection and security), and database backups are stored
                            in Cloudflare R2 object storage. Discord processes login (OAuth) and bot interactions. When
                            you pick your Minecraft profile picture, your browser loads the head image from mc-heads.net
                            (the image URL contains only your Minecraft UUID).
                        </>,
                        <>
                            <strong>Public content:</strong> anything you choose to make public (public builds, public
                            skill sets and shared custom items) is visible to everyone and shown in the public
                            databases. Public pages show your display name and avatar, never your Discord account ID.
                        </>,
                        <>
                            <strong>Legal requirements:</strong> We may disclose information if required by law or in
                            response to valid legal processes.
                        </>,
                    ],
                },
                {
                    heading: 'Cookies and Tracking Technologies',
                    paragraphs: [
                        <>
                            We do not use cookies or tracking technologies for advertising or analytics, and we do not
                            share data with advertisers. We only set functional cookies the Service needs:
                        </>,
                    ],
                    items: [
                        <>
                            <code>sts-session</code> - a session cookie set when you log in with Discord; it keeps you
                            signed in and is deleted when you log out.
                        </>,
                        <>
                            <code>sts-oauth-state</code> - a short-lived (10 minute) cookie set while a Discord login is
                            in progress; it protects the login from cross-site request forgery.
                        </>,
                        <>
                            <code>lang</code> - remembers the language you pick (a session cookie).
                        </>,
                        <>
                            Your other preferences (theme, backdrop, animations, caching, drafts and comparison picks)
                            are stored in your browser&apos;s local storage and are never sent to us.
                        </>,
                    ],
                },
                {
                    heading: 'Data Retention',
                    paragraphs: [
                        <>We will retain your personal information for as long as necessary.</>,
                        <>
                            When we no longer need to retain your information, we will securely delete or anonymize it.
                            In practice: pending Minecraft link requests (including the IP address they came from) are
                            deleted when used or within 15 minutes; rate-limit counters and temporary blocks live in
                            server memory and reset by themselves; cached Minecraft heads are re-fetched and replaced
                            over time.
                        </>,
                        <>
                            Database backups (which include the data above) are kept for a limited period - currently up
                            to 30 days - and are then deleted automatically. Backups are stored on our server and in
                            Cloudflare R2 object storage.
                        </>,
                        <>
                            Moderation records (the sanction, its reason and the moderator who applied it) are kept
                            after account deletion, so deleting an account cannot remove an active sanction.
                        </>,
                    ],
                },
                {
                    heading: 'Deleting Your Account',
                    paragraphs: [
                        <>
                            You can delete your account at any time from the account page. Deleting it removes your
                            Discord profile data, uploaded pictures, favourites, custom items, saved sets and Minecraft
                            links. Your builds are kept but become anonymous and are removed from the public database;
                            the share links keep working.
                        </>,
                        <>
                            You can also ask us to delete specific content or answer data questions at{' '}
                            <a href="mailto:legal@deepa.cat">legal@deepa.cat</a>.
                        </>,
                    ],
                },
                {
                    heading: "Children's Privacy",
                    paragraphs: [
                        <>
                            Our Service is not directed to children under the age of 13. We do not knowingly collect
                            personal information from children under 13. If we become aware that we have collected
                            personal information from a child under 13, we will take steps to delete that information
                            promptly.
                        </>,
                        <>
                            If you are a parent or guardian and believe your child has provided us with personal
                            information, please contact us at <a href="mailto:legal@deepa.cat">legal@deepa.cat</a>.
                        </>,
                    ],
                },
                {
                    heading: 'Data Security',
                    paragraphs: [
                        <>
                            We implement appropriate technical and organizational security measures to protect your
                            personal information against accidental or unlawful destruction, loss, alteration,
                            unauthorized disclosure, or access.
                        </>,
                        <>
                            However, no method of transmission over the internet or method of electronic storage is 100%
                            secure. While we strive to use commercially acceptable means to protect your personal
                            information, we cannot guarantee its absolute security.
                        </>,
                    ],
                },
                {
                    heading: 'Third-Party Links',
                    paragraphs: [
                        <>
                            Our Service may contain links to third-party websites. We have no control over and assume no
                            responsibility for the content, privacy policies, or practices of any third-party sites or
                            services. We encourage you to review the privacy policy of every site you visit.
                        </>,
                    ],
                },
                {
                    heading: 'STS Discord Bot',
                    paragraphs: [
                        <>
                            The Service includes a Discord bot. When you use the bot&apos;s commands, it processes only
                            the data needed to respond - for example, /builds mine retrieves the builds linked to your
                            Discord account through the site API.
                        </>,
                        <>
                            The bot does not store personal information: it keeps only a short-lived in-memory cache of
                            responses (a few minutes) and writes nothing to disk. Command interactions are processed by
                            Discord under Discord&apos;s own privacy policy.
                        </>,
                    ],
                },
                {
                    heading: 'STS Minecraft Mod',
                    paragraphs: [
                        <>
                            The Service includes an optional Minecraft mod that exports builds from the game, uploads
                            them to the site, and can upload items the site does not know about as custom items.
                        </>,
                        <>
                            The mod acts only when you run its commands. To upload to your account, you first link your
                            Minecraft UUID to your Discord account: the mod asks the site for a single-use code, you
                            open the confirmation link in your browser and confirm while logged in. The code expires
                            after 15 minutes and is consumed on use, the confirmation page shows the IP address and time
                            of the request that created it so you can check it was you, and the mod never sees your
                            Discord credentials.
                        </>,
                        <>
                            Uploaded builds and items are stored like content you save on the site: a build belongs to
                            the linked account (or is stored anonymously when the UUID is not linked), and uploaded
                            custom items are owned by the linked account. Rate limits apply to uploads.
                        </>,
                    ],
                },
                {
                    heading: 'Changes to This Privacy Policy',
                    paragraphs: [
                        <>
                            We may update our Privacy Policy from time to time. We will notify you of any changes by
                            posting the new Privacy Policy on this page and updating the &quot;Last updated&quot; date
                            at the top.
                        </>,
                        <>
                            You are advised to review this Privacy Policy periodically for any changes. Changes to this
                            Privacy Policy are effective when they are posted on this page.
                        </>,
                    ],
                },
                {
                    heading: 'Contact Us',
                    paragraphs: [<>If you have any questions about this Privacy Policy, please contact us:</>],
                    items: [
                        <>
                            By email: <a href="mailto:legal@deepa.cat">legal@deepa.cat</a>
                        </>,
                    ],
                },
            ]}
        />
    );
}
