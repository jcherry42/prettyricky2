import { apiFetch } from './api';

// Create a backend customer from a local DL/Bluetooth entry.
// Entry shape (from DlScanScreen / CustomerListModal):
// { fullName, address, dlNumber, expiration, licenseImageBase64?, source?, savedAt? }
export async function createCustomerFromLocalEntry(entry, options = {}) {
  if (!entry) return null;

  const fullName = (entry.fullName || '').trim();
  const parts = fullName.split(/\s+/).filter(Boolean);
  const firstName = options.firstName || (parts[0] || '');
  const lastName = options.lastName || (parts.slice(1).join(' ') || '');

  const payload = {
    firstName,
    lastName,
    name: fullName || undefined,
    address: entry.address || undefined,
    source: entry.source || 'license_scan',
  };

  if (entry.licenseImageBase64) {
    payload.license_image = entry.licenseImageBase64;
  }

  try {
    const created = await apiFetch('/api/customers', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    // Legacy endpoint returns the created doc directly with top-level id
    if (created && created.id) {
      return created;
    }
    // Fallback for other shapes
    if (created && created.customer && created.customer.id) {
      return created.customer;
    }
    return null;
  } catch (e) {
    // Do not block local flows if backend customer creation fails
    return null;
  }
}
