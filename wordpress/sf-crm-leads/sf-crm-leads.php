<?php
/**
 * Plugin Name: Squarefeets CRM Leads
 * Description: Sends every website enquiry and brochure download to the Squarefeets CRM as a lead. Works with the "squarefeets" theme's enquiry forms; does not change the theme, and the emails the theme sends keep working as before.
 * Version: 1.0.0
 * Requires PHP: 7.4
 *
 * Setup: activate the plugin, then open Settings > Squarefeets CRM and enter the CRM address and the secret
 * (the same value as the WEBSITE_LEAD_SECRET variable on the CRM's api service).
 *
 * How it works: the theme saves each enquiry as an "sf_enquiry" post and adds its property_id meta last. That is the moment this plugin
 * queues the enquiry. A background job posts it to the CRM; if the CRM is unreachable it retries (1, 2, 4, 8 minutes), then marks it
 * "failed". Failed ones can be re-sent from the settings page. The enquiry is always kept in WordPress too.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'SF_CRM_LEADS_MAX_TRIES', 5 );

/* ── Queue an enquiry once the theme has finished saving it ─────────────── */
add_action( 'added_post_meta', function ( $meta_id, $post_id, $meta_key ) {
	if ( 'property_id' !== $meta_key || 'sf_enquiry' !== get_post_type( $post_id ) ) {
		return;
	}
	if ( ! sf_crm_leads_configured() ) {
		return;
	}
	update_post_meta( $post_id, '_crm_status', 'pending' );
	update_post_meta( $post_id, '_crm_tries', 0 );
	wp_schedule_single_event( time(), 'sf_crm_leads_push', array( (int) $post_id ) );
	spawn_cron();
}, 10, 3 );

add_action( 'sf_crm_leads_push', 'sf_crm_leads_push' );

function sf_crm_leads_configured() {
	return '' !== trim( (string) get_option( 'sf_crm_leads_url', '' ) ) && '' !== (string) get_option( 'sf_crm_leads_secret', '' );
}

/* ── Build the payload from the saved enquiry ───────────────────────────── */
function sf_crm_leads_payload( $post_id ) {
	$post    = get_post( $post_id );
	$lines   = preg_split( '/\r\n|\r|\n/', (string) $post->post_content );
	$name    = '';
	$intent  = '';
	$message = array();
	$in_msg  = false;
	foreach ( $lines as $line ) {
		if ( 0 === strpos( $line, 'Name: ' ) && '' === $name ) {
			$name = trim( substr( $line, 6 ) );
		} elseif ( 0 === strpos( $line, 'Looking to: ' ) ) {
			$intent = trim( substr( $line, 12 ) );
		} elseif ( '' === trim( $line ) ) {
			$in_msg = true;
		} elseif ( $in_msg ) {
			$message[] = $line;
		}
	}
	$prop_id = absint( get_post_meta( $post_id, 'property_id', true ) );
	$brochure = false !== strpos( (string) $post->post_content, 'Downloaded the brochure' );

	return array(
		'kind'          => $brochure ? 'brochure' : 'enquiry',
		'site'          => (string) wp_parse_url( home_url(), PHP_URL_HOST ),
		'enquiryId'     => (string) $post_id,
		'name'          => $name,
		'phone'         => (string) get_post_meta( $post_id, 'phone', true ),
		'email'         => (string) get_post_meta( $post_id, 'email', true ),
		'intent'        => $intent,
		'message'       => trim( implode( "\n", $message ) ),
		'propertyTitle' => $prop_id ? get_the_title( $prop_id ) : '',
		'propertyUrl'   => $prop_id ? get_permalink( $prop_id ) : '',
		// Set by the sf-crm-sync plugin when the listing came from the CRM (for example "project:p1").
		'crmRef'        => $prop_id ? (string) get_post_meta( $prop_id, '_crm_ref', true ) : '',
	);
}

