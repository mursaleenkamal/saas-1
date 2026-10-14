import os
from playwright.sync_api import sync_playwright

html_path = os.path.abspath(r'D:\GymFlow-Gym-Management-SaaS-Platform\docs\GymFlow_Complete_Product_Catalog.html')
pdf_path = os.path.abspath(r'D:\GymFlow-Gym-Management-SaaS-Platform\docs\GymFlow_Complete_Product_Catalog.pdf')
preview_dir = os.path.abspath(r'D:\GymFlow-Gym-Management-SaaS-Platform\docs\previews')
os.makedirs(preview_dir, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto('file:///' + html_path.replace('\\', '/'), wait_until='networkidle')
    
    # Generate high quality PDF with exact print background colors
    page.pdf(
        path=pdf_path,
        format='A4',
        print_background=True,
        margin={'top': '8mm', 'bottom': '8mm', 'left': '8mm', 'right': '8mm'}
    )
    print(f"PDF generated: {pdf_path} (Size: {os.path.getsize(pdf_path)} bytes)")
    
    pricing = page.locator('.pricing-grid')
    if pricing.count() > 0:
        pricing.first.screenshot(path=os.path.join(preview_dir, 'pricing_grid.png'))
    
    pain_solution = page.locator('.pain-solution-grid')
    if pain_solution.count() > 0:
        pain_solution.first.screenshot(path=os.path.join(preview_dir, 'pain_solution.png'))

    browser.close()

print("Verification complete!")
