import styles from '../styles/Legal.module.css';

export default function LegalPage({ title, meta, sections }) {
    return (
        <div className={styles.container}>
            <h1 className={styles.title}>{title}</h1>
            <p className={styles.meta}>{meta}</p>
            {sections.map((section, i) => (
                <section key={i} className={styles.section}>
                    <h2 className={styles.heading}>{section.heading}</h2>
                    {section.paragraphs?.map((paragraph, j) => (
                        <p key={j} className={styles.paragraph}>
                            {paragraph}
                        </p>
                    ))}
                    {section.items ? (
                        <ul className={styles.list}>
                            {section.items.map((item, j) => (
                                <li key={j}>{item}</li>
                            ))}
                        </ul>
                    ) : null}
                </section>
            ))}
        </div>
    );
}
