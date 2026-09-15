import LegalPage from '../_src/components/legalPage';

export const metadata = {
    title: 'Privacy Policy',
    description: 'Privacy Policy for deepa.cat',
};

export default function PrivacyPolicyPage() {
    return (
        <LegalPage
            title="Privacy Policy"
            meta="Last updated: September 15, 2026 | Applies to: https://deepa.cat"
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
                            <strong>Information you provide directly:</strong> Discord account name, user ID and avatar,
                            plus the builds, notes and custom items you save on the site.
                        </>,
                        <>
                            <strong>Minecraft data (mod and account linking):</strong> When you link a Minecraft
                            profile, your Minecraft UUID and username, and the build or item data you choose to export
                            or upload with the mod.
                        </>,
                        <>
                            <strong>Information collected automatically:</strong> None. We do not use analytics or
                            tracking technologies. Our network provider (Cloudflare) processes request data such as your
                            IP address to deliver the site and protect it from abuse.
                        </>,
                        <>
                            <strong>Information from third-party services: </strong>Your Discord identity when you log
                            in with Discord, and your Minecraft username and avatar from Mojang&apos;s public API and
                            mc-heads.net when you link a profile.
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
                        <>Keep regular backups of the database so the Service can be restored after failures</>,
                        <>Comply with legal obligations</>,
                    ],
                },
                {
                    heading: 'How We Share Your Information',
                    paragraphs: [<>We may share your information in the following circumstances:</>],
                    items: [
                        <>
                            <strong>Service providers: </strong>The site is delivered through Cloudflare&apos;s network
                            (traffic proxying, caching, DDoS protection and security), and database backups are stored
                            in Cloudflare R2 object storage. Discord processes login (OAuth) and bot interactions. When
                            you pick your Minecraft profile picture, your browser loads the head image from mc-heads.net
                            (the image URL contains only your Minecraft UUID).
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
                            <code>sts-build-owner-&lt;id&gt;</code> - set when you save a build while logged out; it
                            lets that browser edit or publicise the anonymous build it created. It lasts up to one year
                            or until you clear your browser data.
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
                        </>,
                        <>
                            Database backups (which include the data above) are kept for a limited period - currently up
                            to 30 days - and are then deleted automatically. Backups are stored on our server and in
                            Cloudflare R2 object storage.
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
                            after 15 minutes and is consumed on use, and the mod never sees your Discord credentials.
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
