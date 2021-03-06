// External Dependencies.
import shorthash from 'shorthash';
import classnames from 'classnames/dedupe';
import deepEqual from 'deep-equal';

// Internal Dependencies.
import { camelCaseToDash } from '../_utils.jsx';

const {
    applyFilters,
    addFilter,
} = wp.hooks;

const {
    hasBlockSupport,
} = wp.blocks;

const {
    Component,
    Fragment,
} = wp.element;

const {
    createHigherOrderComponent,
} = wp.compose;

const cssPropsWithPixels = [ 'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width', 'border-width', 'border-bottom-left-radius', 'border-bottom-right-radius', 'border-top-left-radius', 'border-top-right-radius', 'border-radius', 'bottom', 'top', 'left', 'right', 'font-size', 'height', 'width', 'min-height', 'min-width', 'max-height', 'max-width', 'margin-left', 'margin-right', 'margin-top', 'margin-bottom', 'margin', 'padding-left', 'padding-right', 'padding-top', 'padding-bottom', 'padding', 'outline-width' ];

/**
 * Get styles from object.
 *
 * @param {object} data - styles data.
 * @param {string} selector - current styles selector (useful for nested styles).
 * @param {boolean} escape - escape strings to save in database.
 * @return {string} - ready to use styles string.
 */
const getStyles = ( data = {}, selector = '', escape = true ) => {
    const result = {};
    let resultCSS = '';

    // add styles.
    Object.keys( data ).map( ( key ) => {
        // object values.
        if ( data[ key ] !== null && typeof data[ key ] === 'object' ) {
            // media for different screens
            if ( /^media_/.test( key ) ) {
                resultCSS += ( resultCSS ? ' ' : '' ) + `@media #{ghostkitvar:${ key }} { ${ getStyles( data[ key ], selector, escape ) } }`;

            // @supports css
            } else if ( /^@supports/.test( key ) ) {
                resultCSS += ( resultCSS ? ' ' : '' ) + `${ key } { ${ getStyles( data[ key ], selector, escape ) } }`;

            // nested selectors.
            } else {
                let nestedSelector = selector;
                if ( nestedSelector ) {
                    if ( key.indexOf( '&' ) !== -1 ) {
                        nestedSelector = key.replace( /&/g, nestedSelector );

                    // inside exported xml file all & symbols converted to \u0026
                    } else if ( key.indexOf( 'u0026' ) !== -1 ) {
                        nestedSelector = key.replace( /u0026/g, nestedSelector );
                    } else {
                        nestedSelector = `${ nestedSelector } ${ key }`;
                    }
                } else {
                    nestedSelector = key;
                }
                resultCSS += ( resultCSS ? ' ' : '' ) + getStyles( data[ key ], nestedSelector, escape );
            }

        // style properties and values.
        } else if ( typeof data[ key ] !== 'undefined' && data[ key ] !== false ) {
            // fix selector > and < usage.
            if ( escape ) {
                selector = selector.replace( />/g, '&gt;' );
                selector = selector.replace( /</g, '&lt;' );
            }

            // inside exported xml file all > symbols converted to \u003e
            // inside exported xml file all < symbols converted to \u003c
            if ( selector.indexOf( 'u003e' ) !== -1 ) {
                selector = selector.replace( /u003e/g, '&gt;' );
                selector = selector.replace( /u003c/g, '&lt;' );
            }

            if ( ! result[ selector ] ) {
                result[ selector ] = '';
            }
            const propName = camelCaseToDash( key );
            let propValue = data[ key ];

            // inside exported xml file all " symbols converted to \u0022
            if ( typeof propValue === 'string' && propValue.indexOf( 'u0022' ) !== -1 ) {
                propValue = propValue.replace( /u0022/g, '"' );
            }
            // inside exported xml file all ' symbols converted to \u0027
            if ( typeof propValue === 'string' && propValue.indexOf( 'u0027' ) !== -1 ) {
                propValue = propValue.replace( /u0027/g, '\'' );
            }

            const thereIsImportant = / !important$/.test( propValue );
            if ( thereIsImportant ) {
                propValue = propValue.replace( / !important$/, '' );
            }

            // add pixels.
            if (
                ( typeof propValue === 'number' && propValue !== 0 && cssPropsWithPixels.includes( propName ) ) ||
                ( typeof propValue === 'string' && /^[0-9.\-]*$/.test( propValue ) )
            ) {
                propValue += 'px';
            }

            if ( thereIsImportant ) {
                propValue += ' !important';
            }

            result[ selector ] += ` ${ propName }: ${ propValue };`;
        }
    } );

    // add styles to selectors.
    Object.keys( result ).map( ( key ) => {
        resultCSS = `${ key } {${ result[ key ] } }${ resultCSS ? ` ${ resultCSS }` : '' }`;
    } );

    return resultCSS;
};

/**
 * Get styles attribute.
 *
 * @param {object} data - styles data.
 * @return {string} - data attribute with styles.
 */
