// Fixed projections follow Exact’s REST reference and the retained BoostU catalogue.
import type { CatalogResource } from "./shape.js";

export const sales = {
  quotations: { resource: "crm/Quotations", label: "sales quotations",
    fields: {
      QuotationID: "guid", QuotationNumber: "int", VersionNumber: "int", OrderAccount: "guid", OrderAccountName:
      "text", Description: "text", QuotationDate: "date", DueDate: "date", Status: "int", StatusDescription: "text",
      AmountDC: "number", Currency: "text", Created: "date", Modified: "date" },
    filters: [
      "QuotationID", "QuotationNumber", "VersionNumber", "OrderAccount", "OrderAccountName", "Description",
      "QuotationDate", "DueDate", "Status", "StatusDescription", "AmountDC", "Currency", "Created", "Modified" ],
    key: "QuotationID" },
  quotation_lines: { resource: "crm/QuotationLines", label: "lines on sales quotations",
    fields: {
      ID: "guid", QuotationID: "guid", LineNumber: "int", Item: "guid", ItemDescription: "text", Description:
      "text", Quantity: "number", UnitCode: "text", NetPrice: "number", AmountDC: "number", VATCode: "text",
      VATAmountFC: "number" },
    filters: [
      "ID", "QuotationID", "LineNumber", "Item", "ItemDescription", "Description", "Quantity", "UnitCode",
      "NetPrice", "AmountDC", "VATCode", "VATAmountFC" ],
    key: "ID" },
  sales_orders: { resource: "salesorder/SalesOrders", label: "sales orders",
    fields: {
      OrderID: "guid", OrderNumber: "int", OrderedBy: "guid", OrderedByName: "text", Description: "text", OrderDate:
      "date", DeliveryDate: "date", Status: "int", StatusDescription: "text", AmountDC: "number", Currency: "text",
      YourRef: "text", Created: "date", Modified: "date" },
    filters: [
      "OrderID", "OrderNumber", "OrderedBy", "Description", "OrderDate", "DeliveryDate", "Status", "YourRef",
      "Created", "Modified" ],
    key: "OrderID" },
  sales_order_lines: { resource: "salesorder/SalesOrderLines", label: "lines on sales orders",
    fields: {
      ID: "guid", OrderID: "guid", LineNumber: "int", Item: "guid", ItemDescription: "text", Description: "text",
      Quantity: "number", QuantityDelivered: "number", UnitCode: "text", NetPrice: "number", AmountDC: "number",
      VATCode: "text" },
    filters: [
      "ID", "OrderID", "LineNumber", "Item", "Description", "VATCode" ],
    key: "ID" },
  goods_deliveries: { resource: "salesorder/GoodsDeliveries", label: "goods deliveries against sales orders",
    fields: {
      EntryID: "guid", EntryNumber: "int", DeliveryDate: "date", DeliveryAccount: "guid", DeliveryAccountName:
      "text", Description: "text", ShippingMethodDescription: "text", Modified: "date" },
    filters: [
      "EntryID", "EntryNumber", "DeliveryDate", "DeliveryAccount", "DeliveryAccountName", "Description",
      "ShippingMethodDescription", "Modified" ],
    key: "EntryID" },
  sales_invoices: { resource: "salesinvoice/SalesInvoices", label: "outgoing sales invoices",
    fields: {
      InvoiceID: "guid", InvoiceNumber: "int", OrderNumber: "int", InvoiceTo: "guid", InvoiceToName: "text",
      Description: "text", InvoiceDate: "date", DueDate: "date", Status: "int", StatusDescription: "text", AmountDC:
      "number", AmountFC: "number", VATAmountDC: "number", Currency: "text", YourRef: "text", Journal: "text",
      Created: "date", Modified: "date" },
    filters: [
      "InvoiceID", "InvoiceNumber", "OrderNumber", "InvoiceTo", "Description", "InvoiceDate", "Status", "YourRef",
      "Journal", "Created", "Modified" ],
    key: "InvoiceID" },
  sales_invoice_lines: { resource: "salesinvoice/SalesInvoiceLines", label: "lines on sales invoices",
    fields: {
      ID: "guid", InvoiceID: "guid", LineNumber: "int", Item: "guid", ItemCode: "text", ItemDescription: "text",
      Description: "text", Quantity: "number", UnitCode: "text", NetPrice: "number", AmountDC: "number", VATCode:
      "text", VATPercentage: "number", VATAmountDC: "number", GLAccount: "guid", GLAccountDescription: "text",
      CostCenter: "text", Project: "guid" },
    filters: [
      "ID", "InvoiceID", "LineNumber", "Item", "Description", "VATCode", "GLAccount", "CostCenter", "Project" ],
    key: "ID" },
  sales_entries: { resource: "salesentry/SalesEntries", label: "sales invoices as booked in the ledger",
    fields: {
      EntryID: "guid", EntryNumber: "int", Customer: "guid", CustomerName: "text", Description: "text", EntryDate:
      "date", DueDate: "date", InvoiceNumber: "int", YourRef: "text", AmountDC: "number", VATAmountDC: "number",
      Currency: "text", Journal: "text", JournalDescription: "text", Status: "int", PaymentReference: "text",
      ReportingPeriod: "int", ReportingYear: "int", Created: "date", Modified: "date" },
    filters: [
      "EntryID", "EntryNumber", "Customer", "CustomerName", "Description", "EntryDate", "DueDate", "InvoiceNumber",
      "YourRef", "AmountDC", "VATAmountDC", "Currency", "Journal", "JournalDescription", "Status",
      "PaymentReference", "ReportingPeriod", "ReportingYear", "Created", "Modified" ],
    key: "EntryID" },
  sales_entry_lines: { resource: "salesentry/SalesEntryLines", label: "ledger lines of booked sales invoices",
    fields: {
      ID: "guid", EntryID: "guid", LineNumber: "int", Description: "text", AmountDC: "number", AmountFC: "number",
      VATCode: "text", VATPercentage: "number", VATAmountDC: "number", GLAccount: "guid", GLAccountCode: "text",
      GLAccountDescription: "text", CostCenter: "text", CostUnit: "text", Project: "guid", Quantity: "number" },
    filters: [
      "ID", "EntryID", "LineNumber", "Description", "AmountDC", "AmountFC", "VATCode", "VATPercentage",
      "VATAmountDC", "GLAccount", "GLAccountCode", "GLAccountDescription", "CostCenter", "CostUnit", "Project",
      "Quantity" ],
    key: "ID" },
} satisfies Record<string, CatalogResource>;
