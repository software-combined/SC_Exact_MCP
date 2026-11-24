// Only operations and inputs declared in Exact's reference are included.
import type { CatalogMutation } from "./shape.js";

export const salesChanges = {
  exact_quotations_create: { entity: "quotations", method: "POST",
    fields: {
      QuotationID: "guid", ClosingDate: "date", Currency: "text", DeliveryAccount: "guid", DeliveryAccountContact:
      "guid", DeliveryAddress: "guid", DeliveryDate: "date", Description: "text", Document: "guid", DueDate: "date",
      IncotermAddress: "text", IncotermCode: "text", IncotermVersion: "int", InvoiceAccount: "guid",
      InvoiceAccountContact: "guid", Opportunity: "guid", OrderAccount: "guid", OrderAccountContact: "guid",
      PaymentCondition: "text", Project: "guid", QuotationDate: "date", QuotationNumber: "int", Remarks: "text",
      SalesChannel: "guid", SalesPerson: "guid", SelectionCode: "guid", ShippingMethod: "guid", WarehouseID: "guid",
      YourRef: "text" },
    required: ["OrderAccount", "QuotationLines"],
    children: {
      QuotationLines: { fields: {
        ID: "guid", CostCenter: "text", CostUnit: "text", Description: "text", Discount: "number", Item: "guid",
        NetPrice: "number", Notes: "text", Optional: "boolean", Quantity: "number", UnitCode: "text", UnitPrice:
        "number", VATCode: "text" }, required: ["Item"] },
    },
  },
  exact_quotations_update: { entity: "quotations", method: "PUT",
    fields: {
      ClosingDate: "date", Currency: "text", DeliveryAccountContact: "guid", DeliveryAddress: "guid", DeliveryDate:
      "date", Description: "text", Document: "guid", DueDate: "date", IncotermAddress: "text", IncotermCode: "text",
      IncotermVersion: "int", InvoiceAccountContact: "guid", Opportunity: "guid", OrderAccountContact: "guid",
      PaymentCondition: "text", Project: "guid", QuotationDate: "date", QuotationNumber: "int", Remarks: "text",
      SalesChannel: "guid", SalesPerson: "guid", SelectionCode: "guid", ShippingMethod: "guid", WarehouseID: "guid",
      YourRef: "text" },
    required: [],
    children: {
      QuotationLines: { fields: {
        ID: "guid", CostCenter: "text", CostUnit: "text", Description: "text", Discount: "number", Item: "guid",
        NetPrice: "number", Notes: "text", Optional: "boolean", Quantity: "number", UnitCode: "text", UnitPrice:
        "number", VATCode: "text" }, required: ["Item"] },
    },
  },
  exact_quotation_lines_create: { entity: "quotation_lines", method: "POST",
    fields: {
      ID: "guid", CostCenter: "text", CostUnit: "text", Description: "text", Discount: "number", Item: "guid",
      NetPrice: "number", Notes: "text", Optional: "boolean", Quantity: "number", QuotationID: "guid", UnitCode:
      "text", UnitPrice: "number", VATCode: "text" },
    required: ["Item", "QuotationID"],
  },
  exact_quotation_lines_update: { entity: "quotation_lines", method: "PUT",
    fields: {
      CostCenter: "text", CostUnit: "text", Description: "text", Discount: "number", Item: "guid", NetPrice:
      "number", Notes: "text", Optional: "boolean", Quantity: "number", UnitCode: "text", UnitPrice: "number",
      VATCode: "text" },
    required: [],
  },
  exact_sales_orders_create: { entity: "sales_orders", method: "POST",
    fields: {
      OrderID: "guid", AmountDiscount: "number", AmountDiscountExclVat: "number", ApprovalStatus: "int", Currency:
      "text", DeliverTo: "guid", DeliverToContactPerson: "guid", DeliveryAddress: "guid", DeliveryDate: "date",
      Description: "text", Discount: "number", Document: "guid", IncotermAddress: "text", IncotermCode: "text",
      IncotermVersion: "int", InvoiceTo: "guid", InvoiceToContactPerson: "guid", OrderDate: "date", OrderedBy:
      "guid", OrderedByContactPerson: "guid", OrderNumber: "int", PaymentCondition: "text", PaymentReference:
      "text", Remarks: "text", SalesChannel: "guid", Salesperson: "guid", SelectionCode: "guid", ShippingMethod:
      "guid", TaxSchedule: "guid", WarehouseID: "guid", YourRef: "text" },
    required: ["OrderedBy", "SalesOrderLines"],
    children: {
      SalesOrderLines: { fields: {
        ID: "guid", AmountFC: "number", CostCenter: "text", CostUnit: "text", DeliveryDate: "date", Description:
        "text", Discount: "number", Item: "guid", ItemVersion: "guid", Margin: "number", NetPrice: "number", Notes:
        "text", OrderNumber: "int", Pricelist: "guid", Project: "guid", Quantity: "number", ShopOrder: "guid",
        TaxSchedule: "guid", UnitCode: "text", UnitPrice: "number", UseDropShipment: "int", VATAmount: "number",
        VATCode: "text", VATPercentage: "number" }, required: ["Item"] },
    },
  },
  exact_sales_orders_update: { entity: "sales_orders", method: "PUT",
    fields: {
      AmountDiscount: "number", AmountDiscountExclVat: "number", Currency: "text", DeliverToContactPerson: "guid",
      DeliveryAddress: "guid", DeliveryDate: "date", Description: "text", Discount: "number", Document: "guid",
      IncotermAddress: "text", IncotermCode: "text", IncotermVersion: "int", InvoiceToContactPerson: "guid",
      OrderDate: "date", OrderedByContactPerson: "guid", OrderNumber: "int", PaymentCondition: "text",
      PaymentReference: "text", Remarks: "text", SalesChannel: "guid", Salesperson: "guid", SelectionCode: "guid",
      ShippingMethod: "guid", TaxSchedule: "guid", WarehouseID: "guid", YourRef: "text" },
    required: [],
    children: {
      SalesOrderLines: { fields: {
        ID: "guid", AmountFC: "number", CostCenter: "text", CostUnit: "text", DeliveryDate: "date", Description:
        "text", Discount: "number", Item: "guid", ItemVersion: "guid", Margin: "number", NetPrice: "number", Notes:
        "text", OrderNumber: "int", Pricelist: "guid", Project: "guid", Quantity: "number", ShopOrder: "guid",
        TaxSchedule: "guid", UnitCode: "text", UnitPrice: "number", UseDropShipment: "int", VATAmount: "number",
        VATCode: "text", VATPercentage: "number" }, required: ["Item"] },
    },
  },
  exact_sales_order_lines_create: { entity: "sales_order_lines", method: "POST",
    fields: {
      ID: "guid", AmountFC: "number", CostCenter: "text", CostUnit: "text", DeliveryDate: "date", Description:
      "text", Discount: "number", Item: "guid", ItemVersion: "guid", Margin: "number", NetPrice: "number", Notes:
      "text", OrderID: "guid", OrderNumber: "int", Pricelist: "guid", Project: "guid", Quantity: "number",
      ShopOrder: "guid", TaxSchedule: "guid", UnitCode: "text", UnitPrice: "number", UseDropShipment: "int",
      VATAmount: "number", VATCode: "text", VATPercentage: "number" },
    required: ["Item", "OrderID"],
  },
  exact_sales_order_lines_update: { entity: "sales_order_lines", method: "PUT",
    fields: {
      AmountFC: "number", CostCenter: "text", CostUnit: "text", DeliveryDate: "date", Description: "text", Discount:
      "number", Item: "guid", ItemVersion: "guid", Margin: "number", NetPrice: "number", Notes: "text", OrderID:
      "guid", OrderNumber: "int", Pricelist: "guid", Project: "guid", Quantity: "number", ShopOrder: "guid",
      TaxSchedule: "guid", UnitCode: "text", UnitPrice: "number", UseDropShipment: "int", VATAmount: "number",
      VATCode: "text", VATPercentage: "number" },
    required: [],
  },
  exact_sales_invoices_create: { entity: "sales_invoices", method: "POST",
    fields: {
      InvoiceID: "guid", AmountDiscount: "number", AmountDiscountExclVat: "number", Currency: "text", DeliverTo:
      "guid", DeliverToAddress: "guid", DeliverToContactPerson: "guid", Description: "text", Discount: "number",
      Document: "guid", DueDate: "date", ExtraDutyAmountFC: "number", GAccountAmountFC: "number", IncotermAddress:
      "text", IncotermCode: "text", IncotermVersion: "int", InvoiceStatusInformation: "text", InvoiceTo: "guid",
      InvoiceToContactPerson: "guid", IsExtraDuty: "boolean", Journal: "text", OrderDate: "date", OrderedBy: "guid",
      OrderedByContactPerson: "guid", OrderNumber: "int", PaymentCondition: "text", PaymentReference: "text",
      Remarks: "text", SalesChannel: "guid", Salesperson: "guid", SelectionCode: "guid", ShippingMethod: "guid",
      TaxSchedule: "guid", Type: "int", Warehouse: "guid", WithholdingTaxAmountFC: "number",
      WithholdingTaxBaseAmount: "number", WithholdingTaxPercentage: "number", YourRef: "text" },
    required: ["Journal", "OrderedBy", "SalesInvoiceLines"],
    children: {
      SalesInvoiceLines: { fields: {
        ID: "guid", AmountFC: "number", CostCenter: "text", CostUnit: "text", DeliveryDate: "date", Description:
        "text", Discount: "number", Employee: "guid", EndTime: "date", ExtraDutyAmountFC: "number",
        ExtraDutyPercentage: "number", GLAccount: "guid", Item: "guid", NetPrice: "number", Notes: "text",
        Pricelist: "guid", Project: "guid", ProjectWBS: "guid", Quantity: "number", StartTime: "date", TaxSchedule:
        "guid", UnitCode: "text", UnitPrice: "number", VATAmountDC: "number", VATAmountFC: "number", VATCode:
        "text", VATPercentage: "number" }, required: [] },
    },
  },
  exact_sales_invoices_update: { entity: "sales_invoices", method: "PUT",
    fields: {
      AmountDiscount: "number", AmountDiscountExclVat: "number", Currency: "text", DeliverToAddress: "guid",
      DeliverToContactPerson: "guid", Description: "text", Discount: "number", Document: "guid", DueDate: "date",
      ExtraDutyAmountFC: "number", GAccountAmountFC: "number", IncotermAddress: "text", IncotermCode: "text",
      IncotermVersion: "int", InvoiceStatusInformation: "text", InvoiceToContactPerson: "guid", IsExtraDuty:
      "boolean", OrderDate: "date", OrderedByContactPerson: "guid", OrderNumber: "int", PaymentCondition: "text",
      PaymentReference: "text", Remarks: "text", SalesChannel: "guid", Salesperson: "guid", SelectionCode: "guid",
      ShippingMethod: "guid", TaxSchedule: "guid", Warehouse: "guid", WithholdingTaxAmountFC: "number",
      WithholdingTaxBaseAmount: "number", WithholdingTaxPercentage: "number", YourRef: "text" },
    required: [],
    children: {
      SalesInvoiceLines: { fields: {
        ID: "guid", AmountFC: "number", CostCenter: "text", CostUnit: "text", DeliveryDate: "date", Description:
        "text", Discount: "number", Employee: "guid", EndTime: "date", ExtraDutyAmountFC: "number",
        ExtraDutyPercentage: "number", GLAccount: "guid", Item: "guid", NetPrice: "number", Notes: "text",
        Pricelist: "guid", Project: "guid", ProjectWBS: "guid", Quantity: "number", StartTime: "date", TaxSchedule:
        "guid", UnitCode: "text", UnitPrice: "number", VATAmountDC: "number", VATAmountFC: "number", VATCode:
        "text", VATPercentage: "number" }, required: [] },
    },
  },
  exact_sales_invoice_lines_create: { entity: "sales_invoice_lines", method: "POST",
    fields: {
      ID: "guid", AmountFC: "number", CostCenter: "text", CostUnit: "text", DeliveryDate: "date", Description:
      "text", Discount: "number", Employee: "guid", EndTime: "date", ExtraDutyAmountFC: "number",
      ExtraDutyPercentage: "number", GLAccount: "guid", InvoiceID: "guid", Item: "guid", NetPrice: "number", Notes:
      "text", Pricelist: "guid", Project: "guid", ProjectWBS: "guid", Quantity: "number", StartTime: "date",
      TaxSchedule: "guid", UnitCode: "text", UnitPrice: "number", VATAmountDC: "number", VATAmountFC: "number",
      VATCode: "text", VATPercentage: "number" },
    required: ["InvoiceID", "Item"],
  },
  exact_sales_invoice_lines_update: { entity: "sales_invoice_lines", method: "PUT",
    fields: {
      AmountFC: "number", CostCenter: "text", CostUnit: "text", DeliveryDate: "date", Description: "text", Discount:
      "number", Employee: "guid", EndTime: "date", ExtraDutyAmountFC: "number", ExtraDutyPercentage: "number", Item:
      "guid", NetPrice: "number", Notes: "text", Pricelist: "guid", Project: "guid", ProjectWBS: "guid", Quantity:
      "number", StartTime: "date", TaxSchedule: "guid", UnitCode: "text", UnitPrice: "number", VATAmountDC:
      "number", VATAmountFC: "number", VATCode: "text", VATPercentage: "number" },
    required: [],
  },
  exact_sales_entries_create: { entity: "sales_entries", method: "POST",
    fields: {
      EntryID: "guid", BatchNumber: "int", Currency: "text", Customer: "guid", Description: "text", Document:
      "guid", DueDate: "date", EntryDate: "date", EntryNumber: "int", ExternalLinkReference: "text",
      GAccountAmountFC: "number", InvoiceNumber: "int", InvoiceStatusInformation: "text", IsExtraDuty: "boolean",
      Journal: "text", OrderNumber: "int", PaymentCondition: "text", PaymentReference: "text", ProcessNumber: "int",
      Rate: "number", ReportingPeriod: "int", ReportingYear: "int", Reversal: "boolean", VATAmountFC: "number",
      WithholdingTaxAmountDC: "number", WithholdingTaxBaseAmount: "number", WithholdingTaxPercentage: "number",
      YourRef: "text" },
    required: ["Customer", "Journal", "SalesEntryLines"],
    children: {
      SalesEntryLines: { fields: {
        ID: "guid", AmountFC: "number", Asset: "guid", CostCenter: "text", CostUnit: "text", Description: "text",
        ExtraDutyAmountFC: "number", ExtraDutyPercentage: "number", From: "date", GLAccount: "guid", IntraStatArea:
        "text", IntraStatCountry: "text", IntraStatDeliveryTerm: "text", IntraStatTransactionA: "text",
        IntraStatTransactionB: "text", IntraStatTransportMethod: "text", Notes: "text", Project: "guid", Quantity:
        "number", SerialNumber: "text", StatisticalNetWeight: "number", StatisticalNumber: "text",
        StatisticalQuantity: "number", StatisticalValue: "number", Subscription: "guid", TaxSchedule: "guid", To:
        "date", TrackingNumber: "guid", VATAmountFC: "number", VATBaseAmountDC: "number", VATBaseAmountFC: "number",
        VATCode: "text", VATPercentage: "number" }, required: ["AmountFC", "GLAccount"] },
    },
  },
  exact_sales_entries_update: { entity: "sales_entries", method: "PUT",
    fields: {
      BatchNumber: "int", Currency: "text", Customer: "guid", Description: "text", Document: "guid", DueDate:
      "date", EntryDate: "date", ExternalLinkReference: "text", GAccountAmountFC: "number", InvoiceNumber: "int",
      InvoiceStatusInformation: "text", IsExtraDuty: "boolean", Journal: "text", OrderNumber: "int",
      PaymentCondition: "text", PaymentReference: "text", ProcessNumber: "int", Rate: "number", ReportingPeriod:
      "int", ReportingYear: "int", Reversal: "boolean", VATAmountFC: "number", WithholdingTaxAmountDC: "number",
      WithholdingTaxBaseAmount: "number", WithholdingTaxPercentage: "number", YourRef: "text" },
    required: [],
    children: {
      SalesEntryLines: { fields: {
        ID: "guid", AmountFC: "number", Asset: "guid", CostCenter: "text", CostUnit: "text", Description: "text",
        ExtraDutyAmountFC: "number", ExtraDutyPercentage: "number", From: "date", GLAccount: "guid", IntraStatArea:
        "text", IntraStatCountry: "text", IntraStatDeliveryTerm: "text", IntraStatTransactionA: "text",
        IntraStatTransactionB: "text", IntraStatTransportMethod: "text", Notes: "text", Project: "guid", Quantity:
        "number", SerialNumber: "text", StatisticalNetWeight: "number", StatisticalNumber: "text",
        StatisticalQuantity: "number", StatisticalValue: "number", Subscription: "guid", TaxSchedule: "guid", To:
        "date", TrackingNumber: "guid", VATAmountFC: "number", VATBaseAmountDC: "number", VATBaseAmountFC: "number",
        VATCode: "text", VATPercentage: "number" }, required: ["AmountFC", "GLAccount"] },
    },
  },
  exact_sales_entry_lines_create: { entity: "sales_entry_lines", method: "POST",
    fields: {
      ID: "guid", AmountFC: "number", Asset: "guid", CostCenter: "text", CostUnit: "text", Description: "text",
      EntryID: "guid", ExtraDutyAmountFC: "number", ExtraDutyPercentage: "number", From: "date", GLAccount: "guid",
      IntraStatArea: "text", IntraStatCountry: "text", IntraStatDeliveryTerm: "text", IntraStatTransactionA: "text",
      IntraStatTransactionB: "text", IntraStatTransportMethod: "text", Notes: "text", Project: "guid", Quantity:
      "number", SerialNumber: "text", StatisticalNetWeight: "number", StatisticalNumber: "text",
      StatisticalQuantity: "number", StatisticalValue: "number", Subscription: "guid", TaxSchedule: "guid", To:
      "date", TrackingNumber: "guid", VATAmountFC: "number", VATBaseAmountDC: "number", VATBaseAmountFC: "number",
      VATCode: "text", VATPercentage: "number" },
    required: ["AmountFC", "EntryID", "GLAccount"],
  },
  exact_sales_entry_lines_update: { entity: "sales_entry_lines", method: "PUT",
    fields: {
      AmountFC: "number", Asset: "guid", CostCenter: "text", CostUnit: "text", Description: "text", EntryID: "guid",
      ExtraDutyAmountFC: "number", ExtraDutyPercentage: "number", From: "date", GLAccount: "guid", IntraStatArea:
      "text", IntraStatCountry: "text", IntraStatDeliveryTerm: "text", IntraStatTransactionA: "text",
      IntraStatTransactionB: "text", IntraStatTransportMethod: "text", Notes: "text", Project: "guid", Quantity:
      "number", SerialNumber: "text", StatisticalNetWeight: "number", StatisticalNumber: "text",
      StatisticalQuantity: "number", StatisticalValue: "number", Subscription: "guid", TaxSchedule: "guid", To:
      "date", TrackingNumber: "guid", VATAmountFC: "number", VATBaseAmountDC: "number", VATBaseAmountFC: "number",
      VATCode: "text", VATPercentage: "number" },
    required: [],
  },
} satisfies Record<string, CatalogMutation>;
