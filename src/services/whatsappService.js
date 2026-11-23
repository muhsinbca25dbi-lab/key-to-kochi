export const PRODUCTION_DOMAIN = 'https://keytokochi.netlify.app';
export const WHATSAPP_PHONE = '919656959652';

/**
 * Returns the canonical live production URL for a specific property.
 * Always returns https://keytokochi.netlify.app/#prop-xxx
 * Never returns localhost URLs.
 *
 * @param {string|number} propertyId
 * @returns {string}
 */
export function getPropertyLiveUrl(propertyId) {
  if (!propertyId) return PRODUCTION_DOMAIN;
  const rawId = String(propertyId).trim();
  const id = rawId.startsWith('prop-') ? rawId : `prop-${rawId}`;
  return `${PRODUCTION_DOMAIN}/#${id}`;
}

/**
 * Generates the fully-formatted, properly URL-encoded WhatsApp enquiry URL
 * for an individual property according to the required specification:
 *
 * Hello, I am interested in this property on Key to Kochi.
 *
 * Property: [Property Title]
 * Property Link: [Direct Live Property URL]
 *
 * Please share more details.
 *
 * @param {Object} property - Property object with at least { id, title }
 * @returns {string} Fully formatted wa.me URL
 */
export function getPropertyWhatsAppUrl(property) {
  if (!property) {
    return `https://wa.me/${WHATSAPP_PHONE}`;
  }

  const title = property.title || 'Property';
  const liveUrl = getPropertyLiveUrl(property.id);

  const message = [
    'Hello, I am interested in this property on Key to Kochi.',
    '',
    `Property: ${title}`,
    `Property Link: ${liveUrl}`,
    '',
    'Please share more details.'
  ].join('\n');

  return `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(message)}`;
}