const getCustomStylesAttr = ( data = {} ) => {
    return {
        'data-ghostkit-styles': getStyles( data ),
    };
};

/**
 * Extend block attributes with styles.
 *
 * @param {Object} blockSettings Original block settings.
 * @param {String} name Original block name.
 *
 * @return {Object} Filtered block settings.
 */
function addAttribute( blockSettings, name ) {
    let allow = false;

    // prepare settings of block + deprecated blocks.
    const eachSettings = [ blockSettings ];
    if ( blockSettings.deprecated && blockSettings.deprecated.length ) {
        blockSettings.deprecated.forEach( ( item ) => {
            eachSettings.push( item );
        } );
    }

    eachSettings.forEach( ( settings ) => {
        allow = false;

        if ( settings && settings.attributes ) {
            if ( hasBlockSupport( settings, 'ghostkitStyles', false ) ) {
                allow = true;
            } else {
                allow = applyFilters(
                    'ghostkit.blocks.registerBlockType.allowCustomStyles',
                    false,
                    settings,
                    name
                );
            }
        }

        if ( allow ) {
            if ( ! settings.attributes.ghostkitStyles ) {
                settings.attributes.ghostkitStyles = {
                    type: 'object',
                    default: '',
                };

                // add to deprecated items.
                if ( settings.deprecated && settings.deprecated.length ) {
                    settings.deprecated.forEach( ( item, i ) => {
                        if ( settings.deprecated[ i ].attributes ) {
                            settings.deprecated[ i ].attributes.ghostkitStyles = settings.attributes.ghostkitStyles;
                        }
                    } );
                }
            }
            if ( ! settings.attributes.ghostkitClassname ) {
                settings.attributes.ghostkitClassname = {
                    type: 'string',
                    default: '',
                };

                // add to deprecated items.
                if ( settings.deprecated && settings.deprecated.length ) {
                    settings.deprecated.forEach( ( item, i ) => {
                        if ( settings.deprecated[ i ].attributes ) {
                            settings.deprecated[ i ].attributes.ghostkitClassname = settings.attributes.ghostkitClassname;
                        }
                    } );
                }
            }
            if ( ! settings.attributes.ghostkitId ) {
                settings.attributes.ghostkitId = {
                    type: 'string',
                    default: '',
                };

                // add to deprecated items.
                if ( settings.deprecated && settings.deprecated.length ) {
                    settings.deprecated.forEach( ( item, i ) => {
                        if ( settings.deprecated[ i ].attributes ) {
                            settings.deprecated[ i ].attributes.ghostkitId = settings.attributes.ghostkitId;
                        }
                    } );
                }
            }

            if ( blockSettings.supports && blockSettings.supports.ghostkitStylesCallback ) {
                settings.attributes.ghostkitStylesCallback = {
                    type: 'function',
                    default: blockSettings.supports.ghostkitStylesCallback,
                };

                // add to deprecated items.
                if ( settings.deprecated && settings.deprecated.length ) {
                    settings.deprecated.forEach( ( item, i ) => {
                        if ( settings.deprecated[ i ].attributes ) {
                            settings.deprecated[ i ].attributes.ghostkitStylesCallback = settings.attributes.ghostkitStylesCallback;
                        }
                    } );
                }
            }
            settings = applyFilters( 'ghostkit.blocks.registerBlockType.withCustomStyles', settings, name );
        }
    } );

    return blockSettings;
}

/**
 * Extend block attributes with styles after block transformation
 *
 * @param {Object} transformedBlock Original transformed block.
 * @param {Object} blocks           Blocks on which transform was applied.
 *
 * @return {Object} Modified transformed block, with layout preserved.
 */
function addAttributeTransform( transformedBlock, blocks ) {
    if (
        blocks &&
        blocks[ 0 ] &&
        blocks[ 0 ].clientId === transformedBlock.clientId &&
        blocks[ 0 ].attributes &&
        blocks[ 0 ].attributes.ghostkitStyles &&
        Object.keys( blocks[ 0 ].attributes.ghostkitStyles ).length
    ) {
        Object.keys( blocks[ 0 ].attributes ).forEach( ( attrName ) => {
            if ( /^ghostkit/.test( attrName ) ) {
                transformedBlock.attributes[ attrName ] = blocks[ 0 ].attributes[ attrName ];
            }
        } );
    }

    return transformedBlock;
}

/**
 * List of used IDs to prevent duplicates.
 *
 * @type {Object}
 */
const usedIds = {};

/**
 * Override the default edit UI to include a new block inspector control for
 * assigning the custom styles if needed.
 *
 * @param {function|Component} BlockEdit Original component.
 *
 * @return {string} Wrapped component.
 */
