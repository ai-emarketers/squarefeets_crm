<?php
/**
 * Plugin Name: Squarefeets CRM Sync
 * Description: Lets the Squarefeets CRM create, update and unpublish property listings on this site. Works with the "squarefeets" theme's property post type and writes the same fields as the /manage/ portal.
 * Version: 1.0.0
 * Requires PHP: 7.4
 *
 * Routes (POST, signed in with a WordPress Application Password for a user who can edit others' posts):
 *   /wp-json/sf-crm/v1/listing          create or update a listing from the CRM payload
 *   /wp-json/sf-crm/v1/listing/status   { postId, status: publish|draft }
 * Media files are uploaded by the CRM through the normal /wp/v2/media route; this plugin only receives their ids.
 * Nothing here touches the theme, so installing it does not change the live (coming-soon) site or the unpublished draft theme.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

add_action( 'rest_api_init', function () {
	$can = function () {
		return current_user_can( 'edit_others_posts' ) && current_user_can( 'upload_files' );
	};
	register_rest_route( 'sf-crm/v1', '/listing', array(
		'methods'             => 'POST',
		'callback'            => 'sf_crm_save_listing',
		'permission_callback' => $can,
	) );
	register_rest_route( 'sf-crm/v1', '/listing/status', array(
		'methods'             => 'POST',
		'callback'            => 'sf_crm_set_status',
		'permission_callback' => $can,
	) );
} );

/** Keeps only image attachments that exist, in order, without duplicates. */
function sf_crm_image_ids( $ids ) {
	$out = array();
	foreach ( (array) $ids as $id ) {
		$id = absint( $id );
		if ( $id && wp_attachment_is_image( $id ) && ! in_array( $id, $out, true ) ) {
			$out[] = $id;
		}
	}
	return $out;
}

/** Finds the post for a CRM reference (e.g. "project:p1"), or 0. */
function sf_crm_find_post( $ref, $post_id ) {
	$post_id = absint( $post_id );
	if ( $post_id && 'property' === get_post_type( $post_id ) ) {
		return $post_id;
	}
	$found = get_posts( array(
		'post_type'      => 'property',
		'post_status'    => 'any',
		'meta_key'       => '_crm_ref',
		'meta_value'     => $ref,
		'posts_per_page' => 1,
		'fields'         => 'ids',
	) );
	return $found ? (int) $found[0] : 0;
}

/** Rows for a repeater field: only the allowed keys, plain text. */
function sf_crm_rows( $rows, $keys ) {
	$out = array();
	foreach ( (array) $rows as $r ) {
		if ( ! is_array( $r ) ) {
			continue;
		}
		$row = array();
		foreach ( $keys as $k ) {
			$row[ $k ] = isset( $r[ $k ] ) ? sanitize_textarea_field( (string) $r[ $k ] ) : '';
		}
		if ( array_filter( $row ) ) {
			$out[] = $row;
		}
	}
	return $out;
}

