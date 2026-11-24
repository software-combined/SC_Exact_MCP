// Fixed projections follow Exact’s REST reference and the retained BoostU catalogue.
import type { CatalogResource } from "./shape.js";

export const items = {
  items: { resource: "logistics/Items", label: "items: the goods and services that can be sold or purchased",
    fields: {
      ID: "guid", Code: "text", Description: "text", ItemGroup: "guid", ItemGroupCode: "text", ItemGroupDescription:
      "text", CostPriceStandard: "number", StandardSalesPrice: "number", SalesVatCode: "text", Unit: "text",
      UnitDescription: "text", IsSalesItem: "boolean", IsPurchaseItem: "boolean", IsStockItem: "boolean",
      IsWebshopItem: "int", IsSerialItem: "boolean", GLRevenue: "guid", GLRevenueCode: "text", GLCosts: "guid",
      GLCostsCode: "text", Barcode: "text", EndDate: "date", Created: "date", Modified: "date" },
    filters: [
      "ID", "Code", "Description", "ItemGroup", "ItemGroupCode", "SalesVatCode", "Unit", "IsSalesItem",
      "IsPurchaseItem", "IsStockItem", "IsWebshopItem", "IsSerialItem", "GLRevenue", "GLCosts", "Barcode",
      "EndDate", "Created", "Modified" ],
    key: "ID" },
  item_groups: { resource: "logistics/ItemGroups", label: "item groups, which drive the default ledger accounts for items",
    fields: {
      ID: "guid", Code: "text", Description: "text", GLRevenue: "guid", GLCosts: "guid", GLStock: "guid", IsDefault:
      "int", Created: "date", Modified: "date" },
    filters: [
      "ID", "Code", "Description", "GLRevenue", "GLCosts", "GLStock", "IsDefault", "Created", "Modified" ],
    key: "ID" },
  sales_item_prices: { resource: "logistics/SalesItemPrices", label: "sales prices per item, price list and quantity",
    fields: {
      ID: "guid", Item: "guid", ItemCode: "text", ItemDescription: "text", Account: "guid", AccountName: "text",
      Price: "number", Currency: "text", Quantity: "number", Unit: "text", UnitDescription: "text", StartDate:
      "date", EndDate: "date", NumberOfItemsPerUnit: "number", Modified: "date" },
    filters: [
      "ID", "Item", "ItemCode", "ItemDescription", "Account", "AccountName", "Price", "Currency", "Quantity",
      "Unit", "UnitDescription", "StartDate", "EndDate", "NumberOfItemsPerUnit", "Modified" ],
    key: "ID" },
  sales_price_lists: { resource: "sales/SalesPriceLists", label: "sales price lists",
    fields: {
      ID: "guid", Code: "text", Description: "text", Currency: "text", Created: "date", Modified: "date" },
    filters: [
      "ID", "Code", "Description", "Currency", "Created", "Modified" ],
    key: "ID" },
  units: { resource: "logistics/Units", label: "units of measure (piece, hour, kilogram, ...)",
    fields: {
      ID: "guid", Code: "text", Description: "text", Type: "text", Main: "int" },
    filters: [
      "ID", "Code", "Description", "Type", "Main" ],
    key: "ID" },
  customer_items: { resource: "logistics/CustomerItems", label: "the item codes your customers use for your items",
    fields: {
      ID: "guid", Item: "guid", ItemCode: "text", ItemDescription: "text", Account: "guid", AccountName: "text",
      CustomerItemCode: "text", Type: "text", Modified: "date" },
    filters: [
      "ID", "Item", "ItemCode", "ItemDescription", "Account", "AccountName", "CustomerItemCode", "Type", "Modified" ],
    key: "ID" },
} satisfies Record<string, CatalogResource>;