const withNewAttrs = createHigherOrderComponent( ( BlockEdit ) => {
    class newEdit extends Component {
        constructor() {
            super( ...arguments );

            this.onUpdate = this.onUpdate.bind( this );
            this.getGhostkitAtts = this.getGhostkitAtts.bind( this );
        }

        componentDidMount() {
            this.onUpdate();
        }
        componentDidUpdate() {
            this.onUpdate();
        }

        onUpdate() {
            const {
                setAttributes,
                attributes,
            } = this.props;

            const newAttrs = {};

            // prepare custom block styles.
            const blockCustomStyles = applyFilters(
                'ghostkit.blocks.customStyles',
                attributes.ghostkitStylesCallback ? attributes.ghostkitStylesCallback( attributes ) : {},
                this.props
            );

            if ( blockCustomStyles && Object.keys( blockCustomStyles ).length ) {
                const ghostkitAtts = this.getGhostkitAtts();

                if ( ghostkitAtts.ghostkitClassname ) {
                    let updateAttrs = false;

                    newAttrs.ghostkitStyles = {
                        [ `.${ attributes.ghostkitClassname }` ]: blockCustomStyles,
                    };

                    if ( ghostkitAtts.ghostkitClassname !== attributes.ghostkitClassname ) {
                        newAttrs.ghostkitClassname = ghostkitAtts.ghostkitClassname;
                        updateAttrs = true;
                    }
                    if ( ghostkitAtts.ghostkitId !== attributes.ghostkitId ) {
                        newAttrs.ghostkitId = ghostkitAtts.ghostkitId;
                        updateAttrs = true;
                    }

                    updateAttrs = updateAttrs || ! deepEqual( attributes.ghostkitStyles, newAttrs.ghostkitStyles );

                    if ( updateAttrs ) {
                        setAttributes( newAttrs );
                    }
                }
            } else if ( attributes.ghostkitStyles ) {
                if ( attributes.ghostkitId && typeof usedIds[ attributes.ghostkitId ] !== 'undefined' ) {
                    delete usedIds[ attributes.ghostkitId ];
                }

                setAttributes( {
                    ghostkitClassname: '',
                    ghostkitId: '',
                    ghostkitStyles: '',
                } );
            }
        }

        getGhostkitAtts() {
            const props = this.props;
            let result = false;

            if ( props.attributes.ghostkitId && props.attributes.ghostkitClassname ) {
                result = {
                    ghostkitId: props.attributes.ghostkitId,
                    ghostkitClassname: props.attributes.ghostkitClassname,
                };

                // add new ghostkit props.
            } else if ( props.clientId && props.attributes && typeof props.attributes.ghostkitId !== 'undefined' ) {
                let ID = props.attributes.ghostkitId || '';

                // check if ID already exist.
                let tryCount = 10;
                while ( ! ID || ( typeof usedIds[ ID ] !== 'undefined' && usedIds[ ID ] !== props.clientId && tryCount > 0 ) ) {
                    ID = shorthash.unique( props.clientId );
                    tryCount--;
                }

                if ( ID && typeof usedIds[ ID ] === 'undefined' ) {
                    usedIds[ ID ] = props.clientId;
                }

                if ( ID !== props.attributes.ghostkitId ) {
                    result = {
                        ghostkitId: ID,
                        ghostkitClassname: props.name.replace( '/', '-' ) + '-' + ID,
                    };
                }
            }

            return result;
        }

        render() {
            const {
                attributes,
            } = this.props;

            if ( attributes.ghostkitClassname && attributes.ghostkitStyles && Object.keys( attributes.ghostkitStyles ).length !== 0 ) {
                return (
                    <Fragment>
                        <BlockEdit { ...this.props } />
                        <style>{ window.GHOSTKIT.replaceVars( getStyles( attributes.ghostkitStyles, '', false ) ) }</style>
                    </Fragment>
                );
            }

            return <BlockEdit { ...this.props } />;
        }
    }
    return newEdit;
}, 'withNewAttrs' );

/**
 * Override props assigned to save component to inject custom styles.
 * This is only applied if the block's save result is an
 * element and not a markup string.
 *
 * @param {Object} extraProps Additional props applied to save element.
 * @param {Object} blockType  Block type.
 * @param {Object} attributes Current block attributes.
 *
 * @return {Object} Filtered props applied to save element.
 */
function addSaveProps( extraProps, blockType, attributes ) {
    const customStyles = attributes.ghostkitStyles ? Object.assign( {}, attributes.ghostkitStyles ) : false;

    if ( customStyles && Object.keys( customStyles ).length !== 0 ) {
        extraProps = Object.assign( extraProps || {}, getCustomStylesAttr( customStyles ) );

        if ( attributes.ghostkitClassname ) {
            extraProps.className = classnames( extraProps.className, attributes.ghostkitClassname );
        }
    }

    return extraProps;
}

// Init filters.
addFilter( 'blocks.registerBlockType', 'ghostkit/styles/additional-attributes', addAttribute );
addFilter( 'blocks.switchToBlockType.transformedBlock', 'ghostkit/styles/additional-attributes', addAttributeTransform );
addFilter( 'editor.BlockEdit', 'ghostkit/styles/additional-attributes', withNewAttrs );
addFilter( 'blocks.getSaveContent.extraProps', 'ghostkit/styles/save-props', addSaveProps );
