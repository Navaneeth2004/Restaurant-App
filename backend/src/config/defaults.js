'use strict';
/** Everything a brand-new (or factory-reset) restaurant starts with. One source for seed AND reset. */

const DEFAULT_SETTINGS = {
  restaurant_name: 'ABC Restaurant',
  address: '',
  phone: '',
  bill_footer: 'Thank you for dining with us!',
  tax_percent: '5',
  brand_color: '#f97316',
  currency_symbol: '₹',
  logo_url: '',
  kitchen_overdue_mins: '20',
  gstin: '',
  legal_name: '',
  state_name: 'Kerala',
  sac_code: '9963',
  b2b_enabled: 'false',
  admin_lock_config: JSON.stringify({ enabled: false, timeout_mins: 5 }),
};

/** Never sent to the browser and never writable through the settings API. */
const SECRET_SETTING_KEYS = new Set(['gdrive_credentials', 'gdrive_tokens']);

const DEFAULT_CATEGORIES = ['Starters', 'Mains', 'Sides', 'Drinks', 'Desserts'];

const DEFAULT_TABLE_COUNT = 8;
const seatsForDefaultTable = (n) => (n <= 4 ? 4 : 6);

const DEFAULT_ITEMS = [
  ['Crispy Wings', 'Fried chicken wings with house sauce', 8.99, 'Starters'],
  ['Chicken Strips', 'Golden fried chicken strips', 7.49, 'Starters'],
  ['Loaded Fries', 'Fries with cheese and jalapeños', 5.99, 'Starters'],
  ['Grilled Chicken', 'Half grilled chicken with herbs', 13.99, 'Mains'],
  ['Chicken Burger', 'Crispy fillet with lettuce and mayo', 11.99, 'Mains'],
  ['Spicy Sandwich', 'Spicy chicken fillet sandwich', 10.49, 'Mains'],
  ['Coleslaw', 'House-made creamy coleslaw', 2.99, 'Sides'],
  ['Garlic Bread', 'Toasted garlic bread', 3.49, 'Sides'],
  ['Cola', '330ml can', 2.49, 'Drinks'],
  ['Lemonade', 'Fresh squeezed lemonade', 2.99, 'Drinks'],
  ['Water', 'Still or sparkling 500ml', 1.49, 'Drinks'],
  ['Chocolate Cake', 'Warm chocolate fudge cake', 5.49, 'Desserts'],
  ['Ice Cream', 'Two scoops of vanilla ice cream', 3.99, 'Desserts'],
];

module.exports = {
  DEFAULT_SETTINGS, SECRET_SETTING_KEYS, DEFAULT_CATEGORIES,
  DEFAULT_TABLE_COUNT, seatsForDefaultTable, DEFAULT_ITEMS,
};
