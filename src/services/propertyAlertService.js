/**
 * Property Alert Service for KEY TO KOCHI
 * Handles immediate notification of registered subscribers when a new property is published.
 */

/**
 * Triggers immediate property alert emails to all registered subscribers.
 * Only sends if the property is published.
 * Never sends duplicates for the same property to the same subscriber.
 * 
 * @param {Object} property The property object to notify about
 * @returns {Promise<{ success: boolean, sentCount?: number, failedCount?: number, message?: string, notConfigured?: boolean, skipped?: boolean, error?: string, requiredConfig?: object }>}
 */
export async function notifySubscribersOfNewProperty(property) {
  // 1. Strict validation: Never send notifications for drafts or unpublished properties
  if (!property || property.published === false) {
    return {
      success: false,
      skipped: true,
      reason: 'Property is saved as draft or unpublished. Alerts are only sent for published listings.'
    };
  }

  // Ensure property has minimum required info
  if (!property.id || !property.title) {
    return {
      success: false,
      skipped: true,
      reason: 'Property is missing required ID or title.'
    };
  }

  try {
    const baseUrl = (typeof window !== 'undefined' && window.location && window.location.origin)
      ? window.location.origin
      : 'http://localhost:5173';

    const response = await fetch(`${baseUrl}/api/alerts/notify-subscribers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        property: {
          id: property.id,
          title: property.title,
          type: property.type || 'Apartment',
          bhk: property.bhk || '2 BHK',
          rent: Number(property.rent) || 0,
          deposit: Number(property.deposit) || 0,
          location: property.location || 'Kochi',
          address: property.address || '',
          furnishing: property.furnishing || 'Furnished',
          size: property.size || 0,
          bedrooms: property.bedrooms || 1,
          bathrooms: property.bathrooms || 1,
          facilities: property.facilities || [],
          description: property.description || '',
          images: property.images || [],
          published: property.published !== false
        },
        baseUrl
      })
    });

    const data = await response.json().catch(() => ({}));

    if (response.ok && data.ok) {
      return {
        success: true,
        sentCount: data.sentCount || 0,
        failedCount: data.failedCount || 0,
        skippedCount: data.skippedCount || 0,
        message: data.message || 'Alerts processed successfully.'
      };
    } else if (data.notConfigured) {
      return {
        success: false,
        notConfigured: true,
        error: data.error || 'SMTP email service is not configured.',
        requiredConfig: data.requiredConfig
      };
    } else {
      return {
        success: false,
        sentCount: data.sentCount || 0,
        failedCount: data.failedCount || 0,
        error: data.error || 'Failed to dispatch subscriber alerts.',
        errors: data.errors || []
      };
    }
  } catch (err) {
    console.error('[PropertyAlertService] Network failure:', err);
    return {
      success: false,
      error: `Unable to connect to property alerts service: ${err.message}`
    };
  }
}
