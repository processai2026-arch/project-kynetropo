/**
 * Products API client
 * Endpoints: GET /products, GET /products/{id}/configurations
 *            POST /admin/products, PUT /admin/products/{id}, DELETE /admin/products/{id}
 *            POST /admin/products/{id}/configurations, PUT/DELETE /admin/products/{id}/configurations/{cid}
 */
import { apiFetch } from "./client";

// Map UI category names to DB product_type enum values
// DB enum: 'pellets' | 'biomass-stove' | 'biomass-burner'
const CATEGORY_TO_TYPE: Record<string, string> = {
  "Pellets":        "pellets",
  "Biomass Stove":  "biomass-stove",
  "Biomass Burner": "biomass-burner",
};

export function toProductType(category: string): string {
  return CATEGORY_TO_TYPE[category] ?? category.toLowerCase().replace(/ /g, "-");
}

// ── Types matching the backend response ────────────────────────────────────

export interface ApiConfiguration {
  config_id: number;
  size: string;
  purpose: string;
  sub_purpose: string | null;
  price: string;
}

export interface ApiProduct {
  product_id: number;
  product_name: string;
  product_type: string;
  description: string | null;
  base_price: number;
  unit: string | null;
  category: string | null;
  tag: string | null;
  tag_color: string | null;
  suitable_for: string | null;
  image_url: string | null;
  gcv: string | null;
  ash_content: string | null;
  moisture_content: string | null;
  is_available: boolean;
  configurations: ApiConfiguration[];
}

