// Only operations and inputs declared in Exact's reference are included.
import type { CatalogMutation } from "./shape.js";

export const purchaseChanges = {
  exact_purchase_entries_create: { entity: "purchase_entries", method: "POST",
    fields: {
      EntryID: "guid", BatchNumber: "int", Currency: "text", Description: "text", Document: "guid", DueDate: "date",
      EntryDate: "date", EntryNumber: "int", ExternalLinkReference: "text", GAccountAmountFC: "number",
      InvoiceNumber: "int", Journal: "text", OrderNumber: "int", PaymentCondition: "text", PaymentReference: "text",
      ProcessNumber: "int", Rate: "number", ReportingPeriod: "int", ReportingYear: "int", Reversal: "boolean",
      Supplier: "guid", VATAmountFC: "number", YourRef: "text" },
    required: ["Journal", "PurchaseEntryLines", "Supplier"],
    children: {
      PurchaseEntryLines: { fields: {
        ID: "guid", AmountFC: "number", Asset: "guid", CostCenter: "text", CostUnit: "text", Description: "text",
        Expense: "guid", From: "date", GLAccount: "guid", IntraStatArea: "text", IntraStatCountry: "text",
        IntraStatDeliveryTerm: "text", IntraStatTransactionA: "text", IntraStatTransactionB: "text",
        IntraStatTransportMethod: "text", Notes: "text", PrivateUsePercentage: "number", Project: "guid",
        ProjectRebillItem: "guid", Quantity: "number", SerialNumber: "text", StatisticalNetWeight: "number",
        StatisticalNumber: "text", StatisticalQuantity: "number", StatisticalValue: "number", Subscription: "guid",
        To: "date", TrackingNumber: "guid", VATAmountFC: "number", VATBaseAmountFC: "number", VATCode: "text",
        VATNonDeductiblePercentage: "number", VATPercentage: "number", WithholdingAmountDC: "number",
        WithholdingTax: "text" }, required: ["AmountFC", "GLAccount"] },
    },
  },
  exact_purchase_entries_update: { entity: "purchase_entries", method: "PUT",
    fields: {
      BatchNumber: "int", Currency: "text", Description: "text", Document: "guid", DueDate: "date", EntryDate:
      "date", ExternalLinkReference: "text", GAccountAmountFC: "number", InvoiceNumber: "int", Journal: "text",
      OrderNumber: "int", PaymentCondition: "text", PaymentReference: "text", ProcessNumber: "int", Rate: "number",
      ReportingPeriod: "int", ReportingYear: "int", Reversal: "boolean", Supplier: "guid", VATAmountFC: "number",
      YourRef: "text" },
    required: [],
    children: {
      PurchaseEntryLines: { fields: {
        ID: "guid", AmountFC: "number", Asset: "guid", CostCenter: "text", CostUnit: "text", Description: "text",
        Expense: "guid", From: "date", GLAccount: "guid", IntraStatArea: "text", IntraStatCountry: "text",
        IntraStatDeliveryTerm: "text", IntraStatTransactionA: "text", IntraStatTransactionB: "text",
        IntraStatTransportMethod: "text", Notes: "text", PrivateUsePercentage: "number", Project: "guid",
        ProjectRebillItem: "guid", Quantity: "number", SerialNumber: "text", StatisticalNetWeight: "number",
        StatisticalNumber: "text", StatisticalQuantity: "number", StatisticalValue: "number", Subscription: "guid",
        To: "date", TrackingNumber: "guid", VATAmountFC: "number", VATBaseAmountFC: "number", VATCode: "text",
        VATNonDeductiblePercentage: "number", VATPercentage: "number", WithholdingAmountDC: "number",
        WithholdingTax: "text" }, required: ["AmountFC", "GLAccount"] },
    },
  },
  exact_purchase_entry_lines_create: { entity: "purchase_entry_lines", method: "POST",
    fields: {
      ID: "guid", AmountFC: "number", Asset: "guid", CostCenter: "text", CostUnit: "text", Description: "text",
      EntryID: "guid", Expense: "guid", From: "date", GLAccount: "guid", IntraStatArea: "text", IntraStatCountry:
      "text", IntraStatDeliveryTerm: "text", IntraStatTransactionA: "text", IntraStatTransactionB: "text",
      IntraStatTransportMethod: "text", Notes: "text", PrivateUsePercentage: "number", Project: "guid",
      ProjectRebillItem: "guid", Quantity: "number", SerialNumber: "text", StatisticalNetWeight: "number",
      StatisticalNumber: "text", StatisticalQuantity: "number", StatisticalValue: "number", Subscription: "guid",
      To: "date", TrackingNumber: "guid", VATAmountFC: "number", VATBaseAmountFC: "number", VATCode: "text",
      VATNonDeductiblePercentage: "number", VATPercentage: "number", WithholdingAmountDC: "number", WithholdingTax:
      "text" },
    required: ["AmountFC", "EntryID", "GLAccount"],
  },
  exact_purchase_entry_lines_update: { entity: "purchase_entry_lines", method: "PUT",
    fields: {
      AmountFC: "number", Asset: "guid", CostCenter: "text", CostUnit: "text", Description: "text", EntryID: "guid",
      Expense: "guid", From: "date", GLAccount: "guid", IntraStatArea: "text", IntraStatCountry: "text",
      IntraStatDeliveryTerm: "text", IntraStatTransactionA: "text", IntraStatTransactionB: "text",
      IntraStatTransportMethod: "text", Notes: "text", PrivateUsePercentage: "number", Project: "guid",
      ProjectRebillItem: "guid", Quantity: "number", SerialNumber: "text", StatisticalNetWeight: "number",
      StatisticalNumber: "text", StatisticalQuantity: "number", StatisticalValue: "number", Subscription: "guid",
      To: "date", TrackingNumber: "guid", VATAmountFC: "number", VATBaseAmountFC: "number", VATCode: "text",
      VATNonDeductiblePercentage: "number", VATPercentage: "number", WithholdingAmountDC: "number", WithholdingTax:
      "text" },
    required: [],
  },
  exact_purchase_invoices_create: { entity: "purchase_invoices", method: "POST",
    fields: {
      ID: "guid", ContactPerson: "guid", Currency: "text", Description: "text", Document: "guid", DueDate: "date",
      ExchangeRate: "number", FinancialPeriod: "int", FinancialYear: "int", InvoiceDate: "date", Journal: "text",
      PaymentCondition: "text", PaymentReference: "text", Remarks: "text", Supplier: "guid", Type: "int", Warehouse:
      "guid", YourRef: "text" },
    required: ["Journal", "PurchaseInvoiceLines", "Supplier", "Type"],
    children: {
      PurchaseInvoiceLines: { fields: {
        ID: "guid", Amount: "number", CostCenter: "text", CostUnit: "text", Description: "text", Discount: "number",
        Expense: "guid", From: "date", Item: "guid", NetPrice: "number", Notes: "text", Project: "guid",
        PurchaseOrderLine: "guid", Quantity: "number", Rebill: "boolean", To: "date", UnitPrice: "number",
        VATAmount: "number", VATCode: "text" }, required: [] },
    },
  },
  exact_purchase_invoices_update: { entity: "purchase_invoices", method: "PUT",
    fields: {
      ContactPerson: "guid", Currency: "text", Description: "text", Document: "guid", DueDate: "date", ExchangeRate:
      "number", InvoiceDate: "date", Journal: "text", PaymentCondition: "text", PaymentReference: "text", Remarks:
      "text", Type: "int", YourRef: "text" },
    required: [],
    children: {
      PurchaseInvoiceLines: { fields: {
        ID: "guid", Amount: "number", CostCenter: "text", CostUnit: "text", Description: "text", Discount: "number",
        Expense: "guid", From: "date", Item: "guid", NetPrice: "number", Notes: "text", Project: "guid",
        PurchaseOrderLine: "guid", Quantity: "number", Rebill: "boolean", To: "date", UnitPrice: "number",
        VATAmount: "number", VATCode: "text" }, required: [] },
    },
  },
  exact_purchase_orders_create: { entity: "purchase_orders", method: "POST",
    fields: {
      PurchaseOrderID: "guid", Currency: "text", Description: "text", Document: "guid", ExchangeRate: "number",
      IncotermAddress: "text", IncotermCode: "text", IncotermVersion: "int", OrderDate: "date", OrderNumber: "int",
      PaymentCondition: "text", PurchaseAgent: "guid", ReceiptDate: "date", Remarks: "text", SelectionCode: "guid",
      ShippingMethod: "guid", Supplier: "guid", SupplierContact: "guid", SupplierContactPersonFullName: "text",
      Warehouse: "guid", YourRef: "text" },
    required: ["PurchaseOrderLines", "Supplier"],
    children: {
      PurchaseOrderLines: { fields: {
        ID: "guid", CostCenter: "text", CostUnit: "text", Description: "text", Discount: "number", From: "date",
        Item: "guid", NetPrice: "number", Notes: "text", Project: "guid", QuantityInPurchaseUnits: "number", Rebill:
        "boolean", ReceiptDate: "date", To: "date", UnitPrice: "number", VATCode: "text", VATPercentage: "number" }, required: ["Item", "QuantityInPurchaseUnits"] },
    },
  },
  exact_purchase_orders_update: { entity: "purchase_orders", method: "PUT",
    fields: {
      Description: "text", Document: "guid", IncotermAddress: "text", IncotermCode: "text", IncotermVersion: "int",
      OrderDate: "date", PaymentCondition: "text", PurchaseAgent: "guid", ReceiptDate: "date", Remarks: "text",
      SelectionCode: "guid", ShippingMethod: "guid", SupplierContact: "guid", Warehouse: "guid", YourRef: "text" },
    required: [],
  },
  exact_purchase_order_lines_update: { entity: "purchase_order_lines", method: "PUT",
    fields: {
      CostCenter: "text", CostUnit: "text", Description: "text", Discount: "number", From: "date", Item: "guid",
      NetPrice: "number", Notes: "text", Project: "guid", QuantityInPurchaseUnits: "number", Rebill: "boolean",
      ReceiptDate: "date", To: "date", UnitPrice: "number", VATCode: "text", VATPercentage: "number" },
    required: [],
  },
} satisfies Record<string, CatalogMutation>;