function sf_crm_save_listing( WP_REST_Request $req ) {
	$d   = $req->get_json_params();
	$ref = isset( $d['crmRef'] ) ? sanitize_text_field( $d['crmRef'] ) : '';
	if ( '' === $ref || empty( $d['title'] ) ) {
		return new WP_Error( 'sf_crm_bad', 'crmRef and title are required.', array( 'status' => 400 ) );
	}
	$id     = sf_crm_find_post( $ref, $d['postId'] ?? 0 );
	$status = ( isset( $d['status'] ) && 'publish' === $d['status'] ) ? 'publish' : 'draft';
	$post   = array(
		'post_type'    => 'property',
		'post_title'   => sanitize_text_field( $d['title'] ),
		'post_content' => wp_kses_post( $d['content'] ?? '' ),
		'post_excerpt' => sanitize_textarea_field( $d['excerpt'] ?? '' ),
		'post_status'  => $status,
	);
	if ( $id ) {
		$post['ID'] = $id;
		$id         = wp_update_post( $post, true );
	} else {
		$id = wp_insert_post( $post, true );
	}
	if ( is_wp_error( $id ) || ! $id ) {
		return new WP_Error( 'sf_crm_save', 'Could not save the listing.', array( 'status' => 500 ) );
	}
	update_post_meta( $id, '_crm_ref', $ref );

	// Taxonomies (same terms the portal uses).
	$listing = ( isset( $d['listing'] ) && 'for-rent' === $d['listing'] ) ? 'for-rent' : 'for-sale';
	wp_set_object_terms( $id, $listing, 'property_status' );
	$ptype = sanitize_text_field( $d['propertyType'] ?? '' );
	if ( $ptype ) {
		$term = term_exists( sanitize_title( $ptype ), 'property_type' );
		if ( ! $term ) {
			$term = wp_insert_term( $ptype, 'property_type' );
		}
		if ( ! is_wp_error( $term ) ) {
			wp_set_object_terms( $id, array( (int) ( is_array( $term ) ? $term['term_id'] : $term ) ), 'property_type' );
		}
	}
	$loc = sanitize_text_field( $d['locality'] ?? '' );
	wp_set_object_terms( $id, $loc ? array( $loc ) : array(), 'locality' );

	// Simple meta: only the keys the theme knows.
	$allowed = array( 'price', 'price_label', 'price_note', 'featured', 'address', 'pin_code', 'area_sqft', 'beds', 'baths', 'bhk_config', 'towers', 'towers_note', 'developer', 'possession', 'latitude', 'longitude', 'virtual_tour', 'strengths', 'considerations', 'best_for', 'sf_score' );
	$meta    = isset( $d['meta'] ) && is_array( $d['meta'] ) ? $d['meta'] : array();
	foreach ( $allowed as $k ) {
		$v = isset( $meta[ $k ] ) ? (string) $meta[ $k ] : '';
		if ( 'virtual_tour' === $k ) {
			$v = esc_url_raw( $v );
		} elseif ( 'strengths' === $k || 'considerations' === $k ) {
			$v = sanitize_textarea_field( $v );
		} elseif ( 'price' === $k || 'sf_score' === $k ) {
			$v = preg_replace( '/[^0-9.]/', '', $v );
		} elseif ( 'latitude' === $k || 'longitude' === $k ) {
			$v = preg_replace( '/[^0-9.\-]/', '', $v );
		} else {
			$v = sanitize_text_field( $v );
		}
		update_post_meta( $id, $k, $v );
	}

	update_post_meta( $id, 'amenities', implode( "\n", array_filter( array_map( 'sanitize_text_field', (array) ( $d['amenities'] ?? array() ) ) ) ) );
	update_post_meta( $id, 'configurations', sf_crm_rows( $d['configurations'] ?? array(), array( 'label', 'variant', 'area', 'bed', 'bath', 'balc', 'price', 'psf', 'note' ) ) );
	update_post_meta( $id, 'nearby', sf_crm_rows( $d['nearby'] ?? array(), array( 'name', 'detail' ) ) );
	$reviews = array();
	foreach ( sf_crm_rows( $d['reviews'] ?? array(), array( 'name', 'rating', 'text' ) ) as $r ) {
		$r['rating'] = max( 1, min( 5, (int) $r['rating'] ) );
		$reviews[]   = $r;
	}
	update_post_meta( $id, 'reviews', $reviews );

	$plans = array();
	foreach ( (array) ( $d['floorPlans'] ?? array() ) as $p ) {
		$img = absint( $p['image'] ?? 0 );
		if ( $img && wp_attachment_is_image( $img ) ) {
			$plans[] = array( 'label' => sanitize_text_field( $p['label'] ?? '' ), 'variant' => sanitize_text_field( $p['variant'] ?? '' ), 'image' => $img );
		}
	}
	update_post_meta( $id, 'floor_plans', $plans );

	// Photos: first = cover, the rest = gallery. With none sent, existing photos are left alone.
	$photos = sf_crm_image_ids( $d['photos'] ?? array() );
	if ( $photos ) {
		set_post_thumbnail( $id, $photos[0] );
		update_post_meta( $id, 'gallery', array_slice( $photos, 1 ) );
		foreach ( $photos as $pid ) {
			if ( ! wp_get_post_parent_id( $pid ) ) {
				wp_update_post( array( 'ID' => $pid, 'post_parent' => $id ) );
			}
		}
	}

	$brochure = absint( $d['brochureId'] ?? 0 );
	if ( $brochure && 'application/pdf' === get_post_mime_type( $brochure ) ) {
		update_post_meta( $id, 'brochure', wp_get_attachment_url( $brochure ) );
		update_post_meta( $id, 'brochure_id', $brochure );
	}

	return array( 'postId' => (int) $id, 'url' => get_permalink( $id ), 'status' => get_post_status( $id ) );
}

function sf_crm_set_status( WP_REST_Request $req ) {
	$id = absint( $req->get_param( 'postId' ) );
	if ( ! $id || 'property' !== get_post_type( $id ) ) {
		return new WP_Error( 'sf_crm_bad', 'Unknown listing.', array( 'status' => 404 ) );
	}
	$status = 'publish' === $req->get_param( 'status' ) ? 'publish' : 'draft';
	wp_update_post( array( 'ID' => $id, 'post_status' => $status ) );
	return array( 'postId' => $id, 'status' => get_post_status( $id ) );
}
