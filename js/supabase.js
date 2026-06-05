/* ───────────────────────────────────────────
   AARES — supabase.js
   Supabase client + all DB query helpers.
   Every other JS file talks to the DB
   through these functions only.
─────────────────────────────────────────── */

const { createClient } = window.supabase;
const db = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

/* ══════════════════════════════════════════
   PRODUCTS
══════════════════════════════════════════ */
const Products = {

  // Get all active products (for home, grid)
  async getAll() {
    const { data, error } = await db
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  // Get single product by ID
  async getById(id) {
    const { data, error } = await db
      .from('products')
      .select('*')
      .eq('id', id)
      .eq('is_active', true)
      .single();
    if (error) throw error;
    return data;
  },

  // Search by keyword + optional filters
  async search({ query = '', sortBy = 'newest', category = '', page = 1 }) {
    let req = db
      .from('products')
      .select('*')
      .eq('is_active', true);

    if (query.trim()) {
      req = req.or(
        `name.ilike.%${query}%,description.ilike.%${query}%`
      );
    }

    if (category) {
      req = req.eq('category', category);
    }

    switch (sortBy) {
      case 'price_asc':
        req = req.order('current_price', { ascending: true });
        break;
      case 'price_desc':
        req = req.order('current_price', { ascending: false });
        break;
      case 'top_rated':
        req = req.order('rating_average', { ascending: false });
        break;
      case 'popular':
        req = req.order('order_count', { ascending: false });
        break;
      case 'newest':
      default:
        req = req.order('created_at', { ascending: false });
        break;
    }

    // Pagination
    const from = (page - 1) * CONFIG.PRODUCTS_PER_PAGE;
    const to   = from + CONFIG.PRODUCTS_PER_PAGE - 1;
    req = req.range(from, to);

    const { data, error } = await req;
    if (error) throw error;
    return data;
  },

  // Get newest products (home page section)
  async getNew(limit = 8) {
    const { data, error } = await db
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data;
  },

  // Get most popular products (by order_count)
  async getPopular(limit = 8) {
    const { data, error } = await db
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('order_count', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data;
  },

  // Get top rated
  async getTopRated(limit = 8) {
    const { data, error } = await db
      .from('products')
      .select('*')
      .eq('is_active', true)
      .gt('rating_average', 0)
      .order('rating_average', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data;
  },

  // Get distinct categories
  async getCategories() {
    const { data, error } = await db
      .from('products')
      .select('category')
      .eq('is_active', true)
      .not('category', 'is', null);
    if (error) throw error;
    const cats = [...new Set(data.map(r => r.category))].filter(Boolean);
    return cats;
  },

  // Update rating_average after a review is approved
  async updateRating(productId) {
    const { data, error } = await db
      .from('reviews')
      .select('rating')
      .eq('product_id', productId)
      .eq('is_approved', true);
    if (error) throw error;
    if (!data.length) return;
    const avg = data.reduce((s, r) => s + r.rating, 0) / data.length;
    await db
      .from('products')
      .update({ rating_average: Math.round(avg * 10) / 10 })
      .eq('id', productId);
  },

};

/* ══════════════════════════════════════════
   ACCOUNTS
══════════════════════════════════════════ */
const Accounts = {

  async create(data) {
    const { data: row, error } = await db
      .from('accounts')
      .insert([data])
      .select()
      .single();
    if (error) throw error;
    return row;
  },

  async getByMobile(mobile) {
    const { data, error } = await db
      .from('accounts')
      .select('*')
      .eq('mobile_number', mobile)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async getByEmail(email) {
    const { data, error } = await db
      .from('accounts')
      .select('*')
      .eq('email', email.toLowerCase())
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async getById(id) {
    const { data, error } = await db
      .from('accounts')
      .select('id, full_name, mobile_number, email, address, created_at')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async update(id, fields) {
    const { data, error } = await db
      .from('accounts')
      .update(fields)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async mobileExists(mobile) {
    const { data } = await db
      .from('accounts')
      .select('id')
      .eq('mobile_number', mobile)
      .maybeSingle();
    return !!data;
  },

  async emailExists(email) {
    const { data } = await db
      .from('accounts')
      .select('id')
      .eq('email', email.toLowerCase())
      .maybeSingle();
    return !!data;
  },

};

/* ══════════════════════════════════════════
   ORDERS
══════════════════════════════════════════ */
const Orders = {

  async create(orderData) {
    const { data, error } = await db
      .from('orders')
      .insert([orderData])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getByUser(userId) {
    const { data, error } = await db
      .from('orders')
      .select('*')
      .eq('user_id', userId)
      .order('order_date', { ascending: false });
    if (error) throw error;
    return data;
  },

  async getById(id) {
    const { data, error } = await db
      .from('orders')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

};

/* ══════════════════════════════════════════
   ORDER ITEMS
══════════════════════════════════════════ */
const OrderItems = {

  async createBatch(items) {
    const { data, error } = await db
      .from('order_items')
      .insert(items)
      .select();
    if (error) throw error;
    return data;
  },

  async getByOrder(orderId) {
    const { data, error } = await db
      .from('order_items')
      .select(`
        *,
        products ( id, name, main_image_url, current_price )
      `)
      .eq('order_id', orderId);
    if (error) throw error;
    return data;
  },

  // Check if a user has ever ordered a specific product (for review gate)
  async userHasOrdered(userId, productId) {
    const { data, error } = await db
      .from('order_items')
      .select(`
        id,
        orders!inner ( user_id )
      `)
      .eq('product_id', productId)
      .eq('orders.user_id', userId)
      .limit(1);
    if (error) throw error;
    return data && data.length > 0;
  },

};

/* ══════════════════════════════════════════
   REVIEWS
══════════════════════════════════════════ */
const Reviews = {

  async getByProduct(productId) {
    const { data, error } = await db
      .from('reviews')
      .select(`
        id, rating, comment, created_at,
        accounts ( full_name )
      `)
      .eq('product_id', productId)
      .eq('is_approved', true)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async create(reviewData) {
    const { data, error } = await db
      .from('reviews')
      .insert([reviewData])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // Check if user already reviewed this product
  async hasReviewed(userId, productId) {
    const { data } = await db
      .from('reviews')
      .select('id')
      .eq('user_id', userId)
      .eq('product_id', productId)
      .maybeSingle();
    return !!data;
  },

};

/* ══════════════════════════════════════════
   CART (Supabase — logged-in users only)
══════════════════════════════════════════ */
const CartDB = {

  async getByUser(userId) {
    const { data, error } = await db
      .from('cart')
      .select(`
        id, quantity,
        products ( id, name, current_price, original_price, main_image_url, inventory_count, is_active )
      `)
      .eq('user_id', userId);
    if (error) throw error;
    return data;
  },

  // Insert or update quantity
  async upsert(userId, productId, quantity) {
    // Check if row exists
    const { data: existing } = await db
      .from('cart')
      .select('id, quantity')
      .eq('user_id', userId)
      .eq('product_id', productId)
      .maybeSingle();

    if (existing) {
      const { error } = await db
        .from('cart')
        .update({ quantity })
        .eq('id', existing.id);
      if (error) throw error;
    } else {
      const { error } = await db
        .from('cart')
        .insert([{ user_id: userId, product_id: productId, quantity }]);
      if (error) throw error;
    }
  },

  async remove(userId, productId) {
    const { error } = await db
      .from('cart')
      .delete()
      .eq('user_id', userId)
      .eq('product_id', productId);
    if (error) throw error;
  },

  async clear(userId) {
    const { error } = await db
      .from('cart')
      .delete()
      .eq('user_id', userId);
    if (error) throw error;
  },

};
