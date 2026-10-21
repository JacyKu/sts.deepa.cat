import React from 'react';
import styles from '../styles/EmojiText.module.css';

const SEAHORSE = ':seahorse:';
const SHORTCODE = /(:seahorse:)/gi;

/**
 * Renders build names and notes, turning supported :shortcode: tokens into
 * inline images. The image is sized in em units so it matches the surrounding
 * font at every size (builder title, build cards, notes, etc.).
 */
export default function BuildEmojiText({ text }) {
    if (typeof text !== 'string' || !text) {
        return text ?? null;
    }
    const parts = text.split(SHORTCODE);
    if (parts.length === 1) {
        return text;
    }
    return (
        <>
            {parts.map((part, index) =>
                part.toLowerCase() === SEAHORSE ? (
                    <img
                        key={index}
                        src="/images/emojis/seahorse.png"
                        alt="seahorse"
                        title={SEAHORSE}
                        className={styles.emoji}
                        draggable={false}
                        decoding="async"
                    />
                ) : (
                    <React.Fragment key={index}>{part}</React.Fragment>
                )
            )}
        </>
    );
}
