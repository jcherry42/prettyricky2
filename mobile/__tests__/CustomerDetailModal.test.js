/**
 * CustomerDetailModal — Hook stability test
 *
 * This test reproduces the exact scenario from the error report:
 *   1. Render with customer=null (modal hidden)
 *   2. Re-render with a real customer object (modal shown)
 *   3. Re-render back to customer=null
 *
 * If hooks are unstable between these renders, React will throw:
 *   "Rendered more hooks than during the previous render."
 */
import React from 'react';
import { render, act } from '@testing-library/react-native';

// Provide the AppSettingsContext value
jest.mock('../src/context/AppSettingsContext', () => ({
  useAppSettings: () => ({
    settings: {
      defaultTargetLanguage: 'es',
      sportMode: false,
    },
  }),
}));

import { CustomerDetailModal } from '../src/components/CustomerDetailModal';

const mockCustomer = {
  id: 'test-123',
  first_name: 'Michael',
  last_name: 'Chen',
  phone: '555-0100',
  email: 'michael@test.com',
  address: '123 Main St',
  lead_status: 'new',
  created_at: '2026-01-15T10:00:00Z',
};

const noop = () => {};

describe('CustomerDetailModal — Hook stability', () => {
  it('renders without hook errors when customer is null', () => {
    // This is the "previous render" scenario from the bug report
    const { toJSON } = render(
      <CustomerDetailModal
        visible={false}
        customer={null}
        onClose={noop}
        onEdit={noop}
        onDelete={noop}
      />
    );
    // Should return null (no modal rendered)
    expect(toJSON()).toBeNull();
    console.log('✅ PASS: customer=null renders without hook error');
  });

  it('renders without hook errors when customer is provided', () => {
    const { getByText } = render(
      <CustomerDetailModal
        visible={true}
        customer={mockCustomer}
        onClose={noop}
        onEdit={noop}
        onDelete={noop}
      />
    );
    expect(getByText('Michael Chen')).toBeTruthy();
    console.log('✅ PASS: customer provided renders without hook error');
  });

  it('survives the null → customer → null transition (the exact crash scenario)', () => {
    // This is the EXACT sequence that triggered the original error:
    // Render 1: customer=null (4 hooks, returns null)
    // Render 2: customer=object (hooks must be same count!)
    // Render 3: customer=null again

    const { rerender, toJSON, getByText } = render(
      <CustomerDetailModal
        visible={false}
        customer={null}
        onClose={noop}
        onEdit={noop}
        onDelete={noop}
      />
    );
    expect(toJSON()).toBeNull();
    console.log('  Step 1: customer=null → null output ✓');

    // Transition to showing customer — this is where the crash happened
    rerender(
      <CustomerDetailModal
        visible={true}
        customer={mockCustomer}
        onClose={noop}
        onEdit={noop}
        onDelete={noop}
      />
    );
    expect(getByText('Michael Chen')).toBeTruthy();
    console.log('  Step 2: customer=object → renders modal ✓');

    // Transition back to null
    rerender(
      <CustomerDetailModal
        visible={false}
        customer={null}
        onClose={noop}
        onEdit={noop}
        onDelete={noop}
      />
    );
    expect(toJSON()).toBeNull();
    console.log('  Step 3: customer=null again → null output ✓');

    console.log('✅ PASS: Full null→customer→null cycle completed with ZERO hook errors');
  });

  it('handles rapid toggling without hook instability', () => {
    const { rerender, toJSON } = render(
      <CustomerDetailModal
        visible={false}
        customer={null}
        onClose={noop}
        onEdit={noop}
        onDelete={noop}
      />
    );

    // Rapid toggle 10 times
    for (let i = 0; i < 10; i++) {
      rerender(
        <CustomerDetailModal
          visible={true}
          customer={mockCustomer}
          onClose={noop}
          onEdit={noop}
          onDelete={noop}
        />
      );
      rerender(
        <CustomerDetailModal
          visible={false}
          customer={null}
          onClose={noop}
          onEdit={noop}
          onDelete={noop}
        />
      );
    }
    expect(toJSON()).toBeNull();
    console.log('✅ PASS: 20 rapid re-renders (10 toggles) with ZERO hook errors');
  });
});
