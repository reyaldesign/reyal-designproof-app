// Starter content for the two shared lists, from "Reyal AI Reviewer: Website and Food Menu Criteria" (version 2, October 21, 2026).
// Criteria are graded pass, warn or fail. Anything that cannot be graded that way is in `reference`: guidance the AI reads with every review.
import type { Kind } from './aiShared';

export type Starter = { base: string[]; types: { name: string; criteria: string[] }[]; reference: string };

const WEBSITE: Starter = {
  base: [
    'No spelling, grammar, or typo errors on any page, including buttons, footer, and image captions',
    'Punctuation is consistent: one style of quotes, no double spaces, and no em dashes if the client\'s voice avoids them',
    'Nav and UX: Main menu has 7 or fewer top-level items, labeled in plain words a customer would use',
    'Nav and UX: Logo is in the same place on every page and links to the home page',
    'Nav and UX: The primary action is visible above the fold on desktop and on mobile without scrolling',
    'Nav and UX: Every page ends with a next step (call, book, contact, or a related page) and none ends in a dead end',
    'Nav and UX: Buttons, links, and cards look clickable and are styled the same way on every page',
    'Nav and UX: Menu labels match the page names and H1s they lead to',
    'Nav and UX: Link text describes the destination; no "click here" or "read more" alone',
    'Nav and UX: Current page is marked in the menu',
    'Nav and UX: Phone number is designed as tap to call on mobile and the address links to a map',
    'Nav and UX: Pages exist for every item in the menu, including footer links, 404, and thank-you states',
    'Mobile: A mobile layout is provided for at least the home page, the main service or menu page, and contact',
    'Mobile: No horizontal scroll and no content cut off at mobile width',
    'Mobile: Body text on mobile is at least 16px',
    'Mobile: Tap targets are at least 44px tall and have space between them',
    'Mobile: The menu collapses to a clear icon and a call or book button stays reachable',
    'Mobile: Columns and images restack in a logical reading order on mobile',
    'Mobile: Images keep the subject in frame when cropped for mobile',
    'CTA: One primary action per page, repeated near the top, middle, and end',
    'CTA: The primary button uses one contrasting brand color across the whole site',
    'CTA: Button text says what happens ("Book a Table", "Get a Free Quote"), never "Submit"',
    'CTA: Contact forms ask only for what is needed, with visible labels (not placeholder text only)',
    'CTA: Required fields are marked and error and success states are designed',
    'CTA: Phone, email, and hours are visible in the header or footer on every page',
    'CTA: Proof (reviews, credentials, logos, awards) sits near the main CTA',
    'SEO: Exactly one H1 per page and it contains the main service or topic in natural words',
    'SEO: Handoff Notes list a title tag and meta description for every page',
    'SEO: Title tags are about 60 characters or less and meta descriptions about 155 or less',
    'SEO: Headings and key copy are real text, not baked into images',
    'SEO: City or service area and main service appear in visible copy, not only in images or logos',
    'SEO: Each main service has its own page instead of one catch-all page',
    'SEO: URL slugs are short, lowercase, readable, and listed in the notes',
    'SEO: Business name, address, and phone match the Google Business Profile exactly',
    'SEO: Alt text plan exists for key images',
    'SEO: Internal links between related pages are shown',
    'SEO: Page has enough real copy to be indexed, not just headlines and images',
    'Trust and legal: Privacy Policy and Terms are linked in the footer',
    'Trust and legal: Space is designed for a cookie or consent banner if the site uses tracking',
    'Trust and legal: Every claim (licensed, award winning, number one, years in business) is something the client confirmed',
    'Trust and legal: Testimonials and reviews are real, attributed, and approved by the client',
    'Trust and legal: Copyright year is current',
    'Trust and legal: Required licenses or registrations for the industry are shown in the footer or About page',
  ],
  types: [
    {
      name: 'Informational',
      criteria: [
        'People: Each professional has a bio with real photo, credentials, license or bar information, and years of experience',
        'People: Photos of the team match in lighting, crop, and background',
        'People: Education, certifications, and affiliations are readable and spelled correctly',
        'People: Office photos are of the real location',
        'Services: Every practice area or service has its own page and its own H1',
        'Services: Services are described in plain English, not jargon',
        'Services: Each service page ends with a consultation or appointment CTA',
        'Services: FAQ section appears on service pages where patients or clients usually ask questions',
        'Compliance (human review): A disclaimer area exists in the footer or page layout for the field (legal advertising disclaimer for law, "not medical advice" for medical)',
        'Compliance (human review): Any guarantee of outcomes, "best", "number one", or results language is flagged for client compliance review',
        'Compliance (human review): Testimonials or case results are flagged for compliance review because rules vary by state and by licensing board',
        'Compliance (human review): Forms that collect health or legal details have a privacy note and no sensitive details in field labels',
        'Practical info: Address, parking or access info, map, and office hours are on the contact page',
        'Practical info: Insurance accepted or fee information is shown where relevant',
        'Practical info: After hours or emergency instructions are shown where relevant',
        'Practical info: Appointment or consultation request is reachable in one click from every page',
      ],
    },
    {
      name: 'Restaurant',
      criteria: [
        'Core info: Hours, address, phone, and map are in the footer and on a contact page',
        'Core info: Order Online and Reservations buttons are visible above the fold when the client offers them',
        'Core info: Third party links (delivery apps, reservations) are shown only for services the client actually uses',
        'Core info: Multi-location clients have a page per location with that location\'s own hours, phone, and address',
        'Menu on the site: Menu is shown as live text, not only as an image or PDF',
        'Menu on the site: Every dish has a price and the prices match the current print menu',
        'Menu on the site: Dish names, spelling, and accents match the print menu exactly',
        'Menu on the site: Dietary icons (vegetarian, spicy, gluten free) have a legend and are used only where the client confirmed',
        'Menu on the site: If raw or undercooked items appear, the consumer advisory appears on the web menu too (confirm with client)',
        'Food and brand: Food photos are real, appetizing, and show the dish named',
        'Food and brand: Photo rules from the client profile are applied (example: no wings with hair or bones for Spice N\' Vybe)',
        'Food and brand: Photos use one lighting and color style across the site',
        'Food and brand: Catering, events, or private dining section is present if the client offers it',
        'Food and brand: Social links and reviews link to the correct accounts',
      ],
    },
    {
      name: 'E-commerce',
      criteria: [
        'Browsing: Product cards show image, name, price, and rating in the same layout everywhere',
        'Browsing: Sale prices and regular prices are formatted the same way and the discount is clear',
        'Browsing: Search, filters, and sort are shown where there are more than about 12 products',
        'Browsing: Out of stock, no results, and empty states are designed',
        'Product page: Gallery with multiple angles and zoom',
        'Product page: Price, variant picker, and Add to Cart are visible above the fold',
        'Product page: Shipping time, returns summary, and size or spec info are visible without leaving the page',
        'Product page: Reviews, ratings, and related products are shown',
        'Cart and checkout: Cart shows item, quantity, price, and subtotal, with edit and remove',
        'Cart and checkout: Shipping cost and taxes are visible before the final step',
        'Cart and checkout: Guest checkout is offered',
        'Cart and checkout: Error states for card, address, and coupon fields are designed',
        'Cart and checkout: Secure payment icons and a link to policies appear on the checkout screens',
        'Cart and checkout: Order confirmation page is designed',
        'Policies: Shipping, Returns, Privacy, and Terms pages are linked in the footer',
        'Policies: Contact and customer support info are easy to find',
      ],
    },
  ],
  reference: `HOW TO USE THIS REFERENCE
This is guidance for how to review. It is not a checklist to grade. Grade only the criteria listed.

RULES FOR EVERY WEBSITE REVIEW
1. Judge only what is visible in the uploaded pages. Never assume a feature exists because it usually does.
2. If a criterion cannot be judged from a static PDF (hover states, sticky header, load speed, scroll behavior, form behavior, a link actually working), do not pass it on a guess. Give it status "warn" and start the comment with "Cannot verify from PDF:" followed by what a person should check.
3. Never invent facts about the client. If a phone number, address, hours, claim, or testimonial looks wrong, flag it and say what it should be compared against. Do not correct it silently.
4. In every comment give the page number, where on the page, what is wrong, and the specific fix. Write the action items as fixes a designer can act on, most serious first. Start each with "Blocker:" (must be fixed before the client sees it: spelling errors, wrong logo, wrong contact info, unreadable text, missing legal links), "Fix:" (spacing, alignment, hierarchy, consistency) or "Note:" (optional polish).
5. Legal and compliance items are flags for a person to review. You are a second pair of eyes, not legal sign-off.

HANDOFF NOTES PAGE
A Figma PDF shows design, not code. SEO and some interaction items can only be judged from a Handoff Notes page at the end of the PDF. For each page of the site it lists: URL slug, page title (target under about 60 characters), meta description (target about 155), the H1 text, primary keyword and city or service area, alt text plan for key images (or "decorative"), and interactions a static page cannot show.
If there is no Handoff Notes page, give every criterion that starts with "SEO:" the status "warn" with the comment "Cannot verify from PDF: no Handoff Notes page", and make the first action item "Blocker: Add a Handoff Notes page". Do not fail the design for something the PDF could never show.

WEBSITE TYPES
Only the criteria for the chosen media type apply. The shared criteria apply to every type.

CLIENT RULES
Spice N' Vybe: chicken wings in any photo on the site have no hair and no visible bones, and each wing photo matches the flavor or style named beside it. Check each wing photo and list any that fail by page and position. Apply this only when the site is for Spice N' Vybe.

NOT YET CONFIRMED BY REYAL
Do not guess these. Mention them in a comment only if they come up: the exact Reyal handoff note format beyond the list above.`,
};

