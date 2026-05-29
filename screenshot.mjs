import puppeteer from 'puppeteer';
import { mkdir } from 'fs/promises';

async function takeScreenshots() {
  await mkdir('public/screenshots', { recursive: true });
  console.log('Taking screenshots...');
  
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const url = 'http://127.0.0.1:3000';
  
  try {
    // Go to main page, wait for network idle
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 10000 });
    await page.waitForTimeout(1000); // give it a moment to render charts
    await page.screenshot({ path: 'public/screenshots/dashboard.jpg', type: 'jpeg', quality: 70 });
    console.log('Saved dashboard.jpg');
    
    // Set a flag to mock auth
    await page.evaluate(() => {
      localStorage.setItem('isAuthenticated', 'true');
      localStorage.setItem('userRole', 'ADMIN');
    });
    // refresh
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 10000 });
    await page.waitForTimeout(1000);

    // Click Clientes
    await page.goto(url + '/clientes', { waitUntil: 'networkidle2', timeout: 10000 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'public/screenshots/clientes.jpg', type: 'jpeg', quality: 70 });
    console.log('Saved clientes.jpg');
    
    // Click Finanzas
    await page.goto(url + '/finanzas', { waitUntil: 'networkidle2', timeout: 10000 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'public/screenshots/finanzas.jpg', type: 'jpeg', quality: 70 });
    console.log('Saved finanzas.jpg');
    
    // Click Reuniones
    await page.goto(url + '/reuniones', { waitUntil: 'networkidle2', timeout: 10000 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'public/screenshots/reuniones.jpg', type: 'jpeg', quality: 70 });
    console.log('Saved reuniones.jpg');
  } catch (error) {
    console.error('Error during screenshot capture:', error);
  } finally {
    await browser.close();
    console.log('Screenshots complete.');
  }
}

takeScreenshots().catch(console.error);
