const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  console.log('Navigating to http://localhost:8000...');
  await page.goto('http://localhost:8000', { waitUntil: 'networkidle0' });
  
  console.log('Waiting 10 seconds for JSON to load and page to render...');
  await page.waitForTimeout(10000);
  
  console.log('Taking screenshot...');
  await page.screenshot({ path: 'screenshot_full.png', fullPage: true });
  
  console.log('Extracting page information...');
  
  const pageInfo = await page.evaluate(() => {
    const results = {};
    
    // 1. Check title
    const titleElement = document.querySelector('.hero-title h1');
    results.titleText = titleElement ? titleElement.innerText : 'NOT FOUND';
    results.titleExists = !!titleElement;
    
    // 2. Check sphere
    const spherePlot = document.querySelector('#sphere-plot');
    results.sphereExists = !!spherePlot;
    results.sphereVisible = spherePlot ? window.getComputedStyle(spherePlot).display !== 'none' : false;
    
    // 3. Check legend
    const legend = document.querySelector('.sphere-legend');
    results.legendExists = !!legend;
    results.legendText = legend ? legend.innerText : 'NOT FOUND';
    
    // 4. Check slider
    const slider = document.querySelector('.sphere-slider');
    results.sliderExists = !!slider;
    results.sliderText = slider ? slider.innerText : 'NOT FOUND';
    
    // 5. Check methodology section
    const methodology = document.querySelector('.methodology');
    results.methodologyExists = !!methodology;
    results.methodologyVisible = methodology ? window.getComputedStyle(methodology).display !== 'none' : false;
    
    // 6. Check module cards
    const moduleCards = document.querySelectorAll('.module-card');
    results.moduleCardCount = moduleCards.length;
    
    // 7. Get all rendered colors on canvas (approximate check)
    const plotly = document.querySelector('#sphere-plot');
    results.plotlyDataExists = plotly && plotly._fullData ? plotly._fullData.length : 0;
    
    // Check for overlapping elements
    const hero = document.querySelector('.hero-title');
    const sphere = document.querySelector('.sphere-section');
    if (hero && sphere) {
      const heroRect = hero.getBoundingClientRect();
      const sphereRect = sphere.getBoundingClientRect();
      results.titleOverlapsSphere = heroRect.bottom > sphereRect.top + 50; // Some margin
    }
    
    return results;
  });
  
  console.log('\n=== PAGE ANALYSIS ===\n');
  console.log(JSON.stringify(pageInfo, null, 2));
  
  // Save to JSON file
  fs.writeFileSync('page_info.json', JSON.stringify(pageInfo, null, 2));
  
  console.log('\n✓ Screenshot saved to screenshot_full.png');
  console.log('✓ Page info saved to page_info.json');
  
  await browser.close();
})();
