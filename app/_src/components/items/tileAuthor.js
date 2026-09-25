import React from 'react';
import styles from '../../styles/Items.module.css';

// Author row shown on the custom items database tiles (the regular item tiles
// are authorless); hidden when the item carries no author name.
export default function TileAuthor({ name, avatar }) {
    if (!name) return null;
    return (
        <div className={styles.tileAuthor}>
            {avatar ? <img className={styles.tileAuthorAvatar} src={avatar} alt="" width={18} height={18} /> : null}
            <span className={styles.tileAuthorName}>{name}</span>
        </div>
    );
}
