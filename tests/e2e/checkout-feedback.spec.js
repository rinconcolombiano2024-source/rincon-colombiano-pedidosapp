const { test, expect } = require('@playwright/test');
const { installSupabaseMock } = require('./support/supabase-mock.cjs');

for (const lang of ['es', 'pl', 'en']) {
  test(`checkout ${lang}: failed submission is visible inside the dialog and preserves the cart`, async ({ page }) => {
    await installSupabaseMock(page);
    await page.goto(`/cliente.html?lang=${lang}`);
    await page.evaluate(() => {
      customerStoreId = 'fixture-store';
      customerUser = null;
      customerSelectedRestaurant = () => ({ operationalOpen: true });
      customerValidateOrderData = () => true;
      customerCart = [{ id: 'dish', productId: 'dish', name: 'Arepa', qty: 1, price: 10, note: 'Sin queso' }];
      customerElements.nameInput.value = 'Test';
      customerElements.orderType.value = 'Recoger en el punto';
      customerCreateCustomerOrder = async () => { throw new Error('NETWORK_FAILURE'); };
      customerRenderCart();
      customerOpenHeaderCart();
    });
    await page.locator('#sendCustomerOrderButton').click();
    const status = page.locator('#customerCartSheet #customerCheckoutStatus');
    await expect(status).toHaveAttribute('role', 'alert');
    await expect(status).toHaveText(await page.evaluate(() => customerT('sendOrderError')));
    await expect(status).toBeInViewport();
    await expect(page.locator('#sendCustomerOrderButton')).toBeEnabled();
    expect(await page.evaluate(() => customerCart[0].note)).toBe('Sin queso');
    await page.evaluate(() => customerSetStatus('Sending', ''));
    await expect(status).toBeHidden();
    await page.evaluate(() => customerSetStatus('<img src=x onerror=alert(1)>', 'error'));
    await expect(status).toHaveText('<img src=x onerror=alert(1)>');
    await expect(status.locator('img')).toHaveCount(0);
  });
}
