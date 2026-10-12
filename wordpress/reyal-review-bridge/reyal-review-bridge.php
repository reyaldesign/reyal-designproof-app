<?php
/**
 * Plugin Name: Reyal Review Bridge
 * Description: Lets Reyal Design Studio show this site inside a client review and take pinned comments on it. It does nothing for normal visitors.
 * Version: 0.1.0
 * Author: Reyal Design
 * License: GPL-2.0-or-later
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * The address of the review app. Change it by defining REYAL_REVIEW_ORIGIN in wp-config.php,
 * or with the reyal_review_origin filter.
 */
function reyal_review_origin() {
	$origin = defined( 'REYAL_REVIEW_ORIGIN' ) ? REYAL_REVIEW_ORIGIN : 'https://client.reyaldesign.com';
	return untrailingslashit( apply_filters( 'reyal_review_origin', $origin ) );
}

/**
 * Allow the review page, and only the review page, to show this site in a frame.
 * Security plugins and some hosts send X-Frame-Options, which would block it.
 * If a stricter frame-ancestors policy still blocks the page, relax it for the review address in that plugin's settings.
 */
add_action(
	'send_headers',
	function () {
		if ( is_admin() ) {
			return;
		}
		header_remove( 'X-Frame-Options' );
		header( "Content-Security-Policy: frame-ancestors 'self' " . reyal_review_origin(), false );
	},
	20
);

/**
 * Load the bridge script, but only when this page is inside a frame. A visitor who opens the site normally
 * downloads nothing extra and runs nothing. The script itself only talks to the review address.
 */
add_action(
	'wp_footer',
	function () {
		if ( is_admin() || is_customize_preview() || isset( $_GET['elementor-preview'] ) ) {
			return;
		}
		$src = reyal_review_origin() . '/bridge.js';
		echo '<script>if(window.parent!==window){var s=document.createElement("script");s.src=' . wp_json_encode( $src ) . ';document.head.appendChild(s);}</script>' . "\n"; // phpcs:ignore WordPress.Security.EscapeOutput
	},
	99
);
