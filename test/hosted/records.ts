export const USER_A = "11111111-1111-4111-8111-111111111111";
export const USER_B = "22222222-2222-4222-8222-222222222222";
export const INVOICE = "33333333-3333-4333-8333-333333333333";
export const NEW_RECORD = "44444444-4444-4444-8444-444444444444";
export const ITEM = "55555555-5555-4555-8555-555555555555";
export const companyRow = { Code: 123456, Description: "Fictional company", Currency: "EUR" };
export const customerRow = { ID: USER_B, Code: "C001", Name: "Fictional customer" };
export const invoiceRow = { InvoiceID: INVOICE, InvoiceNumber: 20260001, InvoiceToName: "Fictional customer",
  InvoiceDate: "/Date(1767225600000)/", DueDate: "/Date(1769817600000)/", Currency: "EUR", AmountFC: 125.25, Status: 50 };
export const receivableRow = { HID: 123, AccountId: USER_B, AccountCode: "C001", AccountName: "Fictional customer",
  InvoiceNumber: 20260001, InvoiceDate: "/Date(1767225600000)/", DueDate: null, CurrencyCode: "EUR", Amount: 125.25 };
export const itemRow = { ID: ITEM, Code: "CONSULT", Description: "Fictional consulting hour", StandardSalesPrice: 95 };
