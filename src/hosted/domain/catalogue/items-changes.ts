// Only operations and inputs declared in Exact's reference are included.
import type { CatalogMutation } from "./shape.js";

export const itemsChanges = {
  exact_items_create: { entity: "items", method: "POST",
    fields: {
      ID: "guid", AverageCost: "number", Barcode: "text", Class_01: "text", Class_02: "text", Class_03: "text",
      Class_04: "text", Class_05: "text", Class_06: "text", Class_07: "text", Class_08: "text", Class_09: "text",
      Class_10: "text", Code: "text", CopyRemarks: "int", CostPriceCurrency: "text", CostPriceNew: "number",
      CostPriceStandard: "number", Description: "text", EndDate: "date", ExtraDescription: "text", FreeBoolField_01:
      "boolean", FreeBoolField_02: "boolean", FreeBoolField_03: "boolean", FreeBoolField_04: "boolean",
      FreeBoolField_05: "boolean", FreeDateField_01: "date", FreeDateField_02: "date", FreeDateField_03: "date",
      FreeDateField_04: "date", FreeDateField_05: "date", FreeNumberField_01: "number", FreeNumberField_02:
      "number", FreeNumberField_03: "number", FreeNumberField_04: "number", FreeNumberField_05: "number",
      FreeNumberField_06: "number", FreeNumberField_07: "number", FreeNumberField_08: "number", FreeTextField_01:
      "text", FreeTextField_02: "text", FreeTextField_03: "text", FreeTextField_04: "text", FreeTextField_05:
      "text", FreeTextField_06: "text", FreeTextField_07: "text", FreeTextField_08: "text", FreeTextField_09:
      "text", FreeTextField_10: "text", GLCosts: "guid", GLRevenue: "guid", GLStock: "guid", GrossWeight: "number",
      IsBatchItem: "int", IsFractionAllowedItem: "boolean", IsMakeItem: "int", IsNewContract: "int", IsOnDemandItem:
      "int", IsPackageItem: "boolean", IsPurchaseItem: "boolean", IsSalesItem: "boolean", IsSerialItem: "boolean",
      IsStockItem: "boolean", IsSubcontractedItem: "boolean", IsTaxableItem: "int", IsTime: "int", IsWebshopItem:
      "int", ItemGroup: "guid", NetWeight: "number", NetWeightUnit: "text", Notes: "text", Picture: "binary",
      PictureName: "text", SalesVatCode: "text", SearchCode: "text", SecurityLevel: "int", StartDate: "date", Unit:
      "text" },
    required: ["Code", "Description"],
  },
  exact_items_update: { entity: "items", method: "PUT",
    fields: {
      Barcode: "text", Class_01: "text", Class_02: "text", Class_03: "text", Class_04: "text", Class_05: "text",
      Class_06: "text", Class_07: "text", Class_08: "text", Class_09: "text", Class_10: "text", Code: "text",
      CopyRemarks: "int", CostPriceCurrency: "text", CostPriceNew: "number", Description: "text", EndDate: "date",
      ExtraDescription: "text", FreeBoolField_01: "boolean", FreeBoolField_02: "boolean", FreeBoolField_03:
      "boolean", FreeBoolField_04: "boolean", FreeBoolField_05: "boolean", FreeDateField_01: "date",
      FreeDateField_02: "date", FreeDateField_03: "date", FreeDateField_04: "date", FreeDateField_05: "date",
      FreeNumberField_01: "number", FreeNumberField_02: "number", FreeNumberField_03: "number", FreeNumberField_04:
      "number", FreeNumberField_05: "number", FreeNumberField_06: "number", FreeNumberField_07: "number",
      FreeNumberField_08: "number", FreeTextField_01: "text", FreeTextField_02: "text", FreeTextField_03: "text",
      FreeTextField_04: "text", FreeTextField_05: "text", FreeTextField_06: "text", FreeTextField_07: "text",
      FreeTextField_08: "text", FreeTextField_09: "text", FreeTextField_10: "text", GLCosts: "guid", GLRevenue:
      "guid", GLStock: "guid", GrossWeight: "number", IsBatchItem: "int", IsFractionAllowedItem: "boolean",
      IsMakeItem: "int", IsNewContract: "int", IsOnDemandItem: "int", IsPackageItem: "boolean", IsPurchaseItem:
      "boolean", IsSalesItem: "boolean", IsSerialItem: "boolean", IsStockItem: "boolean", IsSubcontractedItem:
      "boolean", IsTaxableItem: "int", IsTime: "int", IsWebshopItem: "int", ItemGroup: "guid", NetWeight: "number",
      NetWeightUnit: "text", Notes: "text", Picture: "binary", PictureName: "text", SalesVatCode: "text",
      SearchCode: "text", SecurityLevel: "int", StartDate: "date", Unit: "text" },
    required: [],
  },
  exact_sales_item_prices_create: { entity: "sales_item_prices", method: "POST",
    fields: {
      ID: "guid", Account: "guid", Currency: "text", Employee: "guid", EndDate: "date", Item: "guid",
      NumberOfItemsPerUnit: "number", Price: "number", Project: "guid", Quantity: "number", StartDate: "date", Unit:
      "text" },
    required: [],
  },
  exact_sales_item_prices_update: { entity: "sales_item_prices", method: "PUT",
    fields: {
      Account: "guid", Currency: "text", Employee: "guid", EndDate: "date", Item: "guid", NumberOfItemsPerUnit:
      "number", Price: "number", Project: "guid", Quantity: "number", StartDate: "date", Unit: "text" },
    required: [],
  },
  exact_customer_items_create: { entity: "customer_items", method: "POST",
    fields: {
      ID: "guid", Account: "guid", CustomerItemCode: "text", Item: "guid" },
    required: ["ID", "Account", "Item"],
  },
  exact_customer_items_update: { entity: "customer_items", method: "PUT",
    fields: {
      CustomerItemCode: "text" },
    required: [],
  },
} satisfies Record<string, CatalogMutation>;