/* ── Send one enquiry; retry later when the CRM does not answer ─────────── */
function sf_crm_leads_push( $post_id ) {
	$post_id = (int) $post_id;
	if ( 'sf_enquiry' !== get_post_type( $post_id ) || 'sent' === get_post_meta( $post_id, '_crm_status', true ) ) {
		return;
	}
	$url = rtrim( trim( (string) get_option( 'sf_crm_leads_url', '' ) ), '/' ) . '/api/inbound/website-lead';
	$res = wp_remote_post( $url, array(
		'timeout' => 15,
		'headers' => array(
			'Content-Type'     => 'application/json',
			'X-Webhook-Secret' => (string) get_option( 'sf_crm_leads_secret', '' ),
		),
		'body'    => wp_json_encode( sf_crm_leads_payload( $post_id ) ),
	) );

	$error = '';
	if ( is_wp_error( $res ) ) {
		$error = $res->get_error_message();
	} else {
		$code = (int) wp_remote_retrieve_response_code( $res );
		$body = json_decode( wp_remote_retrieve_body( $res ), true );
		if ( 200 === $code && is_array( $body ) && ! empty( $body['id'] ) ) {
			update_post_meta( $post_id, '_crm_status', 'sent' );
			update_post_meta( $post_id, '_crm_lead_id', sanitize_text_field( $body['id'] ) );
			delete_post_meta( $post_id, '_crm_error' );
			return;
		}
		$error = 'CRM answered ' . $code . ( is_array( $body ) && ! empty( $body['message'] ) ? ': ' . ( is_array( $body['message'] ) ? implode( ', ', $body['message'] ) : $body['message'] ) : '' );
		// A wrong secret or bad data will not fix itself by retrying: stop at once.
		if ( in_array( $code, array( 400, 401, 503 ), true ) ) {
			update_post_meta( $post_id, '_crm_status', 'failed' );
			update_post_meta( $post_id, '_crm_error', sanitize_text_field( $error ) );
			return;
		}
	}

	$tries = (int) get_post_meta( $post_id, '_crm_tries', true ) + 1;
	update_post_meta( $post_id, '_crm_tries', $tries );
	update_post_meta( $post_id, '_crm_error', sanitize_text_field( $error ) );
	if ( $tries >= SF_CRM_LEADS_MAX_TRIES ) {
		update_post_meta( $post_id, '_crm_status', 'failed' );
		return;
	}
	update_post_meta( $post_id, '_crm_status', 'pending' );
	wp_schedule_single_event( time() + 60 * pow( 2, $tries - 1 ), 'sf_crm_leads_push', array( $post_id ) );
}

/* ── Settings page: Settings > Squarefeets CRM ──────────────────────────── */
add_action( 'admin_menu', function () {
	add_options_page( 'Squarefeets CRM', 'Squarefeets CRM', 'manage_options', 'sf-crm-leads', 'sf_crm_leads_page' );
} );

add_action( 'admin_init', function () {
	register_setting( 'sf_crm_leads', 'sf_crm_leads_url', array( 'sanitize_callback' => 'esc_url_raw' ) );
	register_setting( 'sf_crm_leads', 'sf_crm_leads_secret', array(
		'sanitize_callback' => function ( $v ) {
			$v = trim( (string) $v );
			// An empty box keeps the saved secret (the field is never shown back).
			return '' === $v ? (string) get_option( 'sf_crm_leads_secret', '' ) : $v;
		},
	) );
} );

