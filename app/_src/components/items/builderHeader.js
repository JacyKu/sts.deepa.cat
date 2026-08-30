import React from 'react';
import styles from '../../styles/BuilderHeader.module.css';
import { decodeBuildName } from '../../utils/builder/buildUrlCodec';
import { filterBadWords } from '../../utils/badWords';

function EditIcon({ className, onClick }) {
    return (
        <svg
            className={className}
            viewBox="0 0 24 24"
            width="35"
            height="35"
            fill="currentColor"
            aria-hidden="true"
            onClick={onClick}
        >
            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
        </svg>
    );
}

export default function BuilderHeader(data) {
    let text = data.text;
    let setText = data.setText;

    const [editing, setEditing] = React.useState(false);
    const [loaded, setLoaded] = React.useState(false);
    const [tempText, setTempText] = React.useState('Monumenta Builder');

    // Matches the server-side clamp when saving builds.
    const NAME_LIMIT = 50;

    React.useEffect(() => {
        if (data.parentLoaded) {
            let tempName = 'Monumenta Builder';
            // A DB-saved build can carry a display name from "My Builds" renaming.
            const name = data.savedName || decodeBuildName(data.build);
            if (name) tempName = name;
            setText(decodeURIComponent(tempName));
            setTempText(decodeURIComponent(tempName));
            setLoaded(true);
        }
    }, [data.parentLoaded]);

    function editButtonClicked(e) {
        setEditing(true);
    }

    function hasfocus(e) {
        e.target.select();
    }

    function keydown(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
        }
        if (e.key === 'Enter' || e.key === 'Escape') {
            stopEditing();
        }
    }

    function lostfocus(e) {
        stopEditing();
    }

    function stopEditing() {
        // react state is async so i need... multiple layers of temporary text
        let reallyTempText = tempText;
        if (reallyTempText.trim() == '') {
            reallyTempText = 'Monumenta Builder';
        }
        setTempText(reallyTempText);
        setText(reallyTempText); // text and temptext are split so window title isn't updated by builder.js while we're typing
        setEditing(false);
        data.setUpdateLink(true);
    }

    function textchanged(e) {
        const { cleaned, found } = filterBadWords(e.target.value);
        if (found && data.onFiltered) data.onFiltered();
        setTempText(cleaned);
    }

    function getPlaceholderBuildName() {
        // temporarily puts the name until useState loads, everything else is populated, etc
        try {
            return decodeBuildName(data.build) || 'Monumenta Builder';
        } catch (e) {
            return 'Monumenta Builder';
        }
    }

    return (
        <span className={styles.builderHeader}>
            {editing ? (
                <span className={styles.nameEditWrap}>
                    <input
                        type="text"
                        value={tempText}
                        onChange={textchanged}
                        onKeyDown={keydown}
                        spellCheck="false"
                        maxLength={NAME_LIMIT}
                        className={styles.theTextbox}
                        autoFocus
                        onFocus={hasfocus}
                        onBlur={lostfocus}
                    />
                    <span className={styles.nameCounter}>
                        {tempText.length}/{NAME_LIMIT}
                    </span>
                </span>
            ) : (
                <h1 className={styles.builderHeaderText}>{loaded ? text : getPlaceholderBuildName()}</h1>
            )}
            <EditIcon className={styles.builderHeaderEditIcon} onClick={editButtonClicked} />
        </span>
    );
}
