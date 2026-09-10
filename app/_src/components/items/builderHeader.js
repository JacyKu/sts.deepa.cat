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

function setDocumentTitle(name) {
    document.title = name && name !== 'Monumenta Builder' ? name + ' - Monumenta Builder' : 'Monumenta Builder';
}

// The build name lives in a ref (owned by BuilderPage) so renaming never
// re-renders the (very large) BuildForm. This header keeps the displayed text
// in local state while typing; only the commit writes the ref.
export default function BuilderHeader(data) {
    const [editing, setEditing] = React.useState(false);
    const [loaded, setLoaded] = React.useState(false);
    const [text, setText] = React.useState('Monumenta Builder');
    const [tempText, setTempText] = React.useState('Monumenta Builder');

    // Matches the server-side clamp when saving builds.
    const NAME_LIMIT = 50;

    React.useEffect(() => {
        if (data.parentLoaded) {
            let tempName = 'Monumenta Builder';
            // A DB-saved build can carry a display name from "My Builds" renaming.
            const name = data.savedName || decodeBuildName(data.build);
            if (name) tempName = decodeURIComponent(name);
            setText(tempName);
            setTempText(tempName);
            data.buildNameRef.current = tempName;
            setDocumentTitle(tempName);
            setLoaded(true);
        }
    }, [data.parentLoaded]);

    // Programmatic name changes (draft restore, reset) arrive through the
    // signal; re-read the ref instead of re-rendering the form.
    React.useEffect(() => {
        if (!data.parentLoaded || !data.nameSignal) return;
        const name = data.buildNameRef.current || 'Monumenta Builder';
        setText(name);
        setTempText(name);
        setDocumentTitle(name);
    }, [data.nameSignal]);

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
        setText(reallyTempText);
        setDocumentTitle(reallyTempText);
        // Writes the ref (bad-word filtered); does not re-render the form.
        data.setBuildName(reallyTempText);
        setEditing(false);
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
