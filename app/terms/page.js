import LegalPage from '../_src/components/legalPage';

export const metadata = {
    title: 'Terms of Service',
    description: 'Terms of Service for deepa.cat',
};

export default function TermsOfServicePage() {
    return (
        <LegalPage
            title="Terms of Service"
            meta="Last updated: August 27, 2026 | Applies to: https://deepa.cat"
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
                            deepa.cat provides SaaS / Software services through our platform. The Service is provided on
                            a Free basis. We reserve the right to modify, suspend, or discontinue the Service at any
                            time with or without notice.
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
                    heading: 'Prohibited Uses',
                    paragraphs: [<>You agree not to use the Service:</>],
                    items: [
                        <>In any way that violates applicable laws or regulations</>,
                        <>To transmit unsolicited commercial communications (spam)</>,
                        <>To impersonate any person or entity</>,
                        <>To engage in any conduct that restricts or inhibits others&apos; use of the Service</>,
                        <>To attempt to gain unauthorized access to any part of the Service</>,
                        <>To use automated scripts to collect information from or interact with the Service</>,
                        <>To upload or transmit viruses or other malicious code</>,
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
