// Fixed projections follow Exact’s REST reference and the retained BoostU catalogue.
import type { CatalogResource } from "./shape.js";

export const purchase = {
  purchase_entries: { resource: "purchaseentry/PurchaseEntries", label: "incoming supplier invoices as booked in the ledger",
    fields: {
      EntryID: "guid", EntryNumber: "int", Supplier: "guid", SupplierName: "text", Description: "text", EntryDate:
      "date", DueDate: "date", InvoiceNumber: "int", YourRef: "text", AmountDC: "number", VATAmountDC: "number",
      Currency: "text", Journal: "text", JournalDescription: "text", Status: "int", PaymentReference: "text",
      ReportingPeriod: "int", ReportingYear: "int", Created: "date", Modified: "date" },
    filters: [
      "EntryID", "EntryNumber", "Supplier", "SupplierName", "Description", "EntryDate", "DueDate", "InvoiceNumber",
      "YourRef", "AmountDC", "VATAmountDC", "Currency", "Journal", "JournalDescription", "Status",
      "PaymentReference", "ReportingPeriod", "ReportingYear", "Created", "Modified" ],
    key: "EntryID" },
  purchase_entry_lines: { resource: "purchaseentry/PurchaseEntryLines", label: "ledger lines of incoming supplier invoices",
    fields: {
      ID: "guid", EntryID: "guid", LineNumber: "int", Description: "text", AmountDC: "number", AmountFC: "number",
      VATCode: "text", VATPercentage: "number", VATAmountDC: "number", GLAccount: "guid", GLAccountCode: "text",
      GLAccountDescription: "text", CostCenter: "text", CostUnit: "text", Project: "guid", Quantity: "number" },
    filters: [
      "ID", "EntryID", "LineNumber", "Description", "AmountDC", "AmountFC", "VATCode", "VATPercentage",
      "VATAmountDC", "GLAccount", "GLAccountCode", "GLAccountDescription", "CostCenter", "CostUnit", "Project",
      "Quantity" ],
    key: "ID" },
  purchase_invoices: { resource: "purchase/PurchaseInvoices", label: "purchase invoices in the approval workflow",
    fields: {
      ID: "guid", Supplier: "guid", Description: "text", InvoiceDate: "date", DueDate: "date", Status: "int",
      AmountDC: "number", Currency: "text", YourRef: "text", Journal: "text", Modified: "date", EntryNumber: "int",
      Amount: "number", AmountFCExclVat: "number", VATAmount: "number", FinancialYear: "int", FinancialPeriod:
      "int", Type: "int" },
    filters: [
      "ID", "Supplier", "Description", "InvoiceDate", "DueDate", "Status", "AmountDC", "Currency", "YourRef",
      "Journal", "Modified", "EntryNumber", "Amount", "AmountFCExclVat", "VATAmount", "FinancialYear",
      "FinancialPeriod", "Type" ],
    key: "ID" },
  purchase_invoice_lines: { resource: "purchase/PurchaseInvoiceLines", label: "lines on purchase invoices",
    fields: {
      ID: "guid", InvoiceID: "guid", LineNumber: "int", Description: "text", Quantity: "number", UnitPrice:
      "number", AmountDC: "number", VATCode: "text", Project: "guid", CostCenter: "text", Amount: "number",
      VATAmount: "number", Currency: "text", Expense: "guid", Item: "guid", PurchaseOrderLine: "guid", Modified:
      "date" },
    filters: [
      "ID", "InvoiceID", "LineNumber", "Description", "Quantity", "UnitPrice", "AmountDC", "VATCode", "Project",
      "CostCenter", "Amount", "VATAmount", "Currency", "Expense", "Item", "PurchaseOrderLine", "Modified" ],
    key: "ID" },
  purchase_orders: { resource: "purchaseorder/PurchaseOrders", label: "purchase orders to suppliers",
    fields: {
      PurchaseOrderID: "guid", OrderNumber: "int", Supplier: "guid", SupplierName: "text", Description: "text",
      OrderDate: "date", ReceiptDate: "date", OrderStatus: "int", ReceiptStatus: "int", AmountDC: "number",
      Currency: "text", YourRef: "text", Created: "date", Modified: "date" },
    filters: [
      "PurchaseOrderID", "OrderNumber", "Supplier", "SupplierName", "Description", "OrderDate", "ReceiptDate",
      "OrderStatus", "ReceiptStatus", "AmountDC", "Currency", "YourRef", "Created", "Modified" ],
    key: "PurchaseOrderID" },
  purchase_order_lines: { resource: "purchaseorder/PurchaseOrderLines", label: "lines on purchase orders",
    fields: {
      ID: "guid", PurchaseOrderID: "guid", LineNumber: "int", Item: "guid", ItemDescription: "text", Description:
      "text", Quantity: "number", ReceivedQuantity: "number", NetPrice: "number", AmountDC: "number", VATCode:
      "text", Project: "guid", Unit: "text", Modified: "date" },
    filters: [
      "ID", "PurchaseOrderID", "LineNumber", "Item", "ItemDescription", "Description", "Quantity",
      "ReceivedQuantity", "NetPrice", "AmountDC", "VATCode", "Project", "Unit", "Modified" ],
    key: "ID" },
  goods_receipts: { resource: "purchaseorder/GoodsReceipts", label: "goods received against purchase orders",
    fields: {
      ID: "guid", EntryNumber: "int", ReceiptDate: "date", Supplier: "guid", SupplierName: "text", Description:
      "text", Warehouse: "guid", WarehouseDescription: "text", Modified: "date" },
    filters: [
      "ID", "EntryNumber", "ReceiptDate", "Supplier", "SupplierName", "Description", "Warehouse",
      "WarehouseDescription", "Modified" ],
    key: "ID" },
} satisfies Record<string, CatalogResource>;