export interface ApiProductsResponse {
  success: boolean;
  data: ApiProduct[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface QuantityTier {
  price_tier_id?: number;
  min_quantity: number;
  max_quantity: number | null;
  unit_price: number;
}

export interface PriceListItem {
  price_list_item_id?: number;
  product_id: number;
  product_name?: string;
  unit_price: number;
  tiers: QuantityTier[];
}

export interface PriceList {
  price_list_id: number;
  name: string;
  description: string | null;
  effective_from: string;
  effective_to: string | null;
  priority: number;
  is_active: boolean;
  product_count?: number;
  tier_count?: number;
  items?: PriceListItem[];
}

export interface ProductVariant {
  variant_id: number;
  parent_product_id: number;
  child_product_id: number;
  sku: string;
  attribute_values: Record<string, string>;
  is_active: boolean;
  product_name: string;
  base_price: number;
  unit: string | null;
}

export interface KitComponent {
  kit_component_id?: number;
  product_id: number;
  product_name?: string;
  quantity: number;
  base_price?: number;
  line_price?: number;
}

export interface ProductKit {
  product_id: number;
  components: KitComponent[];
  computed_price: number;
}

export interface ResolvedPrice {
  product_id: number;
  quantity: number;
  date: string;
  unit_price: number;
  total_price: number;
  source: "quantity_tier" | "price_list" | "kit_computed" | "product_base";
  price_list_id: number | null;
  price_list_name: string | null;
  tier: QuantityTier | null;
}

// ── UI shape (what Products.tsx uses) ──────────────────────────────────────

export interface SizePrice {
  size: string;
  price: string;
  configId?: number; // keep for edit/delete
}

export interface UIProduct {
  id: number;
  product: string;
  sizes: SizePrice[];
  purposes: string[];
  subPurposes: Record<string, string[]>;
  description: string;
  category: string;
  minOrderQty: number;
  imageUrl: string;
  // extra data kept for API calls
  _raw?: ApiProduct;
}

// ── Data transformer ───────────────────────────────────────────────────────

/**
 * Convert the API's flat configurations array into the UI's
 * sizes[], purposes[], and subPurposes{} structure.
 *
 * API config: [{ config_id, size, purpose, price }, ...]
 *   → UI sizes: unique {size, price per kg} entries
 *   → UI purposes: unique purpose strings
 *   → UI subPurposes: we don't have sub-purposes from API so we keep empty {}
 *     (sub-purposes are a UI-only concept not yet in the backend schema)
 */
export function mapApiProductToUI(p: ApiProduct): UIProduct {
  const configs = p.configurations ?? [];

  // Build size list: unique sizes with formatted price string
  const sizeMap: Record<string, number> = {};
  for (const c of configs) {
    if (sizeMap[c.size] === undefined) {
      sizeMap[c.size] = parseFloat(c.price);
    }
  }

  const sizes: SizePrice[] =
    Object.keys(sizeMap).length > 0
      ? Object.entries(sizeMap).map(([size, price]) => ({
          size,
          price: `₹${price}/kg`,
        }))
      : [{ size: "Default", price: `₹${p.base_price}/kg` }];

  // Build purposes → subPurposes map from configurations:
  // purposes  = unique purpose values (e.g. "Commercial Kitchen", "Industrial Dryer")
  // subPurposes[purpose] = unique sizes available for that purpose (shown as badge tags in table)
  const purposeSizeMap: Record<string, Set<string>> = {};
  for (const c of configs) {
    const pur = c.purpose ?? "General";
    if (!purposeSizeMap[pur]) {
      purposeSizeMap[pur] = new Set<string>();
    }
    purposeSizeMap[pur].add(c.size);
  }

  const purposes = Object.keys(purposeSizeMap);
  const subPurposes: Record<string, string[]> = {};
  for (const pur of purposes) {
    // Show sub_purpose names as badge tags (the named use-cases per purpose)
    // Fall back to size names if no sub_purpose is set
    const purposeConfigs = configs.filter(c => (c.purpose ?? "General") === pur);
    const subNames = purposeConfigs
      .map(c => c.sub_purpose)
      .filter((s): s is string => !!s);
    subPurposes[pur] = subNames.length > 0
      ? [...new Set(subNames)]           // unique named sub-purposes
      : purposeConfigs.map(c => c.size); // fallback: show sizes
  }

  return {
    id: p.product_id,
    product: p.product_name,
    sizes,
    purposes,
    subPurposes,
    description: p.description ?? "",
    category: p.category ?? p.product_type ?? "Pellets",
    minOrderQty: 1,
    imageUrl: p.image_url ?? "",
    _raw: p,
  };
}

// ── API calls ──────────────────────────────────────────────────────────────

export async function fetchProducts(): Promise<UIProduct[]> {
  const res = await apiFetch<ApiProductsResponse>("/products?limit=100");
  return (res.data ?? []).map(mapApiProductToUI);
}

export async function createProduct(payload: {
  product_name: string;
  product_type: string;
  description?: string;
  base_price: number;
  category?: string;
  image_url?: string;
  is_available?: boolean;
  configurations?: { size: string; purpose: string; price: number }[];
}): Promise<void> {
  await apiFetch("/admin/products", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateProduct(
  id: number,
  payload: {
    product_name?: string;
    product_type?: string;
    description?: string;
    base_price?: number;
    category?: string;
    image_url?: string;
    is_available?: boolean;
    configurations?: { size: string; purpose: string; sub_purpose?: string; price: number }[];
  }
): Promise<void> {
  await apiFetch(`/admin/products/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteProduct(id: number): Promise<void> {
  await apiFetch(`/admin/products/${id}`, { method: "DELETE" });
}

// ── Advanced product catalogue ───────────────────────────────────────────

export async function fetchPriceLists(): Promise<PriceList[]> {
  const res = await apiFetch<ApiEnvelope<{ price_lists: PriceList[] }>>("/admin/price-lists");
  return res.data.price_lists ?? [];
}

export async function fetchPriceList(id: number): Promise<PriceList> {
  const res = await apiFetch<ApiEnvelope<PriceList>>(`/admin/price-lists/${id}`);
  return res.data;
}

export async function createPriceList(payload: Omit<PriceList, "price_list_id"> & { items: PriceListItem[] }): Promise<PriceList> {
  const res = await apiFetch<ApiEnvelope<PriceList>>("/admin/price-lists", { method: "POST", body: JSON.stringify(payload) });
  return res.data;
}

export async function updatePriceList(id: number, payload: Partial<Omit<PriceList, "price_list_id" | "items">>): Promise<PriceList> {
  const res = await apiFetch<ApiEnvelope<PriceList>>(`/admin/price-lists/${id}`, { method: "PUT", body: JSON.stringify(payload) });
  return res.data;
}

export async function replacePriceListItems(id: number, items: PriceListItem[]): Promise<PriceList> {
  const res = await apiFetch<ApiEnvelope<PriceList>>(`/admin/price-lists/${id}/items`, { method: "PUT", body: JSON.stringify({ items }) });
  return res.data;
}

export async function deletePriceList(id: number): Promise<void> {
  await apiFetch(`/admin/price-lists/${id}`, { method: "DELETE" });
}

export async function resolveProductPrice(productId: number, quantity = 1, date = new Date().toISOString().slice(0, 10), priceListId?: number): Promise<ResolvedPrice> {
  const query = new URLSearchParams({ product_id: String(productId), quantity: String(quantity), date });
  if (priceListId) query.set("price_list_id", String(priceListId));
  const res = await apiFetch<ApiEnvelope<ResolvedPrice>>(`/admin/pricing/resolve?${query}`);
  return res.data;
}

export async function fetchProductVariants(productId: number): Promise<ProductVariant[]> {
  const res = await apiFetch<ApiEnvelope<{ variants: ProductVariant[] }>>(`/admin/products/${productId}/variants`);
  return res.data.variants ?? [];
}

export async function createProductVariant(productId: number, payload: {
  sku: string;
  attributes: Record<string, string>;
  child_product_id?: number;
  product_name?: string;
  base_price?: number;
}): Promise<void> {
  await apiFetch(`/admin/products/${productId}/variants`, { method: "POST", body: JSON.stringify(payload) });
}

export async function updateProductVariant(productId: number, variantId: number, payload: Partial<Pick<ProductVariant, "sku" | "is_active">> & { attributes?: Record<string, string> }): Promise<void> {
  await apiFetch(`/admin/products/${productId}/variants/${variantId}`, { method: "PUT", body: JSON.stringify(payload) });
}

export async function deleteProductVariant(productId: number, variantId: number): Promise<void> {
  await apiFetch(`/admin/products/${productId}/variants/${variantId}`, { method: "DELETE" });
}

export async function fetchProductKit(productId: number): Promise<ProductKit> {
  const res = await apiFetch<ApiEnvelope<ProductKit>>(`/admin/products/${productId}/kit`);
  return res.data;
}

export async function updateProductKit(productId: number, components: KitComponent[]): Promise<ProductKit> {
  const res = await apiFetch<ApiEnvelope<ProductKit>>(`/admin/products/${productId}/kit`, { method: "PUT", body: JSON.stringify({ components }) });
  return res.data;
}
