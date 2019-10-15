/**
 * WordPress dependencies
 */
import {
	clickBlockAppender,
	getEditedPostContent,
	createNewPost,
	pressKeyWithModifier,
	selectBlockByClientId,
	getAllBlocks,
	saveDraft,
	publishPost,
	disableNavigationMode,
} from '@wordpress/e2e-test-utils';

describe( 'undo', () => {
	beforeEach( async () => {
		await createNewPost();
	} );

	it( 'should undo typing after a pause', async () => {
		await clickBlockAppender();

		await page.keyboard.type( 'before pause' );
		await new Promise( ( resolve ) => setTimeout( resolve, 1000 ) );
		await page.keyboard.type( ' after pause' );

		const after = await getEditedPostContent();

		expect( after ).toMatchSnapshot();

		await pressKeyWithModifier( 'primary', 'z' );

		const before = await getEditedPostContent();

		expect( before ).toMatchSnapshot();

		await pressKeyWithModifier( 'primary', 'z' );

		expect( await getEditedPostContent() ).toBe( '' );

		await pressKeyWithModifier( 'primaryShift', 'z' );

		expect( await getEditedPostContent() ).toBe( before );

		await pressKeyWithModifier( 'primaryShift', 'z' );

		expect( await getEditedPostContent() ).toBe( after );
	} );

	it( 'should undo typing after non input change', async () => {
		await clickBlockAppender();

		await page.keyboard.type( 'before keyboard ' );
		await pressKeyWithModifier( 'primary', 'b' );
		await page.keyboard.type( 'after keyboard' );

		const after = await getEditedPostContent();

		expect( after ).toMatchSnapshot();

		await pressKeyWithModifier( 'primary', 'z' );

		const before = await getEditedPostContent();

		expect( before ).toMatchSnapshot();

		await pressKeyWithModifier( 'primary', 'z' );

		expect( await getEditedPostContent() ).toBe( '' );

		await pressKeyWithModifier( 'primaryShift', 'z' );

		expect( await getEditedPostContent() ).toBe( before );

		await pressKeyWithModifier( 'primaryShift', 'z' );

		expect( await getEditedPostContent() ).toBe( after );
	} );

	it( 'Should undo/redo to expected level intervals', async () => {
		await clickBlockAppender();

		const firstBlock = await getEditedPostContent();

		await page.keyboard.type( 'This' );

		const firstText = await getEditedPostContent();

		await page.keyboard.press( 'Enter' );

		const secondBlock = await getEditedPostContent();

		await page.keyboard.type( 'is' );

		const secondText = await getEditedPostContent();

		await page.keyboard.press( 'Enter' );

		const thirdBlock = await getEditedPostContent();

		await page.keyboard.type( 'test' );

		const thirdText = await getEditedPostContent();

		await pressKeyWithModifier( 'primary', 'z' ); // Undo 3rd paragraph text.

		expect( await getEditedPostContent() ).toBe( thirdBlock );

		await pressKeyWithModifier( 'primary', 'z' ); // Undo 3rd block.

		expect( await getEditedPostContent() ).toBe( secondText );

		await pressKeyWithModifier( 'primary', 'z' ); // Undo 2nd paragraph text.

		expect( await getEditedPostContent() ).toBe( secondBlock );

		await pressKeyWithModifier( 'primary', 'z' ); // Undo 2nd block.

		expect( await getEditedPostContent() ).toBe( firstText );

		await pressKeyWithModifier( 'primary', 'z' ); // Undo 1st paragraph text.

		expect( await getEditedPostContent() ).toBe( firstBlock );

		await pressKeyWithModifier( 'primary', 'z' ); // Undo 1st block.

		expect( await getEditedPostContent() ).toBe( '' );
		// After undoing every action, there should be no more undo history.
		expect( await page.$( '.editor-history__undo[aria-disabled="true"]' ) ).not.toBeNull();

		await pressKeyWithModifier( 'primaryShift', 'z' ); // Redo 1st block.

		expect( await getEditedPostContent() ).toBe( firstBlock );
		// After redoing one change, the undo button should be enabled again.
		expect( await page.$( '.editor-history__undo[aria-disabled="true"]' ) ).toBeNull();

		await pressKeyWithModifier( 'primaryShift', 'z' ); // Redo 1st paragraph text.

		expect( await getEditedPostContent() ).toBe( firstText );

		await pressKeyWithModifier( 'primaryShift', 'z' ); // Redo 2nd block.

		expect( await getEditedPostContent() ).toBe( secondBlock );

		await pressKeyWithModifier( 'primaryShift', 'z' ); // Redo 2nd paragraph text.

		expect( await getEditedPostContent() ).toBe( secondText );

		await pressKeyWithModifier( 'primaryShift', 'z' ); // Redo 3rd block.

		expect( await getEditedPostContent() ).toBe( thirdBlock );

		await pressKeyWithModifier( 'primaryShift', 'z' ); // Redo 3rd paragraph text.

		expect( await getEditedPostContent() ).toBe( thirdText );
	} );

	it( 'should undo for explicit persistence editing post', async () => {
		// Regression test: An issue had occurred where the creation of an
		// explicit undo level would interfere with blocks values being synced
		// correctly to the block editor.
		//
		// See: https://github.com/WordPress/gutenberg/issues/14950

		// Issue is demonstrated from an edited post: create, save, and reload.
		await clickBlockAppender();
		await page.keyboard.type( 'original' );
		await saveDraft();
		await page.reload();
		await disableNavigationMode();

		// Issue is demonstrated by forcing state merges (multiple inputs) on
		// an existing text after a fresh reload.
		await selectBlockByClientId( ( await getAllBlocks() )[ 0 ].clientId );
		await page.keyboard.type( 'modified' );

		// The issue is demonstrated after the one second delay to trigger the
		// creation of an explicit undo persistence level.
		await new Promise( ( resolve ) => setTimeout( resolve, 1000 ) );

		await pressKeyWithModifier( 'primary', 'z' );

		// Assert against the _visible_ content. Since editor state with the
		// regression present was accurate, it would produce the correct
		// content. The issue had manifested in the form of what was shown to
		// the user since the blocks state failed to sync to block editor.
		const visibleContent = await page.evaluate( () => document.activeElement.textContent );
		expect( visibleContent ).toBe( 'original' );
	} );

	it( 'should not create undo levels when saving', async () => {
		await clickBlockAppender();
		await page.keyboard.type( '1' );
		await saveDraft();
		await pressKeyWithModifier( 'primary', 'z' );

		expect( await getEditedPostContent() ).toBe( '' );
	} );

	it( 'should not create undo levels when publishing', async () => {
		await clickBlockAppender();
		await page.keyboard.type( '1' );
		await publishPost();
		await pressKeyWithModifier( 'primary', 'z' );

		expect( await getEditedPostContent() ).toBe( '' );
	} );

	it( 'should immediately create an undo level on typing', async () => {
		await clickBlockAppender();

		await page.keyboard.type( '1' );
		await saveDraft();
		await page.reload();

		// Expect undo button to be disabled.
		expect( await page.$( '.editor-history__undo[aria-disabled="true"]' ) ).not.toBeNull();

		await page.click( '.wp-block-paragraph' );

		await page.keyboard.type( '2' );

		// Expect undo button to be enabled.
		expect( await page.$( '.editor-history__undo[aria-disabled="true"]' ) ).toBeNull();

		await pressKeyWithModifier( 'primary', 'z' );

		// Expect "1".
		expect( await getEditedPostContent() ).toMatchSnapshot();
	} );
} );