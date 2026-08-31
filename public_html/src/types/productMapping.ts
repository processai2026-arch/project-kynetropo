export interface ProductMappingItem {
  item_id: number;
  product_id: number;
  quantity: number;
  product_sku?: string;
  product_name?: string;
}

export interface ProductMapping {
  mapping_id: number;
  invoice_product_name: string;
  items: ProductMappingItem[];
  created_at: string;
  updated_at: string | null;
}

export interface ProductMappingCheckResult {
  mappings: Record<string, ProductMapping | null>;
  unmapped: string[];
  unmapped_count: number;
}