const MENU: Starter = {
  base: [
    'Spelling: No spelling or grammar errors in dish names, ingredients, descriptions, headings, or footers',
    'Spelling: Foreign dish names are spelled correctly with accents where they belong (jalapeño, crème brûlée, pão de queijo) and spelled the same everywhere',
    'Spelling: The same item has the same name and spelling on every page or panel',
    'Spelling: Capitalization style is consistent across all dish names and all section headings',
    'Spelling: Punctuation style is consistent in descriptions: no double spaces, no stray commas, one style of quotes',
    'Spelling: No lorem ipsum, "Item name", "Description here", or template filler anywhere',
    'Spelling: No leftover text from a previous client or an older version of this menu',
    'Prices: Every plate, side, drink, add-on, and size option has a price; list any item without one',
    'Prices: One price format is used across the whole menu ($12, $12.00, or 12) and prices are aligned the same way',
    'Prices: Size or protein variations are priced clearly (small and large, add chicken, add shrimp)',
    'Prices: "Market price" or "MP" appears only where the client confirmed it',
    'Prices: Combos, bundles, and specials state exactly what is included',
    'Legibility: All text is readable at actual print size for the format; flag anything that looks smaller than about 8 pt',
    'Legibility: Strong contrast between text and background, especially over photos, textures, and colored blocks',
    'Legibility: No text sits on a busy image without an overlay or clear space',
    'Legibility: No more than 2 font families, and brand fonts only',
    'Legibility: Fine print and legal text are small but still readable',
    'Legibility: No text is lost in a fold, gutter, or trim area',
    'Layout: Items sit on a consistent grid with even spacing between dishes and between sections',
    'Layout: Section headings are styled the same everywhere and never sit alone at the bottom of a column',
    'Layout: No awkward line breaks, single word last lines, or squeezed text boxes',
    'Layout: Price alignment is consistent, with leader dots or a fixed column used the same way throughout',
    'Layout: Section order is logical (starters, mains, sides, desserts, drinks)',
    'Layout: Photos, icons, and decoration never collide with text',
    'Layout: Text and logos stay at least 1/8 inch inside the trim edge, and backgrounds and photos run to the edge for bleed',
    'Layout: Page size and orientation match the job spec',
    'Brand: The correct logo is used, in the right version and color for the background',
    'Brand: For multi-location clients, the logo and details are for the correct location',
    'Brand: Brand colors and fonts are used correctly and match the brand profile',
    'Brand: Address, phone, hours, website, and social handles are present and correct',
    'Brand: Food photos show the dish named, look appetizing, and follow the client\'s photo rules',
    'Brand: No photo is stretched, pixelated, or low resolution',
    'Claims and dietary: Dietary icons (vegetarian, vegan, gluten free, spicy) have a legend and appear only where the client confirmed them',
    'Claims and dietary: Claims such as organic, wild caught, Angus, house made, local, or "Fresh from Florida" appear only if the client confirmed them; flag every one for confirmation',
    'Claims and dietary: No allergen statement or "gluten free" label has been invented; flag any that the client has not supplied',
    'Claims and dietary: If the client is part of a chain of 20 or more locations under the same name, calorie information is shown (federal menu labeling); confirm location count with the client',
    'Raw foods: Every raw or undercooked animal food is found (steaks or burgers cooked to order, eggs, oysters, sushi or sashimi, ceviche, tartare, carpaccio)',
    'Raw foods: Hidden raw egg or similar in sauces, dressings, and desserts (Caesar, hollandaise, aioli, mousse) is found',
    'Raw foods: When any raw or undercooked item is found, a consumer advisory is present on the menu',
    'Reyal footer: The footer is present at the end of the menu (last page, back cover, or last panel) and on every standalone menu in the set',
    'Reyal footer: The footer contains the project number and the client abbreviation',
    'Reyal footer: The copyright notice includes the copyright symbol and the print year; the year matches the print year in the job info, or is flagged for confirmation when none is given',
    'Reyal footer: The footer says "Designed by Reyal Design" spelled exactly that way',
    'Reyal footer: The Reyal phone number and website are both present and match the approved footer sample',
    'Reyal footer: The footer is small, sits in the same place and same size on every menu in the set, and does not touch or overlap menu content',
    'Reyal footer: The project number matches the file name or job info when provided',
  ],
  types: [
    {
      name: 'One-page menu (catering)',
      criteria: [
        'Every section fits on the page without crowding and best sellers or packages can be found in about five seconds',
        'Clear hierarchy: restaurant name, then sections, then dishes, then prices',
        'Catering details are present when applicable: serving sizes (serves 10, half pan, full pan), minimum order, and lead time as supplied by the client',
        'Consumer advisory (when needed) and the reference footer are both on the page',
        'Logo, address, phone, hours, and ordering contact are on the page',
        'Page size and bleed match the spec',
      ],
    },
    {
      name: 'Flyer menu, front and back (5x7 or 8.5x11)',
      criteria: [
        'Page size is exactly 5x7 or 8.5x11 as specified, with bleed',
        'Front and back both carry the brand and neither looks like leftover content',
        'Content is split logically and no dish is split across front and back',
        'When flipped, the back reads in the correct direction relative to the front',
        'Consumer advisory (when needed) is on the side where affected items appear',
        'Reference footer is on the back, or the last side of the piece',
        'Contact info and a call to action appear on at least one side',
        'On 5x7, text is still readable and nothing is crowded into the trim safe area',
      ],
    },
    {
      name: 'Trifold brochure menu (8.5x11 or 8.5x14)',
      criteria: [
        'Page size matches the format and the panel widths match the print template for that fold type',
        'Cover panel (what shows when folded) carries the logo and name and reads correctly when the brochure is closed',
        'Inside panels read in the correct order when opened, with sections not split awkwardly between panels',
        'No dish name, price, or photo crosses a fold line, and nothing important sits within 1/8 inch of a fold',
        'Panels that tuck inward are treated per the template, with no content hidden or cut',
        'The back panels, when folded, are correct (contact, hours, map or QR if used) and the right way up',
        'Consumer advisory (when needed) is visible on the same spread as the affected items',
        'Reference footer is on the final panel or back',
        'Each side is checked separately (outside and inside) and the side labels are correct in the file',
      ],
    },
    {
      name: 'Large menu with covers',
      criteria: [
        'Front cover and back cover match the size in the job spec, and interior pages match the interior size in the job spec',
        'Cover has the logo and restaurant name, and the back cover has address, hours, contact, and the reference footer',
        'Interior sheets (about 5 sheets, 10 views, more when needed) follow one grid, header, and footer system',
        'Page numbers or section markers are consistent, and a section index exists when the menu has more than 10 views',
        'Section order and heading styles are identical from the first view to the last',
        'Items that appear in more than one place match in name, description, and price',
        'Every view with asterisked items has its footnote in the same view, or the consumer advisory repeats on every view',
        'No view is noticeably emptier or more crowded than its neighbors',
        'Front and back of each sheet read in the correct direction',
        'Text and logos are at least 1/8 inch inside the trim on every view and clear of any binding or hole punch area',
      ],
    },
  ],
  reference: `HOW TO USE THIS REFERENCE
This is guidance for how to review. It is not a checklist to grade. Grade only the criteria listed. Use this reference to decide how to judge them and what to recommend.

RULES FOR EVERY MENU REVIEW
1. Judge only what is visible in the uploaded pages. Never assume a feature exists because it usually does.
2. If something cannot be judged from a static PDF (a QR code actually scanning, a color that depends on the printer), do not pass it on a guess. Give it status "warn" and start the comment with "Cannot verify from PDF:" followed by what a person should check.
3. Never invent facts about the client. If a price, phone number, hours, or claim looks wrong, flag it and say what it should be compared against. Do not correct it silently.
4. In every comment give the page number, where on the page, what is wrong, and the specific fix.
5. Write the action items most serious first. Start each with "Blocker:" (must be fixed before the client sees it), "Fix:" or "Note:". These are Blockers: spelling errors, missing prices, a missing legal advisory, a wrong logo, wrong contact info, unreadable text, a missing or wrong Reyal footer, and any price that does not match the price list. These are Fixes: spacing, alignment, hierarchy, consistency, drinks and kids details. Optional polish is a Note.
6. Legal items are flags for a person to review. You are a second pair of eyes, not legal sign-off. Mark every legal finding "Needs human compliance check".

PRICE LIST CHECK
Run this only when the client's approved price list is among the uploaded pages. Then check: every price on the menu matches the price list exactly (list each mismatch with the menu price and the list price); every item on the price list appears on the menu, or is listed as missing; every item on the menu appears on the price list, or is listed as not on the list; item names and size options match the price list wording. Every one of these is a Blocker.
If no price list is among the pages, add one action item: "Note: Prices not verified against client list".

DRINKS AND KIDS SECTIONS
There are no separate Drinks or Kids menu types. These checks apply only when the menu has such a section, as a page, a panel, or a standalone flyer. If it has none, ignore this part and do not mention it. Drinks have prices for every size or format (glass, bottle, pitcher, pour size). Alcohol items are grouped and labeled clearly, and any age or responsible service wording the client supplied is present. Drink names, brands, and spellings are correct (brand names as the brand spells them). Kids items are clearly marked as kids items, with age limits or portion notes only if the client supplied them. Kids items that include raw or undercooked animal foods (burgers, eggs) are covered by the consumer advisory like any other item. A standalone drinks or kids menu still carries the full Reyal footer.

CONSUMER ADVISORY BY STATE
Raw and undercooked animal foods need a consumer advisory. Find the state from the restaurant's printed address on the menu and apply that state's profile below. If any raw or undercooked item is found and the state cannot be told, add "Blocker: State not selected, advisory requirements not checked". If the state is not Florida, Georgia, or Alabama, say that no profile exists for it and the advisory needs a person to check. Every legal finding is "Needs human compliance check".

Florida (source: Florida DBPR consumer advisory bulletin, Food Code 3-603.11 and Florida Administrative Code 61C-4.010(8) for oysters; the bulletin is from 2013, so confirm current text):
- Any raw, undercooked, or not fully cooked animal food (beef, eggs, fish, lamb, milk, pork, poultry, shellfish) has a written consumer advisory.
- The advisory describes the affected foods and reminds customers that eating them raw or undercooked may increase the risk of foodborne illness.
- Every separate menu piece (dinner, lunch, brunch, kids, drinks with food) carries the advisory, visible from any point where food is ordered.
- Items with hidden raw or undercooked ingredients (Caesar dressing, hollandaise, aioli, mousse) are disclosed on the item itself.
- Sushi and sashimi are in their own section labeled as raw or undercooked fish, or each is marked with a symbol and a legend in the same menu area.
- If raw oysters are offered, the oyster warning required by Florida Administrative Code 61C-4.010(8) appears wherever oysters are offered. A person must confirm the exact wording against the current rule or the client's approved template.
- Species and origin claims (grouper, "Florida shrimp", "wild caught") are flagged for client confirmation.
- Confirm current text with DBPR (850-487-1395) before print.

Georgia (source: Georgia Department of Agriculture, Rules for Consumer Advisories; no rule number is listed there):
- Any beef, fish, pork, shellfish, eggs, lamb, or poultry sold ready to eat raw or undercooked has a consumer advisory.
- Disclosure is present in one of two forms: the affected foods are described on the menu (for example "oysters on the half shell (raw oysters)" or "hamburgers (can be cooked to order)"), or each affected item is asterisked to a footnote saying it is served raw or undercooked or contains raw or undercooked ingredients.
- Reminder is present as an asterisk-linked footnote with one of three statements: written safety information is available on request; or "Consuming raw or undercooked meats, poultry, seafood, shellfish, or eggs may increase your risk of foodborne illness"; or that same sentence plus a note that the risk is higher for people with certain medical conditions.
- Asterisks on items match the footnote symbol exactly, and the footnote is on the same page or panel as the items it covers.
- Every separate menu piece in the set carries the advisory.
- Confirm the current rule with the Georgia Department of Agriculture before print.

Alabama (source: Alabama Department of Public Health plan review checklist, 2023; it gives no rule number or required wording, so treat this as a minimum check):
- Any raw or undercooked meats, eggs, or fish have a consumer advisory about the hazards, printed on the menu itself and not only on a wall sign or separate card.
- Every separate menu piece in the set that lists affected items carries the advisory.
- Best practice while the rule is unconfirmed: use the Georgia approach (disclosure by description or asterisk, plus a reminder footnote that eating raw or undercooked foods may increase the risk of foodborne illness).
- Items with hidden raw or undercooked ingredients are marked.
- Confirm the exact requirement and wording with the Alabama Department of Public Health or the client's county health department before print.

CLIENT RULES
Spice N' Vybe (apply only when the menu is for Spice N' Vybe): chicken wings in any menu photo have no hair and no visible bones. Check every wing photo individually and list any that fail by page and position. Wing photos match the flavor or style named beside them.

REYAL FOOTER
Reyal's standard footer sits at the end of every menu piece and prints on the final menu. It has the project number, the client abbreviation, a copyright notice with the year the menu was printed, "Designed by Reyal Design", the Reyal phone number, and the Reyal website. Its exact order and the Reyal phone number are not confirmed in this reference. Check the elements that can be seen, and if you cannot compare the phone number or website against an approved sample, give it "warn" with "Cannot verify from PDF: no approved footer sample" and do not guess a number.

NOT YET CONFIRMED BY REYAL
Do not guess these. The minimum print size of about 8 pt is a working line, not a Reyal standard, and the 5x7 flyer and trifold are the tightest. The large menu cover and interior sizes are not confirmed, so check the sizes against the job spec if one is given and otherwise note that the size was not verified.`,
};

export const STARTER: Partial<Record<Kind, Starter>> = { website: WEBSITE, menu: MENU };
