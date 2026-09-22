'use client';

import React from 'react';
import BuildForm from './builder/buildForm';
import styles from '../styles/Items.module.css';

export default function BuilderPage({
    build,
    itemData,
    savedState,
    savedName,
    notes,
    canEditNotes,
    buildId,
    revision,
    canPublicise,
    isPublic,
    isAnonymous,
    sharedSet,
}) {
    // The build name lives in a ref: the header reads/writes it directly, so
    // renaming never re-renders BuildForm (which is expensive to render).
    const buildNameRef = React.useRef('Monumenta Builder');
    const [itemsToDisplay, setItemsToDisplay] = React.useState({});

    function change(itemData) {
        setItemsToDisplay(itemData);
    }
    const [parentLoaded, setParentLoaded] = React.useState(false);

    // Flipped in a layout effect so BuildForm's restore effect (which also runs
    // as a layout effect) can lay the build out before the first paint instead
    // of growing the page a frame later.
    React.useLayoutEffect(() => {
        setParentLoaded(true);
    }, []);

    return (
        <div className="container-fluid">
            <main className={styles.builderPage}>
                <BuildForm
                    update={change}
                    build={build}
                    savedState={savedState}
                    savedName={savedName}
                    notes={notes}
                    canEditNotes={canEditNotes}
                    buildId={buildId}
                    revision={revision}
                    canPublicise={canPublicise}
                    isPublic={isPublic}
                    isAnonymous={isAnonymous}
                    sharedSet={sharedSet}
                    parentLoaded={parentLoaded}
                    itemData={itemData}
                    itemsToDisplay={itemsToDisplay}
                    buildNameRef={buildNameRef}
                ></BuildForm>
            </main>
        </div>
    );
}