function sf_crm_leads_page() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}
	$counts = array( 'pending' => 0, 'failed' => 0, 'sent' => 0 );
	$recent = get_posts( array( 'post_type' => 'sf_enquiry', 'post_status' => 'any', 'posts_per_page' => 20, 'meta_key' => '_crm_status', 'fields' => 'ids' ) );
	foreach ( $recent as $id ) {
		$s = get_post_meta( $id, '_crm_status', true );
		if ( isset( $counts[ $s ] ) ) {
			$counts[ $s ]++;
		}
	}
	?>
	<div class="wrap">
		<h1>Squarefeets CRM</h1>
		<?php if ( isset( $_GET['sf_retried'] ) ) : // phpcs:ignore ?>
			<div class="notice notice-success is-dismissible"><p>Tried again. See the list below.</p></div>
		<?php endif; ?>
		<form method="post" action="options.php">
			<?php settings_fields( 'sf_crm_leads' ); ?>
			<table class="form-table" role="presentation">
				<tr><th scope="row"><label for="sf_crm_leads_url">CRM address</label></th>
					<td><input type="url" id="sf_crm_leads_url" name="sf_crm_leads_url" class="regular-text" value="<?php echo esc_attr( get_option( 'sf_crm_leads_url', '' ) ); ?>" placeholder="https://squarefeetscrm-production.up.railway.app">
					<p class="description">The address you open the CRM at, without a path.</p></td></tr>
				<tr><th scope="row"><label for="sf_crm_leads_secret">Secret</label></th>
					<td><input type="password" id="sf_crm_leads_secret" name="sf_crm_leads_secret" class="regular-text" value="" autocomplete="new-password" placeholder="<?php echo get_option( 'sf_crm_leads_secret', '' ) ? '(saved — leave empty to keep)' : ''; ?>">
					<p class="description">Must match WEBSITE_LEAD_SECRET on the CRM's api service.</p></td></tr>
			</table>
			<?php submit_button( 'Save' ); ?>
		</form>

		<h2>Enquiries sent to the CRM</h2>
		<p><?php echo (int) $counts['sent']; ?> sent, <?php echo (int) $counts['pending']; ?> waiting, <?php echo (int) $counts['failed']; ?> failed (latest 20).</p>
		<table class="widefat striped" style="max-width:900px">
			<thead><tr><th>Enquiry</th><th>Status</th><th>CRM lead</th><th>Note</th></tr></thead>
			<tbody>
			<?php foreach ( $recent as $id ) : ?>
				<tr>
					<td><?php echo esc_html( get_the_title( $id ) ); ?></td>
					<td><?php echo esc_html( get_post_meta( $id, '_crm_status', true ) ); ?></td>
					<td><?php echo esc_html( get_post_meta( $id, '_crm_lead_id', true ) ); ?></td>
					<td><?php echo esc_html( get_post_meta( $id, '_crm_error', true ) ); ?></td>
				</tr>
			<?php endforeach; ?>
			<?php if ( ! $recent ) : ?><tr><td colspan="4">Nothing sent yet.</td></tr><?php endif; ?>
			</tbody>
		</table>
		<?php if ( $counts['failed'] || $counts['pending'] ) : ?>
			<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" style="margin-top:12px">
				<input type="hidden" name="action" value="sf_crm_leads_retry">
				<?php wp_nonce_field( 'sf_crm_leads_retry' ); ?>
				<?php submit_button( 'Send waiting and failed ones again', 'secondary', 'submit', false ); ?>
			</form>
		<?php endif; ?>
	</div>
	<?php
}

add_action( 'admin_post_sf_crm_leads_retry', function () {
	if ( ! current_user_can( 'manage_options' ) ) {
		wp_die( 'You do not have permission to do this.', 403 );
	}
	check_admin_referer( 'sf_crm_leads_retry' );
	$ids = get_posts( array(
		'post_type'      => 'sf_enquiry',
		'post_status'    => 'any',
		'posts_per_page' => 20,
		'fields'         => 'ids',
		'meta_query'     => array( array( 'key' => '_crm_status', 'value' => array( 'pending', 'failed' ), 'compare' => 'IN' ) ),
	) );
	foreach ( $ids as $id ) {
		update_post_meta( $id, '_crm_tries', 0 );
		sf_crm_leads_push( $id );
	}
	wp_safe_redirect( add_query_arg( 'sf_retried', '1', admin_url( 'options-general.php?page=sf-crm-leads' ) ) );
	exit;
} );
