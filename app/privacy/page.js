import LegalPage from '../_src/components/legalPage';

export const metadata = {
    title: 'Privacy Policy',
    description: 'Privacy Policy for deepa.cat',
};

export default function PrivacyPolicyPage() {
    return (
        <LegalPage
            title="Privacy Policy"
            meta="Last updated: August 27, 2026 | Applies to: https://deepa.cat"
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
                            <strong>Information you provide directly:</strong> Discord account name, user ID and avatar.
                        </>,
                        <>
                            <strong>Information collected automatically:</strong> None. We do not use analytics or
                            tracking technologies.
                        </>,
                        <>
                            <strong>Information from third-party services:</strong> None.
                        </>,
                    ],
                },
                {
                    heading: 'How We Use Your Information',
                    paragraphs: [<>We use the information we collect to:</>],
                    items: [<>Provide, operate, and maintain our Service</>, <>Comply with legal obligations</>],
                },
                {
                    heading: 'How We Share Your Information',
                    paragraphs: [<>We may share your information in the following circumstances:</>],
                    items: [
                        <>
                            <strong>Legal requirements:</strong> We may disclose information if required by law or in
                            response to valid legal processes.
                        </>,
                    ],
                },
                {
                    heading: 'Cookies and Tracking Technologies',
                    paragraphs: [
                        <>We do not use cookies or tracking technologies for advertising or analytics.</>,
                        <>
                            When you log in with Discord, we set a session cookie to keep you signed in; it contains no
                            more than your Discord identity and is deleted when you log out. Your site preferences are stored locally in your browser and are not transmitted to us.
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
